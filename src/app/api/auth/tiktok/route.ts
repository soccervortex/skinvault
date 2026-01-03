import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbGet } from '@/app/utils/database';
import type { CreatorProfile } from '@/data/creators';

const CREATORS_KEY = 'creators_v1';
const STATE_TTL_SECONDS = 60 * 10;

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function makeState(slug: string, steamId: string, secret: string): string {
  const obj = { slug, steamId, iat: Date.now() };
  const payload = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const sig = signPayload(payload, secret);
  return `${payload}.${sig}`;
}

function readSteamSession(req: NextRequest): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret) return '';
  const raw = req.cookies.get('sv_steam_session')?.value || '';
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return '';
  const expected = signPayload(payload, secret);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return '';
  } catch {
    return '';
  }
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return String(json?.steamId || '').trim();
  } catch {
    return '';
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = String(url.searchParams.get('slug') || '').trim();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const steamId = readSteamSession(req);
  if (!steamId) return NextResponse.json({ error: 'Not signed in with Steam' }, { status: 401 });

  const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
  if (!clientKey || !clientSecret) {
    return NextResponse.json({ error: 'TikTok not configured' }, { status: 500 });
  }

  const creators = await dbGet<CreatorProfile[]>(CREATORS_KEY, false);
  const creator = Array.isArray(creators)
    ? creators.find((c) => String(c.slug).toLowerCase() === slug.toLowerCase())
    : null;
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

  const ownerSteamId = String((creator as any)?.partnerSteamId || '').trim();
  if (!ownerSteamId || ownerSteamId !== steamId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/tiktok/callback`;

  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret) return NextResponse.json({ error: 'SESSION_SECRET not configured' }, { status: 500 });

  const state = makeState(slug, steamId, secret);

  // TikTok Login Kit (Web)
  // Scopes should match what you enabled in the TikTok developer portal.
  const scope = 'user.info.basic,video.list';

  const authParams = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
  });

  const res = NextResponse.redirect(`https://www.tiktok.com/v2/auth/authorize/?${authParams.toString()}`);
  res.cookies.set({
    name: 'sv_tiktok_oauth_state',
    value: state,
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: STATE_TTL_SECONDS,
    path: '/api/auth/tiktok/callback',
  });

  return res;
}
