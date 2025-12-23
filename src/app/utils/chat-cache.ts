/**
 * Client-side chat message cache
 * Reduces API calls and improves perceived performance
 */

const CACHE_KEY_PREFIX = 'sv_chat_cache_';
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

interface CachedMessages {
  messages: any[];
  timestamp: number;
  cursor?: string | null;
}

/**
 * Get cached messages for a channel
 */
export function getCachedMessages(channel: string, type: 'global' | 'dm' = 'global'): CachedMessages | null {
  try {
    if (typeof window === 'undefined') return null;
    
    const cacheKey = `${CACHE_KEY_PREFIX}${type}_${channel}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const data: CachedMessages = JSON.parse(cached);
    
    // Check if cache is still valid
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Cache messages for a channel
 */
export function setCachedMessages(
  channel: string,
  messages: any[],
  cursor?: string | null,
  type: 'global' | 'dm' = 'global'
): void {
  try {
    if (typeof window === 'undefined') return;
    
    const cacheKey = `${CACHE_KEY_PREFIX}${type}_${channel}`;
    const data: CachedMessages = {
      messages,
      timestamp: Date.now(),
      cursor,
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Clear cache for a channel
 */
export function clearCache(channel: string, type: 'global' | 'dm' = 'global'): void {
  try {
    if (typeof window === 'undefined') return;
    const cacheKey = `${CACHE_KEY_PREFIX}${type}_${channel}`;
    localStorage.removeItem(cacheKey);
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all chat caches
 */
export function clearAllCaches(): void {
  try {
    if (typeof window === 'undefined') return;
    
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore errors
  }
}

