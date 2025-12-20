import { kv } from '@vercel/kv';

const GIFT_CLAIMS_KEY = 'christmas_gift_claims_2024';

// Fallback for local dev
let fallbackGiftClaims: Record<string, { reward: any; claimedAt: number }> = {};

interface GiftClaim {
  steamId: string;
  reward: any;
  claimedAt: number;
}

async function readGiftClaims(): Promise<Record<string, GiftClaim>> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const data = await kv.get<Record<string, GiftClaim>>(GIFT_CLAIMS_KEY);
      return data || {};
    }
  } catch (error) {
    console.warn('KV read failed for gift claims, using fallback:', error);
  }
  return fallbackGiftClaims;
}

async function writeGiftClaims(data: Record<string, GiftClaim>): Promise<void> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(GIFT_CLAIMS_KEY, data);
      return;
    }
  } catch (error) {
    console.warn('KV write failed for gift claims, using fallback:', error);
  }
  fallbackGiftClaims = data;
}

// Check if user has claimed gift
export async function hasUserClaimedGift(steamId: string): Promise<boolean> {
  const claims = await readGiftClaims();
  return !!claims[steamId];
}

// Get user's claimed reward
export async function getUserGiftReward(steamId: string): Promise<any | null> {
  const claims = await readGiftClaims();
  return claims[steamId]?.reward || null;
}

// Save user's gift claim
export async function saveUserGiftClaim(steamId: string, reward: any): Promise<void> {
  const claims = await readGiftClaims();
  claims[steamId] = {
    steamId,
    reward,
    claimedAt: Date.now(),
  };
  await writeGiftClaims(claims);
}

