import { NextResponse } from 'next/server';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { dbGet } from '@/app/utils/database';
import { OWNER_STEAM_IDS } from '@/app/utils/owner-ids';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawSteamId = url.searchParams.get('id');

    if (!rawSteamId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    // Sanitize and validate SteamID
    const steamId = sanitizeSteamId(rawSteamId);
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    const data = (await dbGet<Record<string, string>>('pro_users', false)) || {};
    let proUntil = data[steamId] || null;
    if ((OWNER_STEAM_IDS as any).includes(steamId) && !proUntil) {
      proUntil = '2999-01-01T00:00:00.000Z';
    }

    const res = NextResponse.json({ proUntil });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error) {
    console.error('Failed to get Pro status:', error);
    return NextResponse.json({ error: 'Failed to get Pro status' }, { status: 500 });
  }
}

