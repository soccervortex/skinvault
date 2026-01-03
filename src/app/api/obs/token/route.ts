import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbGet } from '@/app/utils/database';
import { getCreatorBySlug, type CreatorProfile } from '@/data/creators';
import { isOwner } from '@/app/utils/owner-ids';

const COOKIE_NAME = 'sv_steam_session';
const CREATORS_KEY = 'creators_v1';

function verifySteamSessionCookie(value: string, secret: string): { steamId: string } | null {
  const v = String(value || '');
  const [payload, sig] = v.split('.');
  if (!payload || !sig) return null;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }

  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const steamId = String(json?.steamId || '').trim();
    if (!steamId) return null;
    return { steamId };
  } catch {
    return null;
  }
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function findCreatorInList(creators: CreatorProfile[], slug: string): CreatorProfile | null {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return null;
  return (
    creators.find((c) => {
      if (String(c?.slug || '').toLowerCase() === s) return true;
      const aliases = Array.isArray((c as any)?.slugAliases) ? (c as any).slugAliases : [];
      return aliases.some((a: unknown) => String(a || '').toLowerCase() === s);
    }) || null
  );
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const slug = String(url.searchParams.get('slug') || '').trim();
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const storedCreators = await dbGet<CreatorProfile[]>(CREATORS_KEY, false);
    const creatorFromDb = Array.isArray(storedCreators) ? findCreatorInList(storedCreators, slug) : null;
    const creator = creatorFromDb || getCreatorBySlug(slug);
    if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const partnerSteamId = String(creator.partnerSteamId || '').trim();
    if (!partnerSteamId) return NextResponse.json({ error: 'Creator has no partnerSteamId' }, { status: 400 });

    const cookie = req.cookies.get(COOKIE_NAME)?.value || '';
    const sessionSecret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
    const session = cookie && sessionSecret ? verifySteamSessionCookie(cookie, sessionSecret) : null;

    if (!session?.steamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowed = isOwner(session.steamId) || String(session.steamId) === partnerSteamId;
    if (!isAllowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const obsSecret = String(process.env.OBS_OVERLAY_SECRET || '').trim();
    if (!obsSecret) return NextResponse.json({ error: 'OBS_OVERLAY_SECRET not configured' }, { status: 500 });

    const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
    const payloadObj = { steamId: partnerSteamId, exp };
    const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
    const sig = signPayload(payload, obsSecret);
    const token = `${payload}.${sig}`;

    const origin = process.env.NEXT_PUBLIC_BASE_URL || url.origin;
    const overlayUrl = `${origin.replace(/\/$/, '')}/obs/vault?token=${encodeURIComponent(token)}`;

    return NextResponse.json({ url: overlayUrl, expiresAt: new Date(exp).toISOString() }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to issue token' }, { status: 500 });
  }
}
