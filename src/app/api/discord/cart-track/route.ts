import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const steamId = String(body?.steamId || '').trim();
    const fromCookie = getSteamIdFromRequest(request);

    if (!/^\d{17}$/.test(steamId)) {
      return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    }

    if (!fromCookie || String(fromCookie) !== steamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Cart tracking disabled' }, { status: 410 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Cart tracking disabled' }, { status: 500 });
  }
}
