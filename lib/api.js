// lib/api.js
const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';

export const endpoints = {
  all: `${BASE_URL}/all.json`,
  skins: `${BASE_URL}/skins.json`,
  stickers: `${BASE_URL}/stickers.json`,
  agents: `${BASE_URL}/agents.json`,
  crates: `${BASE_URL}/crates.json`,
  keychains: `${BASE_URL}/keychains.json`,
  music: `${BASE_URL}/music_kits.json`,
};