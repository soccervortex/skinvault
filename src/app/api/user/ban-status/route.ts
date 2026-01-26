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
    // Return 401 to avoid leaking ban status for arbitrary steamIds.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const banned = (await dbGet<string[]>(BANNED_KEY)) || [];
    return NextResponse.json({ steamId, banned: banned.includes(steamId) }, { status: 200 });
  } catch (error) {
    console.error('Failed to check ban status:', error);
    return NextResponse.json({ steamId, banned: false }, { status: 200 });
  }
}
