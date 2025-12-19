import { NextResponse } from 'next/server';

// Proxy endpoints for fetching Steam inventory (server-side to avoid CORS)
const PROXIES = [
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://yacdn.org/proxy/${url}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}&_nocache=1`,
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&_nocache=1`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}?_nocache=1`,
  // Additional proxies for better reliability
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&_nocache=1`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}&_t=${Date.now()}`,
];

async function fetchWithProxy(url: string, proxyIndex: number = 0): Promise<any> {
  if (proxyIndex >= PROXIES.length) {
    throw new Error('All proxies failed');
  }

  const proxyUrl = PROXIES[proxyIndex](url);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  
  try {
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
    clearTimeout(timeoutId);
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
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      console.error('STEAM_API_KEY not configured');
      return null;
    }
    const resolveUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${encodeURIComponent(vanityUrl)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(resolveUrl, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      if (data?.response?.steamid) {
        return data.response.steamid;
      }
      
      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
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
    const errors: string[] = [];
    for (let i = 0; i < proxyList.length; i++) {
      try {
        const data = await fetchWithProxy(invUrl, i);
        
        // Steam inventory API can return:
        // - { success: false } for private inventories
        // - { assets: [], descriptions: [] } for public inventories
        // - { rgInventory: {}, rgDescriptions: {} } for older format
        if (data && typeof data === 'object') {
          // Check if it's a valid Steam inventory response
          if (data.success === false) {
            // Private inventory - this is a valid response
            return NextResponse.json({ 
              success: false, 
              error: 'Inventory is private',
              assets: [],
              descriptions: []
            });
          }
          
          // Check for valid inventory structure
          if (data.descriptions || data.assets || data.rgDescriptions || data.rgInventory) {
            // Success - return the data
            return NextResponse.json(data);
          }
        }
        
        // If data exists but doesn't have expected structure, try next proxy
        if (i === proxyList.length - 1) {
          lastError = new Error('Invalid response structure from all proxies');
          errors.push('Invalid response structure');
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        errors.push(`Proxy ${i}: ${errorMsg}`);
        lastError = error;
        // Continue to next proxy if not the last one
        if (i < proxyList.length - 1) {
          continue;
        }
      }
    }

    // All proxies failed - log detailed error
    console.error('All inventory proxies failed:', {
      steamId,
      isPro,
      errors: errors.join('; '),
      lastError: lastError?.message,
    });

    // All proxies failed
    return NextResponse.json(
      { 
        error: lastError?.message || 'All proxies failed', 
        details: 'Unable to fetch Steam inventory',
        proxyErrors: errors,
      },
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

