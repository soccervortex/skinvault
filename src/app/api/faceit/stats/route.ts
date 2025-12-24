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
      // Faceit API requires both 'game' and 'game_player_id' parameters together
      // Try with CS2 game parameter first
      const params = new URLSearchParams({
        game: 'cs2',
        game_player_id: steamId
      });
      playerUrl = `https://open.faceit.com/data/v4/players?${params.toString()}`;
      playerRes = await fetch(playerUrl, { 
        headers,
        cache: 'no-store' 
      });

      // If not found with CS2, try with CSGO (for backwards compatibility)
      if (!playerRes.ok && playerRes.status === 404) {
        const paramsCSGO = new URLSearchParams({
          game: 'csgo',
          game_player_id: steamId
        });
        playerUrl = `https://open.faceit.com/data/v4/players?${paramsCSGO.toString()}`;
        playerRes = await fetch(playerUrl, { 
          headers,
          cache: 'no-store' 
        });
      }
    } else {
      return NextResponse.json({ error: 'Missing id or nickname parameter' }, { status: 400 });
    }

    if (!playerRes.ok) {
      const errorText = await playerRes.text();
      
      if (playerRes.status === 404) {
        // Player not found - this is normal, not an error
        console.log('Faceit API 404 response:', errorText);
        return NextResponse.json({ 
          error: 'Player not found on Faceit',
          message: 'This Steam account may not be linked to a Faceit account, or the account may not exist on Faceit.'
        }, { status: 404 });
      }
      
      if (playerRes.status === 400) {
        // Bad request - likely parameter issue
        console.error('Faceit API 400 error:', errorText);
        // Try to parse error details
        try {
          const errorData = JSON.parse(errorText);
          return NextResponse.json(
            { error: 'Faceit API error', status: 400, details: errorData },
            { status: 400 }
          );
        } catch {
          return NextResponse.json(
            { error: 'Faceit API error', status: 400, details: errorText },
            { status: 400 }
          );
        }
      }
      
      // Other errors (500, 503, etc.)
      console.error('Faceit API error:', playerRes.status, errorText);
      return NextResponse.json(
        { error: 'Faceit API error', status: playerRes.status, details: errorText },
        { status: playerRes.status >= 500 ? 502 : playerRes.status }
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

