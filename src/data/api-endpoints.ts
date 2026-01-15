/**
 * All available CS2 API endpoints
 * This is the single source of truth for which API files we use
 */
export const API_FILES = [
  'collections.json',
  'skins.json',
  'skins_not_grouped.json',
  'stickers.json',
  'agents.json',
  'crates.json',
  'patches.json',
  'graffiti.json',
  'music_kits.json',
  'keychains.json',
  'collectibles.json',
  'sticker_slabs.json',
  'keys.json',
  'highlights.json',
  'base_weapons.json',
] as const;

export const API_LARGE_FILES = [
  'all.json',
] as const;

export const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';

/**
 * List of item IDs to exclude from all listings
 * These items will not appear in search, categories, or sitemap
 */
export const EXCLUDED_ITEM_IDS = [
  'collectible-5180', // Excluded per user request
] as const;

/**
 * Check if an item should be excluded based on its ID
 */
export function isItemExcluded(itemId: string | null | undefined): boolean {
  if (!itemId) return false;
  return EXCLUDED_ITEM_IDS.includes(itemId as any);
}

