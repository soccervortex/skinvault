import { NextResponse } from 'next/server';

const PRIME_UPGRADE_APPID = 624820;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const steamId = searchParams.get('steamId') || searchParams.get('id');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId parameter' }, { status: 400 });
    }

    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'STEAM_API_KEY not configured' }, { status: 500 });
    }

    // Check if user owns the CS:GO Prime Status Upgrade (appid 624820)
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_played_free_games=1&appids_filter[0]=${PRIME_UPGRADE_APPID}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Steam API error', status: res.status },
        { status: 502 }
      );
    }

    const json = await res.json();
    const games = json?.response?.games;

    // If profile is private, Steam may omit games; treat as unknown/non-prime for UI.
    const prime = Array.isArray(games) && games.some((g: any) => Number(g?.appid) === PRIME_UPGRADE_APPID);

    return NextResponse.json({ prime });
  } catch (e) {
    console.error('Steam prime proxy failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
