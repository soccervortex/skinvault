// Proxy utilities with Pro-based proxy selection
// Free users: 3 proxies, Pro users: 10 proxies

// All available free proxies (10 total)
export const ALL_PROXIES = [
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
  // Pro users: Try direct Steam API first (fastest, live prices)
  if (isPro) {
    const directResult = await fetchDirectSteamAPI(steamUrl, options.marketHashName, options.currency);
    if (directResult) return directResult;
    // Fallback to proxies if direct API fails
  }
  
  const proxyList = getProxyList(isPro);
  const { parallel = false } = options;

  if (parallel) {
    // Parallel approach: try all proxies at once, return first success
    const attempts = proxyList.map(async (buildUrl, index) => {
      try {
        const proxyUrl = buildUrl(steamUrl);
        const res = await fetch(proxyUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Proxy ${index} status ${res.status}`);

        let data: any;
        const text = await res.text();

        try {
          const json = JSON.parse(text);
          const wrapped = (json as any).contents;
          data = typeof wrapped === 'string' ? JSON.parse(wrapped) : (wrapped || json);
        } catch {
          data = JSON.parse(text);
        }

        if (data && (data.success || data.lowest_price || data.median_price || data.descriptions)) {
          return data;
        }
        throw new Error(`Proxy ${index} no valid data`);
      } catch (e) {
        console.warn(`Price proxy ${index} failed`, e);
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
    // Sequential approach: try proxies one by one
    for (let i = 0; i < proxyList.length; i++) {
      try {
        const proxyUrl = proxyList[i](steamUrl);
        const res = await fetch(proxyUrl, { cache: 'no-store' });
        if (!res.ok) continue;

        let data: any;
        const text = await res.text();

        try {
          const json = JSON.parse(text);
          const wrapped = (json as any).contents;
          data = typeof wrapped === 'string' ? JSON.parse(wrapped) : (wrapped || json);
        } catch {
          data = JSON.parse(text);
        }

        if (data && (data.success || data.lowest_price || data.median_price || data.descriptions)) {
          return data;
        }
      } catch {
        // swallow individual proxy errors; we'll fall back to next
      }
    }
    return null;
  }
}

