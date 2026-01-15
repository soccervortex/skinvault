import { NextResponse } from 'next/server';

// Server-side Steam stats proxy to avoid CORS/proxy issues in the browser.
export const runtime = 'nodejs';

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 60 },
    }).finally(() => clearTimeout(timeoutId));
    if (!res.ok) {
      const upstreamStatus = res.status;
      console.warn('Steam stats upstream error', { upstreamStatus, steamId });

      // Steam commonly uses 403 for private stats / not authorized.
      if (upstreamStatus === 401 || upstreamStatus === 403) {
        return NextResponse.json({ error: 'Stats private' }, { status: 404 });
      }

      // Rate-limited / temporary Steam issues.
      if (upstreamStatus === 429 || upstreamStatus === 503) {
        return NextResponse.json({ error: 'Steam API temporarily unavailable', status: upstreamStatus }, { status: 503 });
      }

      return NextResponse.json(
        { error: 'Steam API error', status: upstreamStatus },
        { status: 502 }
      );
    }

    const json = await res.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: 'Invalid response from Steam' }, { status: 502 });
    }
    return NextResponse.json(json, { status: 200 });
  } catch (e) {
    if ((e as any)?.name === 'AbortError') {
      return NextResponse.json({ error: 'Steam API timeout' }, { status: 504 });
    }
    console.error('Steam stats proxy failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
