// lib/api.js
const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';

export const endpoints = {
  all: `${BASE_URL}/all.json`,
  skins: `${BASE_URL}/skins.json`,
  skins_not_grouped: `${BASE_URL}/skins_not_grouped.json`,
  skins_grouped: `${BASE_URL}/skins_grouped.json`,
  stickers: `${BASE_URL}/stickers.json`,
  sticker_slabs: `${BASE_URL}/sticker_slabs.json`,
  agents: `${BASE_URL}/agents.json`,
  crates: `${BASE_URL}/crates.json`,
  collections: `${BASE_URL}/collections.json`,
  keys: `${BASE_URL}/keys.json`,
  collectibles: `${BASE_URL}/collectibles.json`,
  patches: `${BASE_URL}/patches.json`,
  graffiti: `${BASE_URL}/graffiti.json`,
  keychains: `${BASE_URL}/keychains.json`,
  music_kits: `${BASE_URL}/music_kits.json`,
  base_weapons: `${BASE_URL}/base_weapons.json`,
  highlights: `${BASE_URL}/highlights.json`,
};