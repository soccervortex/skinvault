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

/**
 * Resolve Steam username to Steam64 ID
 * Supports both custom URLs and Steam64 IDs
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
    }

    // If it's already a Steam64 ID (17 digits), return it
    if (/^\d{17}$/.test(query)) {
      return NextResponse.json({ 
        steamId: query,
        isSteamId: true 
      });
    }

    // Try to resolve as custom URL/username
    // Clean username: extract first part before | or special chars
    // "xottikmw | skinvaults.online" -> "xottikmw"
    let cleanUsername = query.trim();
    
    // If it contains |, take the part before it
    if (cleanUsername.includes('|')) {
      cleanUsername = cleanUsername.split('|')[0].trim();
    }
    
    // Remove special chars that aren't allowed in Steam URLs (keep alphanumeric, underscore, hyphen)
    cleanUsername = cleanUsername.replace(/[^a-zA-Z0-9_-]/g, '');
    
    if (!cleanUsername || cleanUsername.length < 3) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }

    // Method 1: Try Steam Community XML
    try {
      const profileUrl = `https://steamcommunity.com/id/${cleanUsername}/?xml=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(profileUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        cache: 'no-store',
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const text = await response.text();
        const steamId64 = text.match(/<steamID64><!\[CDATA\[(.*?)\]\]><\/steamID64>/)?.[1];
        if (steamId64 && /^\d{17}$/.test(steamId64)) {
          return NextResponse.json({ 
            steamId: steamId64,
            isSteamId: false,
            username: cleanUsername
          });
        }
      }
    } catch (error) {
      // Continue to next method
    }

    // Method 2: Try steamid.io (if available)
    try {
      const steamIdIoUrl = `https://steamid.io/lookup/${encodeURIComponent(cleanUsername)}`;
      const response = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(steamIdIoUrl)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      }, 10000);
      
      if (response.ok) {
        const html = await response.text();
        const steamId64Matches = [
          html.match(/steamID64[^>]*>[\s\S]{0,200}?(\d{17})/i),
          html.match(/7656\d{13}/),
        ].filter((match): match is RegExpMatchArray => match !== null);
        
        for (const match of steamId64Matches) {
          const steamId64 = match[1] || match[0];
          if (steamId64 && /^7656\d{13}$/.test(steamId64)) {
            return NextResponse.json({ 
              steamId: steamId64,
              isSteamId: false,
              username: cleanUsername
            });
          }
        }
      }
    } catch (error) {
      // Ignore
    }

    return NextResponse.json({ 
      error: 'Steam username not found',
      query: cleanUsername
    }, { status: 404 });
  } catch (error: any) {
    console.error('Resolve Steam username error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve Steam username', message: error.message },
      { status: 500 }
    );
  }
}

