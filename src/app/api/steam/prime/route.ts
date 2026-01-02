import { NextResponse } from 'next/server';

const PRIME_UPGRADE_APPID = 624820;

function parseOverrideSteamIds(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const steamId = searchParams.get('steamId') || searchParams.get('id');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId parameter' }, { status: 400 });
    }

    const overrideIds = parseOverrideSteamIds(process.env.PRIME_OVERRIDE_STEAMIDS);
    if (overrideIds.has(steamId)) {
      return NextResponse.json({ prime: true, source: 'override' });
    }

    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'STEAM_API_KEY not configured' }, { status: 500 });
    }

    // Check if user owns the CS:GO Prime Status Upgrade (appid 624820)
    // NOTE: CheckAppOwnership is publisher-restricted and returns 403 for normal keys.
    // GetOwnedGames works with normal Steam Web API keys, but may return empty if the profile's game details are private.
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_played_free_games=1&appids_filter[0]=${PRIME_UPGRADE_APPID}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });

      if (!res.ok) {
        // Return a non-fatal response so the UI doesn't break/spam errors.
        return NextResponse.json({ prime: null, error: 'Steam API error', status: res.status });
      }

      const json = await res.json();
      const games = json?.response?.games;
      if (!Array.isArray(games)) {
        return NextResponse.json({ prime: null, source: 'steam_owned_games' });
      }

      const prime = games.some((g: any) => Number(g?.appid) === PRIME_UPGRADE_APPID);
      return NextResponse.json({ prime, source: 'steam_owned_games' });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    console.error('Steam prime proxy failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
