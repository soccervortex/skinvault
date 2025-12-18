// Pro feature limits and checks

export const PRO_LIMITS = {
  WISHLIST_FREE: 10, // Free users can have max 10 wishlist items
  WISHLIST_PRO: Infinity, // Pro users have unlimited
  PRICE_SCAN_PRIORITY: false, // Pro users get faster price scanning
  ADVANCED_STATS: false, // Pro users get advanced player stats
  PRICE_ALERTS: false, // Pro users get price alerts
  PORTFOLIO_ANALYTICS: false, // Pro users get portfolio tracking
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
