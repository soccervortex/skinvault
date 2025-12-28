/**
 * All available CS2 API endpoints
 * This is the single source of truth for which API files we use
 */
export const API_FILES = [
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

export const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';

