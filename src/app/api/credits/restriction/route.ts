import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const st = await getCreditsRestrictionStatus(steamId);
    const res = NextResponse.json({ ok: true, steamId, ...st }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load restriction status' }, { status: 500 });
  }
}
