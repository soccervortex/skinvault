import { NextResponse } from 'next/server';

// Server-side Faceit stats proxy to avoid CORS/proxy issues in the browser.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const steamId = searchParams.get('id');
    const nickname = searchParams.get('nickname');

    if (!steamId && !nickname) {
      return NextResponse.json({ error: 'Missing id or nickname parameter' }, { status: 400 });
    }

    // Faceit API key is optional for public endpoints, but recommended for rate limits
    const apiKey = process.env.FACEIT_API_KEY;
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // First, get the Faceit player ID
    let playerUrl: string;
    let playerRes: Response;

    if (nickname) {
      // Try by nickname first if provided
      playerUrl = `https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname)}`;
      playerRes = await fetch(playerUrl, { 
        headers,
        cache: 'no-store' 
      });
    } else if (steamId) {
      // Try with CS2 game parameter first
      playerUrl = `https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${steamId}`;
      playerRes = await fetch(playerUrl, { 
        headers,
        cache: 'no-store' 
      });

      // If not found with CS2, try without game parameter (for CS:GO/CS2 compatibility)
      if (!playerRes.ok && playerRes.status === 404) {
        playerUrl = `https://open.faceit.com/data/v4/players?game_player_id=${steamId}`;
        playerRes = await fetch(playerUrl, { 
          headers,
          cache: 'no-store' 
        });
      }
    } else {
      return NextResponse.json({ error: 'Missing id or nickname parameter' }, { status: 400 });
    }

    if (!playerRes.ok) {
      if (playerRes.status === 404) {
        // Try to get more info from the response
        const errorText = await playerRes.text();
        console.log('Faceit API 404 response:', errorText);
        return NextResponse.json({ 
          error: 'Player not found on Faceit',
          message: 'This Steam account may not be linked to a Faceit account, or the account may not exist on Faceit.'
        }, { status: 404 });
      }
      const errorText = await playerRes.text();
      console.error('Faceit API error:', playerRes.status, errorText);
      return NextResponse.json(
        { error: 'Faceit API error', status: playerRes.status, details: errorText },
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

