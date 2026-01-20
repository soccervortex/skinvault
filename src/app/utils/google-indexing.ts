import { createSign } from 'crypto';

export type GoogleIndexingNotificationType = 'URL_UPDATED' | 'URL_DELETED';

export type GoogleIndexingPerUrlResult = {
  url: string;
  ok: boolean;
  status: number;
  response?: unknown;
  error?: string;
};

export type GoogleIndexingResult = {
  enabled: boolean;
  submitted: number;
  failed: number;
  results: GoogleIndexingPerUrlResult[];
};

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.skinvaults.online')
  );
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildJwtAssertion(params: {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
  scope: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: params.clientEmail,
    scope: params.scope,
    aud: params.tokenUri,
    iat: now,
    exp: now + 60 * 60,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(params.privateKey);
  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function getAccessToken(): Promise<string> {
  const clientEmail = String(process.env.GOOGLE_INDEXING_CLIENT_EMAIL || '').trim();
  const privateKeyRaw = String(process.env.GOOGLE_INDEXING_PRIVATE_KEY || '');
  const privateKey = privateKeyRaw.includes('\\n') ? privateKeyRaw.replace(/\\n/g, '\n') : privateKeyRaw;
  const tokenUri = String(process.env.GOOGLE_INDEXING_TOKEN_URI || 'https://oauth2.googleapis.com/token').trim();

  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_INDEXING_CLIENT_EMAIL or GOOGLE_INDEXING_PRIVATE_KEY');
  }

  const assertion = buildJwtAssertion({
    clientEmail,
    privateKey,
    tokenUri,
    scope: 'https://www.googleapis.com/auth/indexing',
  });

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error_description === 'string' ? data.error_description : JSON.stringify(data);
    throw new Error(`Google OAuth token error (${res.status}): ${msg}`);
  }

  const accessToken = String((data as any)?.access_token || '').trim();
  if (!accessToken) throw new Error('Google OAuth token response missing access_token');
  return accessToken;
}

function normalizeUrl(inputUrl: string): string {
  const s = String(inputUrl || '').trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/')) return `${getBaseUrl()}${s}`;
  return `${getBaseUrl()}/${s}`;
}

function isSameHost(url: string): boolean {
  try {
    const base = new URL(getBaseUrl());
    const u = new URL(url);
    return u.hostname === base.hostname;
  } catch {
    return false;
  }
}

export async function submitUrlsToGoogleIndexing(params: {
  urls: string[];
  type?: GoogleIndexingNotificationType;
}): Promise<GoogleIndexingResult> {
  const enabled = String(process.env.GOOGLE_INDEXING_ENABLED || '').toLowerCase() === 'true';
  if (!enabled) {
    return { enabled: false, submitted: 0, failed: 0, results: [] };
  }

  const type: GoogleIndexingNotificationType = params.type || 'URL_UPDATED';
  const urls = (Array.isArray(params.urls) ? params.urls : [])
    .map(normalizeUrl)
    .filter((u) => !!u)
    .filter(isSameHost);

  if (urls.length === 0) {
    return { enabled: true, submitted: 0, failed: 0, results: [] };
  }

  const maxUrls = 100;
  const limitedUrls = urls.slice(0, maxUrls);

  const accessToken = await getAccessToken();
  const endpoint = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

  const results: GoogleIndexingPerUrlResult[] = [];

  for (const url of limitedUrls) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, type }),
      });

      const data = await res.json().catch(() => null);

      results.push({
        url,
        ok: res.ok,
        status: res.status,
        response: data,
        ...(res.ok ? {} : { error: typeof (data as any)?.error?.message === 'string' ? (data as any).error.message : undefined }),
      });
    } catch (error) {
      results.push({
        url,
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const submitted = results.filter((r) => r.ok).length;
  const failed = results.length - submitted;

  return { enabled: true, submitted, failed, results };
}

export async function submitItemToGoogleIndexing(itemId: string): Promise<GoogleIndexingResult> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/item/${encodeURIComponent(String(itemId || '').trim())}`;
  return submitUrlsToGoogleIndexing({ urls: [url], type: 'URL_UPDATED' });
}
