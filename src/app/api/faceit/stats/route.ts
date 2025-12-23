import { NextResponse } from 'next/server';

// Server-side Faceit stats proxy to avoid CORS/proxy issues in the browser.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const steamId = searchParams.get('id');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    // Faceit API key is optional for public endpoints, but recommended for rate limits
    const apiKey = process.env.FACEIT_API_KEY;
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // First, get the Faceit player ID from Steam ID
    const playerUrl = `https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${steamId}`;
    const playerRes = await fetch(playerUrl, { 
      headers,
      cache: 'no-store' 
    });

    if (!playerRes.ok) {
      if (playerRes.status === 404) {
        return NextResponse.json({ error: 'Player not found on Faceit' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Faceit API error', status: playerRes.status },
        { status: 502 }
      );
    }

    const playerData = await playerRes.json();
    const playerId = playerData?.player_id;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID not found' }, { status: 404 });
    }

    // Get player stats for CS2
    const statsUrl = `https://open.faceit.com/data/v4/players/${playerId}/stats/cs2`;
    const statsRes = await fetch(statsUrl, { 
      headers,
      cache: 'no-store' 
    });

    let statsData = null;
    if (statsRes.ok) {
      statsData = await statsRes.json();
    } else if (statsRes.status !== 404) {
      // Only return error if it's not a 404 (stats might not be available yet)
      return NextResponse.json(
        { error: 'Faceit stats API error', status: statsRes.status },
        { status: 502 }
      );
    }
    
    return NextResponse.json({
      player: playerData,
      stats: statsData
    });
  } catch (e) {
    console.error('Faceit stats proxy failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

