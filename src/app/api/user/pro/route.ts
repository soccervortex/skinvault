import { NextResponse } from 'next/server';
import { getProUntil } from '@/app/utils/pro-storage';
import { sanitizeSteamId } from '@/app/utils/sanitize';

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

    const proUntil = await getProUntil(steamId);
    return NextResponse.json({ proUntil });
  } catch (error) {
    console.error('Failed to get Pro status:', error);
    return NextResponse.json({ error: 'Failed to get Pro status' }, { status: 500 });
  }
}

