import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const COOKIE_NAME = 'sv_steam_session';
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function getProtocol(req: NextRequest): string {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto;
  const url = new URL(req.url);
  return url.protocol.replace(':', '') || 'http';
}

function extractSteamIdFromClaimedId(claimedId: string): string {
  const m = String(claimedId || '').match(/\/openid\/id\/(\d{17,})/);
  return m?.[1] || '';
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function makeSessionCookieValue(steamId: string, secret: string): string {
  const payloadObj = { steamId, iat: Date.now() };
  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = signPayload(payload, secret);
  return `${payload}.${sig}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  const claimedId = params.get('openid.claimed_id') || params.get('openid_claimed_id') || '';
  const mode = params.get('openid.mode') || '';

  // Must be a Steam OpenID callback
  if (!mode || !claimedId) {
    return NextResponse.redirect(new URL('/inventory', url.origin));
  }

  const steamId = extractSteamIdFromClaimedId(claimedId);
  if (!steamId) {
    return NextResponse.redirect(new URL('/inventory', url.origin));
  }

  // Verify assertion with Steam (check_authentication)
  const verifyParams = new URLSearchParams();
  for (const [k, v] of params.entries()) {
    // Steam expects the original openid.* fields
    if (k.startsWith('openid.')) verifyParams.set(k, v);
  }
  verifyParams.set('openid.mode', 'check_authentication');

  let verified = false;
  try {
    const res = await fetch(STEAM_OPENID_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
      },
      body: verifyParams.toString(),
      cache: 'no-store',
    });
    const text = await res.text();
    verified = res.ok && /is_valid\s*:\s*true/i.test(text);
  } catch {
    verified = false;
  }

  const redirectTarget = new URL('/inventory', url.origin);
  // Keep compatibility with existing client-side logic
  redirectTarget.searchParams.set('openid.mode', mode);
  redirectTarget.searchParams.set('openid.claimed_id', claimedId);

  const response = NextResponse.redirect(redirectTarget);

  if (verified) {
    const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
    if (secret) {
      const cookieValue = makeSessionCookieValue(steamId, secret);
      response.cookies.set({
        name: COOKIE_NAME,
        value: cookieValue,
        httpOnly: true,
        secure: getProtocol(req) === 'https',
        sameSite: 'lax',
        maxAge: COOKIE_TTL_SECONDS,
        path: '/',
      });
    }
  }

  return response;
}
