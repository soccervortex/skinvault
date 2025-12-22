import { dbGet, dbSet } from './database';
import { ThemeType } from './theme-storage';

const GIFT_CLAIMS_KEY_PREFIX = 'theme_gift_claims_2024';

interface GiftClaim {
  steamId: string;
  reward: any;
  theme: ThemeType;
  claimedAt: number;
}

// Fallback for local dev
let fallbackGiftClaims: Record<string, Record<string, GiftClaim>> = {};

function getGiftClaimsKey(theme: ThemeType): string {
  return `${GIFT_CLAIMS_KEY_PREFIX}_${theme}`;
}

async function readGiftClaims(theme: ThemeType): Promise<Record<string, GiftClaim>> {
  try {
    const data = await dbGet<Record<string, GiftClaim>>(getGiftClaimsKey(theme));
    return data || {};
  } catch (error) {
    console.warn(`Database read failed for ${theme} gift claims, using fallback:`, error);
  }
  return fallbackGiftClaims[theme] || {};
}

async function writeGiftClaims(theme: ThemeType, data: Record<string, GiftClaim>): Promise<void> {
  try {
    await dbSet(getGiftClaimsKey(theme), data);
    return;
  } catch (error) {
    console.warn(`Database write failed for ${theme} gift claims, using fallback:`, error);
  }
  if (!fallbackGiftClaims[theme]) {
    fallbackGiftClaims[theme] = {};
  }
  fallbackGiftClaims[theme] = data;
}

// Check if user has claimed gift for a specific theme
export async function hasUserClaimedGift(steamId: string, theme: ThemeType): Promise<boolean> {
  const claims = await readGiftClaims(theme);
  return !!claims[steamId];
}

// Get user's claimed reward for a specific theme
export async function getUserGiftReward(steamId: string, theme: ThemeType): Promise<any | null> {
  const claims = await readGiftClaims(theme);
  return claims[steamId]?.reward || null;
}

// Save user's gift claim for a specific theme
export async function saveUserGiftClaim(steamId: string, reward: any, theme: ThemeType): Promise<void> {
  const claims = await readGiftClaims(theme);
  claims[steamId] = {
    steamId,
    reward,
    theme,
    claimedAt: Date.now(),
  };
  await writeGiftClaims(theme, claims);
}

