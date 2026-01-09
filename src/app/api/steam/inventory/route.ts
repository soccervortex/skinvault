import { NextResponse } from 'next/server';
import { getMongoClient } from '@/app/utils/mongodb-client';

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...(init || {}), signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

type InventoryCacheDoc = {
  _id: string;
  steamId: string;
  currency: number;
  startAssetId: string;
  createdAt: Date;
  expiresAt: Date;
  data: any;
};

const INVENTORY_CACHE_TTL_MS = 60_000; // 1 minute

// Helper function to parse price strings correctly (handles EUR/USD formats)
function parsePriceString(priceStr: string): number {
  if (!priceStr || typeof priceStr !== 'string') return 0;
  
  // Remove currency symbols and whitespace
  let clean = priceStr.replace(/[€$£¥₹]/g, '').trim();
  
  // Handle European format: "70.991,00" -> 70991.00 (wrong) should be 70.991
  // Handle US format: "70.99" -> 70.99
  if (clean.includes(',') && clean.includes('.')) {
    // European format: remove dots, replace comma with dot
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    // Could be European "70,99" or US "70,991"
    // If comma is the last separator, it's likely European decimal
    const parts = clean.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely "70,99" format
      clean = clean.replace(',', '.');
    } else {
      // Likely "70,991" format (US thousand separator)
      clean = clean.replace(/,/g, '');
    }
  }
  
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper function to calculate total inventory value
async function enrichInventoryWithTotalValue(data: any, currency: number, origin: string): Promise<any> {
  try {
    // Get price index from MongoDB
    const currencyStr = String(currency);

    const marketHashNames = new Set<string>();
    if (data.descriptions && Array.isArray(data.descriptions)) {
      for (const item of data.descriptions) {
        const name = String(item?.market_hash_name || '').trim();
        if (name) marketHashNames.add(name);
      }
    }

    if (data.rgInventory && typeof data.rgInventory === 'object') {
      for (const item of Object.values(data.rgInventory) as any[]) {
        const name = String((item as any)?.market_hash_name || '').trim();
        if (name) marketHashNames.add(name);
      }
    }

    const names = Array.from(marketHashNames);

    const mongoClient = await getMongoClient();
    const db = mongoClient.db('skinvault');
    const priceCollection = db.collection('market_prices');

    const prices: Record<string, number> = {};
    if (names.length) {
      const docs = await priceCollection
        .find({ currency: currencyStr, market_hash_name: { $in: names } }, { projection: { _id: 0, market_hash_name: 1, price: 1 } })
        .toArray();

      for (const d of docs as any[]) {
        const k = String(d?.market_hash_name || '').trim();
        const p = Number(d?.price);
        if (k && Number.isFinite(p)) prices[k] = p;
      }
    }

    // If price index is empty or missing, fetch prices on-the-fly for items in inventory
    if (!Object.keys(prices).length && names.length) {
      console.warn('Price index empty, fetching prices dynamically for inventory items');
      const dynamic = await fetchPricesForInventory(origin, names, currencyStr);
      for (const [k, v] of Object.entries(dynamic)) prices[k] = v;
    }

    let totalValue = 0;
    let valuedItemCount = 0;

    const descByKey = new Map<string, any>();
    if (data.descriptions && Array.isArray(data.descriptions)) {
      for (const d of data.descriptions) {
        const key = `${String(d?.classid)}_${String(d?.instanceid || 0)}`;
        if (!descByKey.has(key)) descByKey.set(key, d);
      }
    }

    if (data.assets && Array.isArray(data.assets) && descByKey.size) {
      for (const a of data.assets) {
        const key = `${String((a as any)?.classid)}_${String((a as any)?.instanceid || 0)}`;
        const d = descByKey.get(key);
        const name = String(d?.market_hash_name || '').trim();
        if (!name) continue;
        const p = prices[name];
        if (!Number.isFinite(p) || p <= 0) continue;
        const qty = Math.max(1, Number((a as any)?.amount || 1));
        totalValue += p * qty;
        valuedItemCount += qty;
      }
    } else if (data.descriptions && Array.isArray(data.descriptions)) {
      // Process descriptions to calculate total value
      for (const item of data.descriptions) {
        const name = String(item?.market_hash_name || '').trim();
        if (!name) continue;
        const p = prices[name];
        if (!Number.isFinite(p) || p <= 0) continue;
        totalValue += p;
        valuedItemCount++;
      }
    }

    // Process rgInventory format if present
    if (data.rgInventory && typeof data.rgInventory === 'object') {
      for (const item of Object.values(data.rgInventory) as any[]) {
        const name = String((item as any)?.market_hash_name || '').trim();
        if (!name) continue;
        const p = prices[name];
        if (!Number.isFinite(p) || p <= 0) continue;
        const qty = Math.max(1, Number((item as any)?.amount || 1));
        totalValue += p * qty;
        valuedItemCount += qty;
      }
    }
    
    return {
      ...data,
      totalInventoryValue: totalValue.toFixed(2),
      valuedItemCount,
      currency: currency === 3 ? 'EUR' : 'USD',
      priceIndex: prices,
    };
  } catch (error) {
    console.warn('Failed to calculate total inventory value:', error);
    return {
      ...data,
      totalInventoryValue: '0.00',
      valuedItemCount: 0,
      currency: currency === 3 ? 'EUR' : 'USD'
    };
  }
}

// Helper function to fetch prices for specific items in inventory
async function fetchPricesForInventory(origin: string, names: string[], currency: string): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  // Fetch prices for each unique item (limit to first 20 to avoid timeout)
  const itemsToFetch = Array.from(new Set(names)).slice(0, 20);
  console.log(`Fetching prices for ${itemsToFetch.length} items`);
  
  for (const marketHashName of itemsToFetch) {
    try {
      // Use your existing Steam price API
      const priceUrl = `${String(origin).replace(/\/$/, '')}/api/steam/price?market_hash_name=${encodeURIComponent(marketHashName)}&currency=${encodeURIComponent(currency)}`;
      const res = await fetchWithTimeout(priceUrl, {
        cache: 'no-store',
      }, 3000);
      
      if (res.ok) {
        const priceData = await res.json().catch(() => ({} as any));
        const raw = priceData?.lowest_price || priceData?.median_price;
        const parsed = typeof raw === 'number' ? raw : parsePriceString(String(raw || ''));
        if (Number.isFinite(parsed) && parsed > 0) {
          prices[marketHashName] = parsed;
        }
      }
    } catch (error) {
      // Silently continue if price fetch fails for one item
    }
  }
  
  return prices;
}

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
      const apiKey = process.env.STEAM_WEB_API_KEY;
      if (!apiKey) return null;
      apiUrl = `https://api.steamwebapi.com/steam/api/inventory?key=${apiKey}&steamid=${steamId}&appid=730&contextid=2`;
      headers['X-API-Key'] = apiKey;
    } else if (apiType === 'csinventoryapi') {
      const apiKey = process.env.CS_INVENTORY_API_KEY;
      if (!apiKey) return null;
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
    const origin = url.origin;
    let steamId = url.searchParams.get('steamId');
    const startAssetId = url.searchParams.get('start_assetid');
    const isPro = url.searchParams.get('isPro') === 'true';
    const currencyParam = String(url.searchParams.get('currency') || '').trim();
    const currency = currencyParam === '1' ? 1 : 3;
    const refresh = url.searchParams.get('refresh') === '1';
    const includeTopItems = url.searchParams.get('includeTopItems') === '1';
    const includePriceIndex = url.searchParams.get('includePriceIndex') === '1';

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

    const normalizedStart = String(startAssetId || '0');
    // Base cache is independent of pagination so repeated checks within 1 minute are instant.
    // We still allow paginated fetches for very large inventories, but the primary cache is base.
    const baseCacheKey = `inv_${steamId}_${currency}`;
    const pageCacheKey = `inv_${steamId}_${currency}_${normalizedStart}`;
    const mongoClient = await getMongoClient();
    const db = mongoClient.db('skinvault');
    const cacheCollection = db.collection<InventoryCacheDoc>('inventory_cache');

    const respond = async (payload: any, cacheState: 'miss' | 'refresh' = 'miss') => {
      try {
        const now = new Date();
        const expiresAt = new Date(Date.now() + INVENTORY_CACHE_TTL_MS);
        // Write base cache always
        await cacheCollection.updateOne(
          { _id: baseCacheKey },
          {
            $set: {
              steamId,
              currency,
              startAssetId: '0',
              data: payload,
              createdAt: now,
              expiresAt,
            },
          },
          { upsert: true }
        );
        // Also write the page cache key (for compatibility)
        await cacheCollection.updateOne(
          { _id: pageCacheKey },
          {
            $set: {
              steamId,
              currency,
              startAssetId: normalizedStart,
              data: payload,
              createdAt: now,
              expiresAt,
            },
          },
          { upsert: true }
        );
      } catch {
        // Ignore cache write failures
      }
      const res = NextResponse.json(payload);
      res.headers.set('x-sv-cache', cacheState);
      return res;
    };

    // Serve cache even for refresh=1 if it's still within TTL.
    // This makes repeated inventory checks within 1 minute instant (like Skinport/CS.Money).
    try {
      const cached = await cacheCollection.findOne({ _id: baseCacheKey });
      if (cached?.data && cached.expiresAt && cached.expiresAt.getTime() > Date.now()) {
        const res = NextResponse.json(cached.data);
        res.headers.set('x-sv-cache', refresh ? 'hit-refresh' : 'hit');
        return res;
      }
    } catch {
      // Ignore cache read failures
    }

    // METHOD 1: Try official Steam Web API FIRST (highest priority)
    // This is the official Steam API endpoint for CS2 inventories (IEconItems_730/GetPlayerItems)
    try {
      const steamWebAPIData = await fetchInventoryViaSteamWebAPI(steamId);
      if (steamWebAPIData && (steamWebAPIData.assets || steamWebAPIData.descriptions)) {
        console.log('✅ Inventory fetched via Official Steam Web API');
        const enrichedData = await enrichInventoryWithTotalValue(steamWebAPIData, currency, origin);
        const payload: any = { ...enrichedData };
        if (!includePriceIndex) delete payload.priceIndex;
        if (includeTopItems) {
          payload.topItems = buildTopItemsFromInventory(enrichedData, enrichedData.priceIndex || {}, 10);
        }
        return respond(payload, refresh ? 'refresh' : 'miss');
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
          const enrichedData = await enrichInventoryWithTotalValue(data, currency, origin);
          const payload: any = { ...enrichedData };
          if (!includePriceIndex) delete payload.priceIndex;
          if (includeTopItems) {
            payload.topItems = buildTopItemsFromInventory(enrichedData, enrichedData.priceIndex || {}, 10);
          }
          return respond(payload, refresh ? 'refresh' : 'miss');
        }
      } catch (error) {
        console.warn(`âš ï¸ Third-party API ${apiType} failed, trying next...`);
        continue;
      }
    }

    // METHOD 3: Try direct Steam Community API with scraping services (ScraperAPI, ZenRows, ScrapingAnt)
    // These use API keys and are more reliable than free proxies
        // IMPORTANT: Steam returns HTTP 400 with body `null` when count is too large (e.g. 5000).
    // Empirically, 2000â€“2500 works; we use 2000 for safety and rely on pagination when needed.
    let invUrl = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=2000`;
    if (startAssetId) {
      invUrl += `&start_assetid=${startAssetId}`;
    }

    // METHOD 3A: Try DIRECT Steam Community fetch first (best for local dev; avoids flaky public proxies)
    // If Steam rejects the chosen count (400 + `null`), retry without the count parameter.
    try {
      const tryDirect = async (url: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json,text/plain,*/*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://steamcommunity.com/',
            },
            signal: controller.signal,
            cache: 'no-store',
          });

          const text = await res.text();
          if (!res.ok) return null;
          if (!text) return null;
          if (/<html|<!doctype/i.test(text)) return null;

          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        } catch {
          return null;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      let direct: any = await tryDirect(invUrl);
      if (direct === null) {
        const noCountUrl = invUrl.replace(/([?&])count=\d+&?/, '$1').replace(/[?&]$/, '');
        if (noCountUrl !== invUrl) {
          direct = await tryDirect(noCountUrl);
        }
      }

      if (direct && typeof direct === 'object') {
        if (direct.success === false) {
          return NextResponse.json({
            error: direct.error || 'Steam returned an error',
            status: direct.success,
          }, { status: 502 });
        }

        if (direct.assets || direct.descriptions || direct.rgInventory || direct.rgDescriptions) {
          const enrichedData = await enrichInventoryWithTotalValue({
            assets: Array.isArray(direct.assets) ? direct.assets : [],
            descriptions: Array.isArray(direct.descriptions) ? direct.descriptions : [],
            rgInventory: direct.rgInventory,
            rgDescriptions: direct.rgDescriptions,
          }, currency, origin);
          const payload: any = { ...enrichedData };
          if (!includePriceIndex) delete payload.priceIndex;
          if (includeTopItems) {
            payload.topItems = buildTopItemsFromInventory(enrichedData, enrichedData.priceIndex || {}, 10);
          }
          return respond(payload, refresh ? 'refresh' : 'miss');
        }
      }
    } catch {
      // fall through
    }
    // Get scraping services first (with API keys), then fallback free proxies
    const scrapingProxies = getScrapingProxies();
    const allProxies = getAllProxies(); // This includes scraping + fallback
    
    // Pro users get more proxies, free users get limited
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
            // Success - calculate total value and return the data
            const enrichedData = await enrichInventoryWithTotalValue(data, currency, origin);
            const payload: any = { ...enrichedData };
            if (!includePriceIndex) delete payload.priceIndex;
            if (includeTopItems) {
              payload.topItems = buildTopItemsFromInventory(enrichedData, enrichedData.priceIndex || {}, 10);
            }
            return respond(payload, refresh ? 'refresh' : 'miss');
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

    // All methods failed - try stale cache as last resort
    try {
      const stale = await cacheCollection.findOne({ _id: baseCacheKey });
      if (stale?.data) {
        const res = NextResponse.json(stale.data);
        res.headers.set('x-sv-cache', 'stale');
        return res;
      }
    } catch {
      // Ignore
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

function buildTopItemsFromInventory(inv: any, prices: Record<string, number>, limit: number) {
  try {
    const assets = Array.isArray(inv?.assets) ? inv.assets : [];
    const descriptions = Array.isArray(inv?.descriptions) ? inv.descriptions : [];
    if (!assets.length || !descriptions.length) return [];

    const descByKey = new Map<string, any>();
    for (const d of descriptions) {
      const key = `${String(d?.classid)}_${String(d?.instanceid || 0)}`;
      if (!descByKey.has(key)) descByKey.set(key, d);
    }

    const items: Array<{ marketHashName: string; amount: number; price: number; value: number }> = [];
    for (const a of assets) {
      const key = `${String((a as any)?.classid)}_${String((a as any)?.instanceid || 0)}`;
      const d = descByKey.get(key);
      const name = String(d?.market_hash_name || '').trim();
      if (!name) continue;
      const p = Number(prices[name] || 0);
      if (!Number.isFinite(p) || p <= 0) continue;
      const amount = Math.max(1, Number((a as any)?.amount || 1));
      items.push({ marketHashName: name, amount, price: p, value: p * amount });
    }

    items.sort((a, b) => b.value - a.value);
    return items.slice(0, limit);
  } catch {
    return [];
  }
}


