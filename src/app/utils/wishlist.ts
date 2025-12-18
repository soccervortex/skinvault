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
  } catch {
    // ignore quota / privacy errors
  }
}

export function toggleWishlistEntry(
  entry: WishlistEntry,
  steamId?: string | null
): WishlistEntry[] {
  const current = loadWishlist(steamId);
  const idx = current.findIndex((e) => e.key === entry.key);
  let next: WishlistEntry[];
  if (idx >= 0) {
    next = [...current.slice(0, idx), ...current.slice(idx + 1)];
  } else {
    next = [...current, entry];
  }
  saveWishlist(next, steamId);
  return next;
}
