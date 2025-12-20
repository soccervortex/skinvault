import { kv } from '@vercel/kv';
import { ThemeType } from './theme-storage';

export interface PromoStatus {
  seen: boolean;
  claimed: boolean;
  claimedAt?: string;
  dismissed?: boolean;
}

export type PromoStatusMap = Record<string, PromoStatus>; // key: theme_year_steamId or theme_year_anonymous

const PROMO_STATUS_KEY = 'promo_status';

// Fallback for local dev
let fallbackPromoStatus: Record<string, PromoStatusMap> = {};

// This function should only be called from client-side
// For server-side, we need to pass the anonId separately
export function getPromoKey(theme: ThemeType, steamId?: string | null, anonId?: string): string {
  const year = new Date().getFullYear();
  const userKey = steamId ? steamId : (anonId || 'anon_default');
  return userKey; // Just return the user key, year/theme are handled in the map structure
}

// Read promo status from KV
async function readPromoStatus(): Promise<Record<string, PromoStatusMap>> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const data = await kv.get<Record<string, PromoStatusMap>>(PROMO_STATUS_KEY);
      return data || {};
    }
  } catch (error) {
    console.warn('KV read failed for promo status, using fallback:', error);
  }
  return fallbackPromoStatus;
}

// Write promo status to KV
async function writePromoStatus(data: Record<string, PromoStatusMap>): Promise<void> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(PROMO_STATUS_KEY, data);
      return;
    }
  } catch (error) {
    console.warn('KV write failed for promo status, using fallback:', error);
  }
  fallbackPromoStatus = data;
}

// Get promo status for user
export async function getPromoStatus(theme: ThemeType, steamId?: string | null, anonId?: string): Promise<PromoStatus | null> {
  const allStatus = await readPromoStatus();
  const userKey = steamId ? steamId : (anonId || 'anon_default');
  const year = new Date().getFullYear();
  const statusKey = `${theme}_${year}`;
  
  return allStatus[statusKey]?.[userKey] || null;
}

// Mark promo as seen
export async function markPromoSeen(theme: ThemeType, steamId?: string | null, anonId?: string): Promise<void> {
  const allStatus = await readPromoStatus();
  const userKey = steamId ? steamId : (anonId || 'anon_default');
  const year = new Date().getFullYear();
  const statusKey = `${theme}_${year}`;
  
  if (!allStatus[statusKey]) {
    allStatus[statusKey] = {};
  }
  
  if (!allStatus[statusKey][userKey]) {
    allStatus[statusKey][userKey] = { seen: false, claimed: false };
  }
  
  allStatus[statusKey][userKey].seen = true;
  await writePromoStatus(allStatus);
}

// Mark promo as claimed
export async function markPromoClaimed(theme: ThemeType, steamId?: string | null, anonId?: string): Promise<void> {
  const allStatus = await readPromoStatus();
  const userKey = steamId ? steamId : (anonId || 'anon_default');
  const year = new Date().getFullYear();
  const statusKey = `${theme}_${year}`;
  
  if (!allStatus[statusKey]) {
    allStatus[statusKey] = {};
  }
  
  if (!allStatus[statusKey][userKey]) {
    allStatus[statusKey][userKey] = { seen: true, claimed: false };
  }
  
  allStatus[statusKey][userKey].claimed = true;
  allStatus[statusKey][userKey].claimedAt = new Date().toISOString();
  await writePromoStatus(allStatus);
}

// Mark promo as dismissed (later claim)
export async function markPromoDismissed(theme: ThemeType, steamId?: string | null, anonId?: string): Promise<void> {
  const allStatus = await readPromoStatus();
  const userKey = steamId ? steamId : (anonId || 'anon_default');
  const year = new Date().getFullYear();
  const statusKey = `${theme}_${year}`;
  
  if (!allStatus[statusKey]) {
    allStatus[statusKey] = {};
  }
  
  if (!allStatus[statusKey][userKey]) {
    allStatus[statusKey][userKey] = { seen: true, claimed: false };
  }
  
  allStatus[statusKey][userKey].dismissed = true;
  await writePromoStatus(allStatus);
}

// Check if user should see promo (not seen yet, or not dismissed, and not claimed)
export async function shouldShowPromo(theme: ThemeType, steamId?: string | null, anonId?: string): Promise<boolean> {
  const status = await getPromoStatus(theme, steamId, anonId);
  if (!status) return true; // Never seen before
  if (status.claimed) return false; // Already claimed
  if (status.dismissed) return false; // Dismissed for this year
  return !status.seen; // Show if not seen yet
}

