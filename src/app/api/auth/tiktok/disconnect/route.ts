import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbDelete, dbGet } from '@/app/utils/database';
import { isOwner } from '@/app/utils/owner-ids';
import type { CreatorProfile } from '@/data/creators';

const CREATORS_KEY = 'creators_v1';
const TIKTOK_CONNECTION_PREFIX = 'creator_tiktok_connection_';

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
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

  const creators = await dbGet<CreatorProfile[]>(CREATORS_KEY, false);
  const creator = Array.isArray(creators) ? creators.find((c) => String(c.slug).toLowerCase() === slug.toLowerCase()) : null;
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

  const ownerSteamId = String((creator as any)?.partnerSteamId || '').trim();
  const canManage = isOwner(steamId) || (!!ownerSteamId && ownerSteamId === steamId);
  if (!canManage) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  await dbDelete(`${TIKTOK_CONNECTION_PREFIX}${creator.slug}`);
  await dbDelete(`creator_snapshot_${creator.slug}`);

  const redirectTo = new URL(`/creator/${encodeURIComponent(creator.slug)}`, url.origin);
  redirectTo.searchParams.set('tiktok', 'disconnected');
  return NextResponse.redirect(redirectTo);
}
