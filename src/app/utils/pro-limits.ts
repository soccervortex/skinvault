// Pro feature limits and checks

export const PRO_LIMITS = {
  WISHLIST_FREE: 10, // Free users can have max 10 wishlist items
  WISHLIST_PRO: Infinity, // Pro users have unlimited
  PRICE_TRACKER_FREE: 0, // Price trackers require Pro subscription (Discord integration)
  PRICE_TRACKER_PRO: Infinity, // Pro users have unlimited
};

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
        // Get rewards from both theme gifts and consumables
        const rewards = (data.rewards || []).map((r: any) => r.reward).filter((r: any) => r != null);
        // Debug: Log wishlist slot count
        const wishlistSlotCount = rewards.filter((r: any) => r?.type === 'wishlist_slot').length;
        if (wishlistSlotCount > 0) {
          console.log(`[Wishlist] Found ${wishlistSlotCount} wishlist_slot rewards for ${steamId}`);
        }
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
  
  // Count all wishlist_slot rewards (each purchase = +1 slot)
  const wishlistSlotCount = rewards.filter((reward: any) => reward?.type === 'wishlist_slot').length;
  extraSlots += wishlistSlotCount;
  
  rewards.forEach((reward: any) => {
    // Check for permanent extra slots (from theme rewards)
    if (reward?.type === 'wishlist_extra_slots' && reward?.value) {
      extraSlots += reward.value;
    }
    // Check for temporary wishlist boost (treat as permanent for now)
    if (reward?.type === 'wishlist_boost' && reward?.value) {
      extraSlots += reward.value;
    }
    // Note: wishlist_slot is now counted above using filter().length for accuracy
  });
  
  return extraSlots;
}

// Helper to get extra price trackers from rewards
async function getExtraPriceTrackers(steamId?: string | null): Promise<number> {
  const rewards = await getStoredRewards(steamId);
  const extra = rewards.filter((reward: any) => reward?.type === 'price_tracker_slot').length;
  return extra;
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
export function getWishlistLimitSync(isProUser: boolean, steamId?: string | null): number {
  if (isProUser) return PRO_LIMITS.WISHLIST_PRO;
  const baseLimit = PRO_LIMITS.WISHLIST_FREE;
  let extraSlots = 0;
  
  // First try cached rewards (only if cache matches the requested steamId)
  if (rewardsCache.rewards.length > 0 && (!steamId || rewardsCache.steamId === steamId)) {
    // Count all wishlist_slot rewards (each purchase = +1 slot) - use filter for accuracy
    const wishlistSlotCount = rewardsCache.rewards.filter((reward: any) => reward?.type === 'wishlist_slot').length;
    extraSlots += wishlistSlotCount;
    
    rewardsCache.rewards.forEach((reward: any) => {
      // Check for permanent extra slots (from theme rewards)
      if (reward?.type === 'wishlist_extra_slots' && reward?.value) {
        extraSlots += reward.value;
      }
      // Check for temporary wishlist boost (treat as permanent for now)
      if (reward?.type === 'wishlist_boost' && reward?.value) {
        extraSlots += reward.value;
      }
      // Note: wishlist_slot is now counted above using filter().length for accuracy
    });
  } else if (typeof window !== 'undefined') {
    // Fallback to localStorage if cache is empty (for immediate use before API loads)
    try {
      const themes = ['christmas', 'halloween', 'easter', 'sinterklaas', 'newyear', 'oldyear'];
      themes.forEach(theme => {
        const year = theme === 'christmas' || theme === 'oldyear' ? '2025' : '2026';
        const key = `sv_${theme}_rewards_${year}`;
        const rewardsStr = localStorage.getItem(key);
        if (rewardsStr) {
          try {
            const rewards = JSON.parse(rewardsStr);
            if (Array.isArray(rewards)) {
              // Count all wishlist_slot rewards first (each purchase = +1 slot)
              const wishlistSlotCount = rewards.filter((stored: any) => {
                const reward = stored.reward || stored;
                return reward?.type === 'wishlist_slot';
              }).length;
              extraSlots += wishlistSlotCount;
              
              rewards.forEach((stored: any) => {
                const reward = stored.reward || stored;
                if (reward?.type === 'wishlist_extra_slots' && reward?.value) {
                  extraSlots += reward.value;
                }
                if (reward?.type === 'wishlist_boost' && reward?.value) {
                  extraSlots += reward.value;
                }
                // Note: wishlist_slot is now counted above using filter().length for accuracy
              });
            }
          } catch {
            // Skip invalid JSON
          }
        }
      });
    } catch {
      // Ignore errors
    }
  }
  
  return baseLimit + extraSlots;
}

// Helper to check if user has price scan boost
async function hasPriceScanBoost(steamId?: string | null): Promise<boolean> {
  if (!steamId) return false;
  const rewards = await getStoredRewards(steamId);
  return rewards.some((reward: any) => reward?.type === 'price_scan_boost');
}

// Helper to check if user has cache boost
async function hasCacheBoost(steamId?: string | null): Promise<boolean> {
  if (!steamId) return false;
  const rewards = await getStoredRewards(steamId);
  return rewards.some((reward: any) => reward?.type === 'cache_boost');
}

// Performance helpers
export async function getPriceScanConcurrency(isProUser: boolean, steamId?: string | null): Promise<number> {
  if (isProUser) return PRO_PERFORMANCE.PRICE_SCAN_CONCURRENCY_PRO;
  const hasBoost = await hasPriceScanBoost(steamId);
  return hasBoost ? 5 : PRO_PERFORMANCE.PRICE_SCAN_CONCURRENCY_FREE; // Boost increases from 3 to 5
}

// Synchronous version (uses cached rewards or defaults)
export function getPriceScanConcurrencySync(isProUser: boolean, steamId?: string | null): number {
  if (isProUser) return PRO_PERFORMANCE.PRICE_SCAN_CONCURRENCY_PRO;
  // Check cached rewards for boost
  if (steamId && rewardsCache.rewards.length > 0 && rewardsCache.steamId === steamId) {
    const hasBoost = rewardsCache.rewards.some((reward: any) => reward?.type === 'price_scan_boost');
    if (hasBoost) return 5;
  }
  return PRO_PERFORMANCE.PRICE_SCAN_CONCURRENCY_FREE;
}

export async function getPriceCacheTTL(isProUser: boolean, steamId?: string | null): Promise<number> {
  if (isProUser) return PRO_PERFORMANCE.PRICE_CACHE_TTL_PRO;
  const hasBoost = await hasCacheBoost(steamId);
  return hasBoost ? (1000 * 60 * 60) : PRO_PERFORMANCE.PRICE_CACHE_TTL_FREE; // Boost: 30min to 1 hour
}

// Synchronous version (uses cached rewards or defaults)
export function getPriceCacheTTLSync(isProUser: boolean, steamId?: string | null): number {
  if (isProUser) return PRO_PERFORMANCE.PRICE_CACHE_TTL_PRO;
  // Check cached rewards for boost
  if (steamId && rewardsCache.rewards.length > 0 && rewardsCache.steamId === steamId) {
    const hasBoost = rewardsCache.rewards.some((reward: any) => reward?.type === 'cache_boost');
    if (hasBoost) return 1000 * 60 * 60; // 1 hour
  }
  return PRO_PERFORMANCE.PRICE_CACHE_TTL_FREE;
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

// Synchronous version (same as async, kept for compatibility)
export function getWishlistBatchSizeSync(isProUser: boolean): number {
  return isProUser 
    ? PRO_PERFORMANCE.WISHLIST_BATCH_PRO 
    : PRO_PERFORMANCE.WISHLIST_BATCH_FREE;
}

// Helper to check if user has Discord access (free users with consumable)
async function hasDiscordAccess(steamId?: string | null): Promise<boolean> {
  if (!steamId) return false;
  const rewards = await getStoredRewards(steamId);
  return rewards.some((reward: any) => reward?.type === 'discord_access');
}

// Get price tracker limit (Pro unlimited, free with Discord access: 3, free without: 0)
export async function getPriceTrackerLimit(isProUser: boolean, steamId?: string | null): Promise<number> {
  if (isProUser) return PRO_LIMITS.PRICE_TRACKER_PRO;
  // Free users with Discord access get 3 price trackers
  const hasAccess = await hasDiscordAccess(steamId);
  const base = hasAccess ? 3 : PRO_LIMITS.PRICE_TRACKER_FREE; // 3 for Discord access, 0 otherwise
  const extra = await getExtraPriceTrackers(steamId);
  return base + extra;
}

// Check if user can add more price trackers
export async function canAddPriceTracker(currentCount: number, isProUser: boolean, steamId?: string | null): Promise<boolean> {
  const limit = await getPriceTrackerLimit(isProUser, steamId);
  return currentCount < limit;
}

// Synchronous version for backwards compatibility (Pro unlimited, free with Discord access: 3, free without: 0)
export function getPriceTrackerLimitSync(isProUser: boolean, steamId?: string | null): number {
  if (isProUser) return PRO_LIMITS.PRICE_TRACKER_PRO;
  // Check cached rewards for Discord access
  let extra = 0;
  if (steamId && rewardsCache.rewards.length > 0 && rewardsCache.steamId === steamId) {
    const hasAccess = rewardsCache.rewards.some((reward: any) => reward?.type === 'discord_access');
    extra = rewardsCache.rewards.filter((reward: any) => reward?.type === 'price_tracker_slot').length;
    if (hasAccess) return 3 + extra;
    return PRO_LIMITS.PRICE_TRACKER_FREE + extra;
  }

  // Fallback to localStorage if cache is empty
  if (typeof window !== 'undefined' && steamId) {
    try {
      const themes = ['christmas', 'halloween', 'easter', 'sinterklaas', 'newyear', 'oldyear'];
      let hasAccess = false;
      let extraSlots = 0;
      themes.forEach((theme) => {
        const year = theme === 'christmas' || theme === 'oldyear' ? '2025' : '2026';
        const key = `sv_${theme}_rewards_${year}`;
        const rewardsStr = localStorage.getItem(key);
        if (!rewardsStr) return;
        try {
          const rewards = JSON.parse(rewardsStr);
          if (!Array.isArray(rewards)) return;
          rewards.forEach((stored: any) => {
            const reward = stored.reward || stored;
            if (reward?.type === 'discord_access') hasAccess = true;
            if (reward?.type === 'price_tracker_slot') extraSlots += 1;
          });
        } catch {
          /* ignore */
        }
      });
      return (hasAccess ? 3 : PRO_LIMITS.PRICE_TRACKER_FREE) + extraSlots;
    } catch {
      return PRO_LIMITS.PRICE_TRACKER_FREE;
    }
  }

  return PRO_LIMITS.PRICE_TRACKER_FREE;
}






