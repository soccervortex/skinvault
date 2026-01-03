import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbSet } from '@/app/utils/database';

const CONNECTION_PREFIX = 'creator_twitch_connection_';

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
  const code = String(url.searchParams.get('code') || '').trim();
  const state = String(url.searchParams.get('state') || '').trim();

  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret) return NextResponse.json({ error: 'SESSION_SECRET not configured' }, { status: 500 });

  const cookieState = req.cookies.get('sv_twitch_oauth_state')?.value || '';
  if (!cookieState || cookieState !== state) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }

  const parsed = verifyState(state, secret);
  if (!parsed) return NextResponse.json({ error: 'Invalid state' }, { status: 400 });

  const clientId = process.env.TWITCH_CLIENT_ID || '';
  const clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Twitch not configured' }, { status: 500 });
  }

  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/twitch/callback`;

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  // Exchange code for token
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?${tokenParams.toString()}`, {
    method: 'POST',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });

  const tokenJson = await tokenRes.json().catch(() => ({} as any));
  if (!tokenRes.ok || !tokenJson?.access_token) {
    return NextResponse.json({ error: 'Failed to authenticate with Twitch' }, { status: 400 });
  }

  const accessToken = String(tokenJson.access_token);
  const refreshToken = String(tokenJson.refresh_token || '');
  const expiresIn = Number(tokenJson.expires_in || 0);
  const expiresAt = Date.now() + Math.max(0, expiresIn) * 1000;

  // Fetch Twitch user profile
  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  const userJson = await userRes.json().catch(() => ({} as any));
  const user = Array.isArray(userJson?.data) ? userJson.data[0] : null;
  const twitchUserId = user?.id ? String(user.id) : '';
  const login = user?.login ? String(user.login) : '';

  await dbSet(`${CONNECTION_PREFIX}${parsed.slug}`, {
    accessToken,
    refreshToken,
    expiresAt,
    twitchUserId,
    login,
    connectedAt: new Date().toISOString(),
  });

  const redirectTo = new URL(`/creator/${encodeURIComponent(parsed.slug)}`, url.origin);
  redirectTo.searchParams.set('twitch', 'connected');

  const res = NextResponse.redirect(redirectTo);
  res.cookies.delete('sv_twitch_oauth_state');
  return res;
}
