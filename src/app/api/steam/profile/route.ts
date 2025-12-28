import { NextResponse } from 'next/server';

// Server-side Steam profile fetcher (no proxies needed - server can fetch directly)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId') || searchParams.get('id');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId parameter' }, { status: 400 });
    }

    // Server-side fetch doesn't need proxies - we can fetch directly from Steam
    const steamUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const textRes = await fetch(steamUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        cache: 'no-store',
      });
      
      clearTimeout(timeoutId);
      
      if (textRes.ok) {
        const text = await textRes.text();
        const nameMatch = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
        const avatarMatch = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
        
        const name = nameMatch?.[1] || 'Unknown User';
        const avatar = avatarMatch?.[1] || '';
        
        return NextResponse.json({ 
          steamId,
          name, 
          avatar,
        });
      } else {
        return NextResponse.json(
          { error: 'Steam profile not found', status: textRes.status },
          { status: textRes.status }
        );
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 408 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Steam profile fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Steam profile' },
      { status: 500 }
    );
  }
}

