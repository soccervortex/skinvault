import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { sanitizeSteamId } from '@/app/utils/sanitize';
import { dbGet } from '@/app/utils/database';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

const BANNED_KEY = 'banned_steam_ids';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawSteamId = url.searchParams.get('steamId');
  const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;

  if (!steamId) {
    return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
  }

  // Only allow:
  // - the user themselves (via sv_steam_session cookie)
  // - owners (admins) to check anyone
  const requesterSteamId = getSteamIdFromRequest(req);
  const canCheck = requesterSteamId === steamId || isOwner(requesterSteamId);
  if (!canCheck) {
    // Do not leak ban status for arbitrary steamIds.
    // Return a safe default (banned: false) so the client doesn't spam 401s.
    const res = NextResponse.json({ steamId, banned: false }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  }

  try {
    const banned = (await dbGet<string[]>(BANNED_KEY)) || [];
    const res = NextResponse.json({ steamId, banned: banned.includes(steamId) }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error) {
    console.error('Failed to check ban status:', error);
    const res = NextResponse.json({ steamId, banned: false }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  }
}
