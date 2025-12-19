import { canAddToWishlist, getWishlistLimit } from './pro-limits';

export type WishlistEntry = {
  key: string; // stable identifier, usually market_hash_name
  name: string;
  image: string;
  market_hash_name?: string;
  rarityName?: string;
  rarityColor?: string;
  weaponName?: string;
};

const STORAGE_KEY = 'sv_wishlist_v1';

const getStorageKeyForUser = (steamId?: string | null) => {
  if (!steamId) return `${STORAGE_KEY}_guest`;
  return `${STORAGE_KEY}_${steamId}`;
};

export function loadWishlist(steamId?: string | null): WishlistEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKeyForUser(steamId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.key === 'string');
  } catch {
    return [];
  }
}

export function saveWishlist(entries: WishlistEntry[], steamId?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKeyForUser(steamId);
    window.localStorage.setItem(key, JSON.stringify(entries));
    
    // Also sync to KV for Discord bot access
    if (steamId) {
      fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId, wishlist: entries }),
      }).catch(() => {
        // Silently fail - this is just for bot sync
      });
    }
  } catch {
    // ignore quota / privacy errors
  }
}

export type ToggleWishlistResult = {
  success: boolean;
  newList: WishlistEntry[];
  reason?: 'limit_reached' | 'not_logged_in';
  limit?: number;
  currentCount?: number;
};

export function toggleWishlistEntry(
  entry: WishlistEntry,
  steamId?: string | null,
  isProUser: boolean = false
): ToggleWishlistResult {
  const current = loadWishlist(steamId);
  const idx = current.findIndex((e) => e.key === entry.key);
  
  // If removing, always allow
  if (idx >= 0) {
    const next = [...current.slice(0, idx), ...current.slice(idx + 1)];
    saveWishlist(next, steamId);
    return { success: true, newList: next };
  }
  
  // If adding, check limits
  const currentCount = current.length;
  const canAdd = canAddToWishlist(currentCount, isProUser);
  
  if (!canAdd) {
    const limit = getWishlistLimit(isProUser);
    return {
      success: false,
      newList: current,
      reason: 'limit_reached',
      limit,
      currentCount,
    };
  }
  
  const next = [...current, entry];
  saveWishlist(next, steamId);
  return { success: true, newList: next };
}
