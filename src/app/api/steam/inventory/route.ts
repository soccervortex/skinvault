import { NextResponse } from 'next/server';

// Scraping service proxies (more reliable than free proxies)
function getScrapingProxies(): Array<(url: string) => string> {
  const proxies: Array<(url: string) => string> = [];
  
  // ScraperAPI
  const scraperApiKey = process.env.SCRAPERAPI_KEY_1;
  if (scraperApiKey) {
    proxies.push((url: string) => 
      `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`
    );
  }
  
  // ZenRows
  const zenRowsKey = process.env.ZENROWS_API_KEY;
  if (zenRowsKey) {
    proxies.push((url: string) => 
      `https://api.zenrows.com/v1/?apikey=${zenRowsKey}&url=${encodeURIComponent(url)}`
    );
  }
  
  // ScrapingAnt (multiple keys for rotation)
  const scrapingAntKeys = [
    process.env.SCRAPINGANT_API_KEY_1,
    process.env.SCRAPINGANT_API_KEY_2,
    process.env.SCRAPINGANT_API_KEY_3,
    process.env.SCRAPINGANT_API_KEY_4,
  ].filter(Boolean);
  
  scrapingAntKeys.forEach((key) => {
    if (key) {
      proxies.push((url: string) => 
        `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(url)}&x-api-key=${key}`
      );
    }
  });
  
  return proxies;
}

// Fallback free proxies (used if scraping services fail)
const FALLBACK_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://yacdn.org/proxy/${url}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}&_nocache=1`,
];

// Get all proxies (scraping services first, then fallbacks)
function getAllProxies(): Array<(url: string) => string> {
  return [...getScrapingProxies(), ...FALLBACK_PROXIES];
}

async function fetchWithProxy(
  url: string, 
  proxyIndex: number = 0, 
  retryCount: number = 0,
  proxyList: Array<(url: string) => string> = getAllProxies()
): Promise<any> {
  if (proxyIndex >= proxyList.length) {
    throw new Error('All proxies failed');
  }

  const proxyUrl = proxyList[proxyIndex](url);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
  
  try {
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle specific error codes with retry logic
    if (response.status === 429 || response.status === 408) {
      const errorMsg = response.status === 429 ? 'Rate limit (429)' : 'Timeout (408)';
      console.warn(`Proxy ${proxyIndex} ${errorMsg}, retrying...`);
      
      // Wait 2 seconds and retry once
      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchWithProxy(url, proxyIndex, retryCount + 1, proxyList);
      }
      // If retry also failed, try next proxy
      throw new Error(`${errorMsg} after retry`);
    }

    if (!response.ok) {
      throw new Error(`Proxy ${proxyIndex} returned ${response.status}`);
    }

    const text = await response.text();
    
    // Handle different proxy response formats
    let data: any;
    try {
      const json = JSON.parse(text);
      
      // ScrapingAnt returns data in 'content' field
      if (json.content) {
        try {
          data = JSON.parse(json.content);
        } catch {
          data = json.content; // Might be HTML/text
        }
      }
      // ScraperAPI returns direct content
      else if (json.body) {
        try {
          data = JSON.parse(json.body);
        } catch {
          data = json.body;
        }
      }
      // ZenRows returns direct content
      else if (json.html || json.text) {
        try {
          data = JSON.parse(json.html || json.text);
        } catch {
          data = json;
        }
      }
      // Standard JSON response
      else {
        data = json;
      }
    } catch {
      // If parsing fails, try direct JSON
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON response');
      }
    }
    
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Log specific error types
    if (error.name === 'AbortError') {
      console.warn(`Proxy ${proxyIndex} timeout/aborted`);
    } else if (error.message?.includes('429') || error.message?.includes('408')) {
      console.warn(`Proxy ${proxyIndex} ${error.message}`);
    } else {
      console.warn(`Proxy ${proxyIndex} error:`, error.message || error);
    }
    
    // Try next proxy if not the last one
    if (proxyIndex + 1 < proxyList.length) {
      return fetchWithProxy(url, proxyIndex + 1, 0, proxyList);
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

// Fetch inventory using official Steam Web API (IEconItems_730/GetPlayerItems)
// This is the official Steam API method for CS2 inventories
async function fetchInventoryViaSteamWebAPI(steamId: string): Promise<any> {
  try {
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      return null;
    }
    
    // Official Steam Web API endpoint for CS2 inventories
    // IEconItems_730/GetPlayerItems/v0001/
    const apiUrl = `https://api.steampowered.com/IEconItems_730/GetPlayerItems/v0001/?key=${apiKey}&SteamID=${steamId}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Steam Web API returns items in a different format
    // Convert to standard Steam inventory format
    if (data?.result && data.result.items) {
      const items = data.result.items;
      const assets: any[] = [];
      const descriptions: any[] = [];
      
      // Create a map of unique items by classid_instanceid
      const itemMap = new Map<string, any>();
      
      items.forEach((item: any) => {
        const key = `${item.classid}_${item.instanceid || 0}`;
        if (!itemMap.has(key)) {
          itemMap.set(key, item);
        }
      });
      
      // Convert to assets and descriptions format
      itemMap.forEach((item) => {
        assets.push({
          assetid: item.id || item.assetid,
          classid: item.classid,
          instanceid: item.instanceid || 0,
          amount: item.amount || 1,
        });
        
        descriptions.push({
          classid: item.classid,
          instanceid: item.instanceid || 0,
          market_hash_name: item.market_hash_name || item.market_name,
          icon_url: item.icon_url || item.icon_url_large,
          tradable: item.tradable !== 0,
          marketable: item.marketable !== 0,
        });
      });
      
      return { assets, descriptions, success: true };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Fetch inventory using third-party APIs (like skinpock.com uses)
async function fetchInventoryViaAPI(steamId: string, apiType: 'steamwebapi' | 'csinventoryapi' | 'steamapis'): Promise<any> {
  try {
    let apiUrl = '';
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    if (apiType === 'steamwebapi') {
      const apiKey = process.env.STEAM_WEB_API_KEY || 'HA8REWE7GQER9I0N';
      apiUrl = `https://api.steamwebapi.com/steam/api/inventory?key=${apiKey}&steamid=${steamId}&appid=730&contextid=2`;
      headers['X-API-Key'] = apiKey;
    } else if (apiType === 'csinventoryapi') {
      const apiKey = process.env.CS_INVENTORY_API_KEY || '3f85b8d7-7731-43ba-8124-e015015d9c84';
      apiUrl = `https://csinventoryapi.com/api/v1/inventory?steamid=${steamId}&apikey=${apiKey}`;
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (apiType === 'steamapis') {
      // SteamApis format
      const apiKey = process.env.STEAMAPIS_KEY;
      if (!apiKey) return null;
      apiUrl = `https://api.steamapis.com/steam/inventory/${steamId}/730/2?api_key=${apiKey}`;
    }

    if (!apiUrl) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(apiUrl, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Convert different API formats to Steam format
    if (data.data && Array.isArray(data.data)) {
      // CSInventoryAPI format
      const assets: any[] = [];
      const descriptions: any[] = [];
      data.data.forEach((item: any, idx: number) => {
        assets.push({
          assetid: item.assetid || item.id || `temp_${idx}`,
          classid: item.classid || item.class_id,
          instanceid: item.instanceid || item.instance_id || 0,
          amount: item.amount || 1,
        });
        descriptions.push({
          classid: item.classid || item.class_id,
          instanceid: item.instanceid || item.instance_id || 0,
          market_hash_name: item.market_hash_name || item.name,
          icon_url: item.icon_url || item.icon,
          tradable: item.tradable !== false,
          marketable: item.marketable !== false,
        });
      });
      return { assets, descriptions, success: true };
    }
    
    // SteamWebAPI or SteamApis format (closer to Steam format)
    if (data.assets || data.descriptions || data.items) {
      return {
        assets: data.assets || data.items || [],
        descriptions: data.descriptions || [],
        success: true,
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Fetch Steam inventory (server-side proxy to avoid CORS)
// Uses multiple methods: direct Steam API, proxies, and third-party APIs (like skinpock.com)
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
        console.warn(`Could not resolve vanity URL: ${steamId}, trying direct access`);
      }
    }

    // METHOD 1: Try official Steam Web API FIRST (100% working method - highest priority)
    // This is the official Steam API endpoint for CS2 inventories (IEconItems_730/GetPlayerItems)
    try {
      const steamWebAPIData = await fetchInventoryViaSteamWebAPI(steamId);
      if (steamWebAPIData && (steamWebAPIData.assets || steamWebAPIData.descriptions)) {
        console.log('✅ Inventory fetched via Official Steam Web API');
        return NextResponse.json(steamWebAPIData);
      }
    } catch (error) {
      console.warn('⚠️ Official Steam Web API failed, trying next method:', error);
    }

    // METHOD 2: Try third-party APIs (SteamWebAPI, CSInventoryAPI, SteamApis)
    // These are reliable services that specialize in Steam inventory data
    const thirdPartyAPIs: Array<'steamwebapi' | 'csinventoryapi' | 'steamapis'> = ['steamwebapi', 'csinventoryapi', 'steamapis'];
    for (const apiType of thirdPartyAPIs) {
      try {
        const data = await fetchInventoryViaAPI(steamId, apiType);
        if (data && (data.assets || data.descriptions)) {
          console.log(`✅ Inventory fetched via third-party API: ${apiType}`);
          return NextResponse.json(data);
        }
      } catch (error) {
        console.warn(`⚠️ Third-party API ${apiType} failed, trying next...`);
        continue;
      }
    }

    // METHOD 3: Try direct Steam Community API with scraping services (ScraperAPI, ZenRows, ScrapingAnt)
    // These use API keys and are more reliable than free proxies
    let invUrl = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`;
    if (startAssetId) {
      invUrl += `&start_assetid=${startAssetId}`;
    }

    // Get scraping services first (with API keys), then fallback free proxies
    const scrapingProxies = getScrapingProxies();
    const allProxies = getAllProxies(); // This includes scraping + fallback
    
    // Pro users get more proxies, free users get limited
    // Prioritize scraping services (with API keys) over free proxies
    const maxProxies = isPro ? allProxies.length : Math.min(
      scrapingProxies.length > 0 ? scrapingProxies.length + 2 : 3, // Prefer scraping services
      allProxies.length
    );
    const proxyList = allProxies.slice(0, maxProxies);

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
          
          // Check if it's an empty inventory (valid response)
          if (data.success === true && (!data.descriptions || data.descriptions.length === 0)) {
            return NextResponse.json({
              success: true,
              assets: [],
              descriptions: []
            });
          }
          
          // Check if response is an empty object or has no useful data
          if (Object.keys(data).length === 0 || (data.success === undefined && !data.descriptions && !data.assets)) {
            // This might be a valid empty response, but try next proxy to be sure
            if (i < proxyList.length - 1) {
              continue;
            }
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

    // All methods failed - log detailed error
    console.error('All inventory methods failed:', {
      steamId,
      isPro,
      errors: errors.join('; '),
      lastError: lastError?.message,
    });

    // All methods failed
    return NextResponse.json(
      { 
        error: lastError?.message || 'All inventory methods failed', 
        details: 'Unable to fetch Steam inventory using direct API, proxies, or third-party services',
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

