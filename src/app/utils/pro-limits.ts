// Pro feature limits and checks

export const PRO_LIMITS = {
  WISHLIST_FREE: 10, // Free users can have max 10 wishlist items
  WISHLIST_PRO: Infinity, // Pro users have unlimited
} as const;

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

export function getWishlistLimit(isProUser: boolean): number {
  return isProUser ? PRO_LIMITS.WISHLIST_PRO : PRO_LIMITS.WISHLIST_FREE;
}

export function canAddToWishlist(currentCount: number, isProUser: boolean): boolean {
  const limit = getWishlistLimit(isProUser);
  return currentCount < limit;
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

