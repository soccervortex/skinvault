// Pro feature limits and checks

export const PRO_LIMITS = {
  WISHLIST_FREE: 10, // Free users can have max 10 wishlist items
  WISHLIST_PRO: Infinity, // Pro users have unlimited
  PRICE_TRACKER_FREE: 5, // Free users can have max 5 price trackers
  PRICE_TRACKER_PRO: Infinity, // Pro users have unlimited
} as const;

// Cache for rewards to avoid multiple API calls
let rewardsCache: { steamId: string | null; rewards: any[]; timestamp: number } = {
  steamId: null,
  rewards: [],
  timestamp: 0,
};

const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

// Helper to get rewards from API (with caching)
async function getStoredRewards(steamId?: string | null): Promise<any[]> {
  if (typeof window === 'undefined') return [];
  if (!steamId) return [];

  // Check cache
  const now = Date.now();
  if (
    rewardsCache.steamId === steamId &&
    rewardsCache.timestamp > 0 &&
    now - rewardsCache.timestamp < CACHE_DURATION
  ) {
    return rewardsCache.rewards;
  }

  try {
    const response = await fetch(`/api/user/rewards?steamId=${steamId}`);
    if (response.ok) {
      const data = await response.json();
      const rewards = (data.rewards || []).map((r: any) => r.reward);
      // Update cache
      rewardsCache = {
        steamId,
        rewards,
        timestamp: now,
      };
      return rewards;
    }
  } catch (error) {
    console.error('Failed to fetch rewards from API:', error);
  }

  // Fallback to localStorage (legacy support)
  try {
    const themes = ['christmas', 'halloween', 'easter', 'sinterklaas', 'newyear', 'oldyear'];
    const allRewards: any[] = [];
    
    themes.forEach(theme => {
      const year = theme === 'christmas' || theme === 'oldyear' ? '2025' : '2026';
      const key = `sv_${theme}_rewards_${year}`;
      const rewardsStr = localStorage.getItem(key);
      if (rewardsStr) {
        try {
          const rewards = JSON.parse(rewardsStr);
          if (Array.isArray(rewards)) {
            allRewards.push(...rewards.map((r: any) => r.reward || r));
          }
        } catch {
          // Skip invalid JSON
        }
      }
    });
    
    return allRewards;
  } catch {
    return [];
  }
}

// Clear rewards cache (call this when rewards might have changed)
export function clearRewardsCache(): void {
  rewardsCache = {
    steamId: null,
    rewards: [],
    timestamp: 0,
  };
}

// Preload rewards into cache (for use in components)
export async function preloadRewards(steamId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  await getStoredRewards(steamId);
}

// Helper to get extra wishlist slots from rewards
async function getExtraWishlistSlots(steamId?: string | null): Promise<number> {
  const rewards = await getStoredRewards(steamId);
  let extraSlots = 0;
  
  rewards.forEach((reward: any) => {
    if (reward?.type === 'wishlist_extra_slots' && reward?.value) {
      extraSlots += reward.value;
    }
  });
  
  return extraSlots;
}

// Helper to get extra price trackers from rewards
async function getExtraPriceTrackers(steamId?: string | null): Promise<number> {
  const rewards = await getStoredRewards(steamId);
  let extraTrackers = 0;
  
  rewards.forEach((reward: any) => {
    if (reward?.type === 'price_tracker_free' && reward?.value) {
      extraTrackers += reward.value;
    }
  });
  
  return extraTrackers;
}

// Performance settings
export const PRO_PERFORMANCE = {
  // Price scanning concurrency
  PRICE_SCAN_CONCURRENCY_FREE: 3, // Free users: 3 concurrent requests
  PRICE_SCAN_CONCURRENCY_PRO: 10, // Pro users: 10 concurrent requests (faster)
  
  // Cache TTL (Time To Live) in milliseconds
  PRICE_CACHE_TTL_FREE: 1000 * 60 * 30, // Free: 30 minutes
  PRICE_CACHE_TTL_PRO: 1000 * 60 * 60 * 2, // Pro: 2 hours (better caching)
  
  // Dataset cache TTL
  DATASET_CACHE_TTL_FREE: 1000 * 60 * 60 * 12, // Free: 12 hours
  DATASET_CACHE_TTL_PRO: 1000 * 60 * 60 * 24, // Pro: 24 hours
  
  // Wishlist price update batch size
  WISHLIST_BATCH_FREE: 3, // Free: 3 items at a time
  WISHLIST_BATCH_PRO: 10, // Pro: 10 items at a time (faster updates)
} as const;

export function isPro(proUntil: string | null | undefined): boolean {
  if (!proUntil) return false;
  return new Date(proUntil) > new Date();
}

export async function getWishlistLimit(isProUser: boolean, steamId?: string | null): Promise<number> {
  if (isProUser) return PRO_LIMITS.WISHLIST_PRO;
  const baseLimit = PRO_LIMITS.WISHLIST_FREE;
  const extraSlots = await getExtraWishlistSlots(steamId);
  return baseLimit + extraSlots;
}

export async function canAddToWishlist(currentCount: number, isProUser: boolean, steamId?: string | null): Promise<boolean> {
  const limit = await getWishlistLimit(isProUser, steamId);
  return currentCount < limit;
}

// Synchronous version for backwards compatibility (uses cached value or 0)
export function getWishlistLimitSync(isProUser: boolean): number {
  if (isProUser) return PRO_LIMITS.WISHLIST_PRO;
  const baseLimit = PRO_LIMITS.WISHLIST_FREE;
  // Use cached rewards if available, otherwise return base limit
  if (rewardsCache.rewards.length > 0) {
    const extraSlots = rewardsCache.rewards.reduce((sum, reward) => {
      if (reward?.type === 'wishlist_extra_slots' && reward?.value) {
        return sum + reward.value;
      }
      return sum;
    }, 0);
    return baseLimit + extraSlots;
  }
  return baseLimit;
}

// Performance helpers
export function getPriceScanConcurrency(isProUser: boolean): number {
  return isProUser 
    ? PRO_PERFORMANCE.PRICE_SCAN_CONCURRENCY_PRO 
    : PRO_PERFORMANCE.PRICE_SCAN_CONCURRENCY_FREE;
}

export function getPriceCacheTTL(isProUser: boolean): number {
  return isProUser 
    ? PRO_PERFORMANCE.PRICE_CACHE_TTL_PRO 
    : PRO_PERFORMANCE.PRICE_CACHE_TTL_FREE;
}

export function getDatasetCacheTTL(isProUser: boolean): number {
  return isProUser 
    ? PRO_PERFORMANCE.DATASET_CACHE_TTL_PRO 
    : PRO_PERFORMANCE.DATASET_CACHE_TTL_FREE;
}

export function getWishlistBatchSize(isProUser: boolean): number {
  return isProUser 
    ? PRO_PERFORMANCE.WISHLIST_BATCH_PRO 
    : PRO_PERFORMANCE.WISHLIST_BATCH_FREE;
}

// Get price tracker limit (includes rewards)
export async function getPriceTrackerLimit(isProUser: boolean, steamId?: string | null): Promise<number> {
  if (isProUser) return PRO_LIMITS.PRICE_TRACKER_PRO;
  const baseLimit = PRO_LIMITS.PRICE_TRACKER_FREE;
  const extraTrackers = await getExtraPriceTrackers(steamId);
  return baseLimit + extraTrackers;
}

// Check if user can add more price trackers
export async function canAddPriceTracker(currentCount: number, isProUser: boolean, steamId?: string | null): Promise<boolean> {
  const limit = await getPriceTrackerLimit(isProUser, steamId);
  return currentCount < limit;
}

// Synchronous version for backwards compatibility (uses cached value or base limit)
export function getPriceTrackerLimitSync(isProUser: boolean): number {
  if (isProUser) return PRO_LIMITS.PRICE_TRACKER_PRO;
  const baseLimit = PRO_LIMITS.PRICE_TRACKER_FREE;
  // Use cached rewards if available
  if (rewardsCache.rewards.length > 0) {
    const extraTrackers = rewardsCache.rewards.reduce((sum, reward) => {
      if (reward?.type === 'price_tracker_free' && reward?.value) {
        return sum + reward.value;
      }
      return sum;
    }, 0);
    return baseLimit + extraTrackers;
  }
  return baseLimit;
}






