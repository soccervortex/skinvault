// Proxy utilities with Pro-based proxy selection
// Free users: 3 proxies, Pro users: 10 proxies

import { parseRateLimitHeaders, getRateLimitMessage } from './rate-limit-handler';

// Get scraping service proxies (server-side only, uses env vars)
function getScrapingProxies(): Array<(url: string) => string> {
  const proxies: Array<(url: string) => string> = [];
  
  // Note: These require server-side environment variables
  // For client-side, we'll use fallback proxies
  
  return proxies;
}

// Fallback free proxies (used when scraping services unavailable)
const FALLBACK_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://yacdn.org/proxy/${url}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}&_nocache=1`,
];

// All available proxies (client-side uses fallbacks, server-side can use scraping services)
export const ALL_PROXIES = [...getScrapingProxies(), ...FALLBACK_PROXIES];

// Get proxy list based on Pro status
export function getProxyList(isPro: boolean): Array<(url: string) => string> {
  if (isPro) {
    // Pro users get all 10 proxies
    return ALL_PROXIES;
  } else {
    // Free users get first 3 proxies
    return ALL_PROXIES.slice(0, 3);
  }
}

// Check Pro status from API
export async function checkProStatus(steamId: string | null | undefined): Promise<boolean> {
  if (!steamId) return false;
  
  try {
    const res = await fetch(`/api/user/pro?id=${steamId}`);
    if (!res.ok) return false;
    
    const data = await res.json();
    if (!data.proUntil) return false;
    
    // Check if Pro is still active
    return new Date(data.proUntil) > new Date();
  } catch (error) {
    console.warn('Failed to check Pro status:', error);
    return false;
  }
}

// Direct Steam API fetch for Pro users (bypasses proxies for faster, live prices)
async function fetchDirectSteamAPI(steamUrl: string, marketHashName?: string, currency?: string): Promise<any> {
  try {
    // For Pro users, try direct Steam API first (fastest, live prices)
    // Use server-side API route to avoid CORS
    const res = await fetch(`/api/steam/price?url=${encodeURIComponent(steamUrl)}`, {
      cache: 'no-store',
      headers: {
        'Priority': 'high', // Priority header for Pro users
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && (data.success || data.lowest_price || data.median_price)) {
        // Check price alerts in background (don't wait for it)
        if (marketHashName && currency && data.lowest_price) {
          fetch('/api/alerts/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              marketHashName,
              currentPrice: data.lowest_price, // Send as string, parsing handled in service
              currency,
            }),
          }).catch(console.error); // Fire and forget
        }
        return data;
      }
    }
  } catch (error) {
    console.warn('Direct Steam API failed, falling back to proxies:', error);
  }
  return null;
}

// Fetch with proxy rotation (supports both sequential and parallel)
export async function fetchWithProxyRotation(
  steamUrl: string,
  isPro: boolean,
  options: { parallel?: boolean; marketHashName?: string; currency?: string } = {}
): Promise<any> {
  // IMPORTANT: Never call public CORS proxies from the browser.
  // Always route Steam Market requests through our own server API to avoid CORS failures.
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    return await fetchDirectSteamAPI(steamUrl, options.marketHashName, options.currency);
  }

  // Server-side: try direct Steam API first (fastest), then fall back.
  const directResult = await fetchDirectSteamAPI(steamUrl, options.marketHashName, options.currency);
  if (directResult) return directResult;
  
  const proxyList = getProxyList(isPro);
  const { parallel = false } = options;

  // Helper function to fetch with retry logic
  const fetchWithRetry = async (proxyUrl: string, retryCount: number = 0): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    try {
      const res = await fetch(proxyUrl, { 
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      clearTimeout(timeoutId);

      // Handle specific error codes with retry
      if (res.status === 429 || res.status === 408) {
        const errorMsg = res.status === 429 ? 'Rate limit (429)' : 'Timeout (408)';
        console.warn(`${errorMsg} on ${proxyUrl}, retrying...`);
        
        // Wait 2 seconds and retry once
        if (retryCount === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchWithRetry(proxyUrl, retryCount + 1);
        }
        throw new Error(`${errorMsg} after retry`);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      let data: any;
      const text = await res.text();

      try {
        const json = JSON.parse(text);
        // Handle different proxy response formats
        const wrapped = (json as any).contents;
        data = typeof wrapped === 'string' ? JSON.parse(wrapped) : (wrapped || json);
      } catch {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('Invalid JSON response');
        }
      }

      if (data && (data.success || data.lowest_price || data.median_price || data.descriptions)) {
        return data;
      }
      throw new Error('No valid data in response');
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // Log specific error types
      if (error.name === 'AbortError') {
        throw new Error('Request timeout/aborted');
      } else if (error.message?.includes('429') || error.message?.includes('408')) {
        throw error; // Already handled retry
      }
      throw error;
    }
  };

  if (parallel) {
    // Parallel approach: try all proxies at once, return first success
    const attempts = proxyList.map(async (buildUrl, index) => {
      try {
        const proxyUrl = buildUrl(steamUrl);
        return await fetchWithRetry(proxyUrl);
      } catch (e: any) {
        console.warn(`Price proxy ${index} failed:`, e.message || e);
        throw e;
      }
    });

    try {
      // @ts-ignore Promise.any is available in modern runtimes
      return await Promise.any(attempts);
    } catch {
      return null;
    }
  } else {
    // Sequential approach: try proxies one by one with retry
    for (let i = 0; i < proxyList.length; i++) {
      try {
        const proxyUrl = proxyList[i](steamUrl);
        const data = await fetchWithRetry(proxyUrl);
        if (data) return data;
      } catch (error: any) {
        // Log error but continue to next proxy
        if (error.message?.includes('429') || error.message?.includes('408')) {
          console.warn(`Proxy ${i} ${error.message}, trying next...`);
        }
        // Continue to next proxy
      }
    }
    return null;
  }
}

