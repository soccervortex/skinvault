import { NextResponse } from 'next/server';

// Server-side Steam stats proxy to avoid CORS/proxy issues in the browser.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const steamId = searchParams.get('id');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'STEAM_API_KEY not configured' }, { status: 500 });
    }
    const url = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=730&key=${apiKey}&steamid=${steamId}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Steam API error', status: res.status },
        { status: 502 }
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (e) {
    console.error('Steam stats proxy failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


