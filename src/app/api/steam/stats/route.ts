import { NextResponse } from 'next/server';

// Server-side Steam stats proxy to avoid CORS/proxy issues in the browser.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const steamId = searchParams.get('id');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const apiKey = process.env.STEAM_API_KEY || '0FC9C1CEBB016CB0B78642A67680F500';
    const url = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=730&key=${apiKey}&steamid=${steamId}`;

    // Add timeout and abort controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const res = await fetch(url, { 
        cache: 'no-store',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Steam API error', status: res.status },
          { status: res.status >= 500 ? 502 : res.status }
        );
      }

      const json = await res.json();
      return NextResponse.json(json);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (e: any) {
    console.error('Steam stats proxy failed', e);
    return NextResponse.json(
      { error: e.message || 'Internal error' },
      { status: 500 }
    );
  }
}


