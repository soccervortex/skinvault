import { NextResponse } from 'next/server';

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...(init || {}), signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

type Cached = {
  updatedAt: number;
  data: any;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    if (!/^\d{17}$/.test(steamId)) {
      return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    }

    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'STEAM_API_KEY not configured' }, { status: 500 });
    }

    const { dbGet, dbSet } = await import('@/app/utils/database');

    const cacheKey = `cs2_overview_${steamId}`;
    const cached = await dbGet<Cached>(cacheKey, true);
    if (cached?.updatedAt && cached.data && Date.now() - cached.updatedAt < 60_000 * 30) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    const summariesUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
    const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=0&include_played_free_games=1`;
    const recentUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${steamId}`;

    const [summariesRes, ownedRes, recentRes] = await Promise.allSettled([
      fetchWithTimeout(summariesUrl, { cache: 'no-store' }, 8000),
      fetchWithTimeout(ownedGamesUrl, { cache: 'no-store' }, 8000),
      fetchWithTimeout(recentUrl, { cache: 'no-store' }, 8000),
    ]);

    const summariesJson =
      summariesRes.status === 'fulfilled' && summariesRes.value.ok ? await summariesRes.value.json().catch(() => null) : null;
    const ownedJson =
      ownedRes.status === 'fulfilled' && ownedRes.value.ok ? await ownedRes.value.json().catch(() => null) : null;
    const recentJson =
      recentRes.status === 'fulfilled' && recentRes.value.ok ? await recentRes.value.json().catch(() => null) : null;

    const player = summariesJson?.response?.players?.[0] || null;
    const lastLogoff = typeof player?.lastlogoff === 'number' ? player.lastlogoff : null;

    const ownedGames: any[] = Array.isArray(ownedJson?.response?.games) ? ownedJson.response.games : [];
    const cs2Owned = ownedGames.find((g) => Number(g?.appid) === 730) || null;

    const recentGames: any[] = Array.isArray(recentJson?.response?.games) ? recentJson.response.games : [];
    const cs2Recent = recentGames.find((g) => Number(g?.appid) === 730) || null;

    const data = {
      steamId,
      updatedAt: Date.now(),
      hasCs2: !!cs2Owned,
      playtimeForeverMinutes: typeof cs2Owned?.playtime_forever === 'number' ? cs2Owned.playtime_forever : null,
      playtime2WeeksMinutes: typeof cs2Recent?.playtime_2weeks === 'number' ? cs2Recent.playtime_2weeks : null,
      recentlyPlayed: !!cs2Recent,
      lastLogoff,
    };

    await dbSet(cacheKey, { updatedAt: Date.now(), data });

    return NextResponse.json({ ...data, cached: false });
  } catch (e) {
    console.error('CS2 overview failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
