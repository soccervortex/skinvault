import { NextResponse } from 'next/server';

// Proxy endpoints for fetching Steam inventory (server-side to avoid CORS)
const PROXIES = [
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://cors-anywhere.herokuapp.com/${url}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://yacdn.org/proxy/${url}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}&_nocache=1`,
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&_nocache=1`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}?_nocache=1`,
];

async function fetchWithProxy(url: string, proxyIndex: number = 0): Promise<any> {
  if (proxyIndex >= PROXIES.length) {
    throw new Error('All proxies failed');
  }

  const proxyUrl = PROXIES[proxyIndex](url);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Proxy ${proxyIndex} returned ${response.status}`);
    }

    const text = await response.text();
    
    // Handle different proxy response formats
    if (proxyUrl.includes('allorigins.win')) {
      try {
        const json = JSON.parse(text);
        if (json.contents) {
          return JSON.parse(json.contents);
        }
        return json;
      } catch {
        // If parsing fails, try direct JSON
        return JSON.parse(text);
      }
    }
    
    // Direct JSON response
    return JSON.parse(text);
  } catch (error) {
    // Try next proxy if not the last one
    if (proxyIndex + 1 < PROXIES.length) {
      return fetchWithProxy(url, proxyIndex + 1);
    }
    throw error;
  }
}

// Resolve vanity URL to Steam ID64
async function resolveVanityUrl(vanityUrl: string): Promise<string | null> {
  try {
    const apiKey = process.env.STEAM_API_KEY || '72E5A9A17321670AD00D422453056898';
    const resolveUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${encodeURIComponent(vanityUrl)}`;
    
    const response = await fetch(resolveUrl, {
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    if (data?.response?.steamid) {
      return data.response.steamid;
    }
    
    return null;
  } catch (error) {
    console.error('Vanity URL resolution failed:', error);
    return null;
  }
}

// Fetch Steam inventory (server-side proxy to avoid CORS)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    let steamId = url.searchParams.get('steamId');
    const startAssetId = url.searchParams.get('start_assetid');
    const isPro = url.searchParams.get('isPro') === 'true';

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Check if it's a vanity URL (not numeric Steam ID64)
    // Steam ID64 is always 17 digits
    if (!/^\d{17}$/.test(steamId)) {
      // Try to resolve vanity URL to Steam ID
      const resolvedId = await resolveVanityUrl(steamId);
      if (resolvedId) {
        steamId = resolvedId;
      } else {
        // If resolution fails, try using the vanity URL directly (Steam API might accept it)
        // But prefer numeric ID, so we'll still try but log a warning
        console.warn(`Could not resolve vanity URL: ${steamId}, trying direct access`);
      }
    }

    let invUrl = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`;
    if (startAssetId) {
      invUrl += `&start_assetid=${startAssetId}`;
    }

    // Use more proxies for Pro users
    const maxProxies = isPro ? PROXIES.length : 3;
    const proxyList = PROXIES.slice(0, maxProxies);

    // Try proxies sequentially
    let lastError: any = null;
    for (let i = 0; i < proxyList.length; i++) {
      try {
        const data = await fetchWithProxy(invUrl, i);
        
        if (data && (data.descriptions || data.assets || data.success !== false)) {
          return NextResponse.json(data);
        }
        // If data exists but doesn't have expected structure, try next proxy
        if (i === proxyList.length - 1) {
          lastError = new Error('Invalid response structure');
        }
      } catch (error) {
        lastError = error;
        // Continue to next proxy if not the last one
        if (i < proxyList.length - 1) {
          continue;
        }
      }
    }

    // All proxies failed
    return NextResponse.json(
      { error: lastError?.message || 'All proxies failed', details: 'Unable to fetch Steam inventory' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Steam inventory fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

