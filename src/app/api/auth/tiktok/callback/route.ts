import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbSet } from '@/app/utils/database';

const CONNECTION_PREFIX = 'creator_tiktok_connection_';

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function verifyState(state: string, secret: string): { slug: string; steamId: string } | null {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) return null;
  const expected = signPayload(payload, secret);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }

  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const slug = String(json?.slug || '').trim();
    const steamId = String(json?.steamId || '').trim();
    if (!slug || !steamId) return null;
    return { slug, steamId };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // TikTok returns ?code=...&state=... on success
  const code = String(url.searchParams.get('code') || '').trim();
  const state = String(url.searchParams.get('state') || '').trim();

  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret) return NextResponse.json({ error: 'SESSION_SECRET not configured' }, { status: 500 });

  const cookieState = req.cookies.get('sv_tiktok_oauth_state')?.value || '';
  if (!cookieState || cookieState !== state) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }

  const parsed = verifyState(state, secret);
  if (!parsed) return NextResponse.json({ error: 'Invalid state' }, { status: 400 });

  const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
  if (!clientKey || !clientSecret) {
    return NextResponse.json({ error: 'TikTok not configured' }, { status: 500 });
  }

  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/tiktok/callback`;

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  // Exchange code for token (TikTok OAuth v2)
  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
    cache: 'no-store',
  });

  const tokenJson = await tokenRes.json().catch(() => ({} as any));
  const tokenData = tokenJson?.data || tokenJson;

  const accessToken = tokenData?.access_token ? String(tokenData.access_token) : '';
  const refreshToken = tokenData?.refresh_token ? String(tokenData.refresh_token) : '';
  const expiresIn = Number(tokenData?.expires_in || 0);
  const expiresAt = Date.now() + Math.max(0, expiresIn) * 1000;
  const openId = tokenData?.open_id ? String(tokenData.open_id) : '';
  const scope = tokenData?.scope ? String(tokenData.scope) : '';

  if (!tokenRes.ok || !accessToken) {
    return NextResponse.json({ error: 'Failed to authenticate with TikTok' }, { status: 400 });
  }

  // Best-effort fetch user profile
  let username = '';
  let displayName = '';
  let avatarUrl = '';
  try {
    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    );
    const userJson = await userRes.json().catch(() => ({} as any));
    const u = userJson?.data?.user || userJson?.data || null;
    username = u?.username ? String(u.username) : '';
    displayName = u?.display_name ? String(u.display_name) : '';
    avatarUrl = u?.avatar_url ? String(u.avatar_url) : '';
  } catch {
    // ignore
  }

  await dbSet(`${CONNECTION_PREFIX}${parsed.slug}`, {
    accessToken,
    refreshToken,
    expiresAt,
    openId,
    scope,
    username,
    displayName,
    avatarUrl,
    connectedAt: new Date().toISOString(),
  });

  const redirectTo = new URL(`/creator/${encodeURIComponent(parsed.slug)}`, url.origin);
  redirectTo.searchParams.set('tiktok', 'connected');

  const res = NextResponse.redirect(redirectTo);
  res.cookies.delete('sv_tiktok_oauth_state');
  return res;
}
