import { OWNER_STEAM_IDS } from './owner-ids';
import { dbGet, dbSet } from './database';

const PRO_USERS_KEY = 'pro_users';
const FIRST_LOGINS_KEY = 'first_logins'; // Track first login dates
const CLAIMED_FREE_MONTH_KEY = 'claimed_free_month'; // Track who claimed free month

// Fallback to in-memory storage if both KV and MongoDB are not available (local dev)
let fallbackStorage: Record<string, string> = {};
let fallbackFirstLogins: Record<string, string> = {};
let fallbackClaimedFree: Record<string, boolean> = {};

async function readProData(): Promise<Record<string, string>> {
  try {
    // Use database abstraction (KV primary, MongoDB fallback)
    const data = await dbGet<Record<string, string>>(PRO_USERS_KEY);
    if (data) return data;
  } catch (error) {
    console.warn('Database read failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage for local dev
  return fallbackStorage;
}

async function writeProData(data: Record<string, string>): Promise<void> {
  try {
    // Use database abstraction (writes to both KV and MongoDB)
    const success = await dbSet(PRO_USERS_KEY, data);
    if (success) return;
  } catch (error) {
    console.warn('Database write failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage for local dev
  fallbackStorage = data;
}

export async function getProUntil(steamId: string): Promise<string | null> {
  const data = await readProData();
  let proUntil = data[steamId] || null;

  // Owner accounts have Pro forever
  if (OWNER_STEAM_IDS.includes(steamId as any) && !proUntil) {
    proUntil = '2999-01-01T00:00:00.000Z';
  }

  return proUntil;
}

export async function grantPro(steamId: string, months: number): Promise<string> {
  const data = await readProData();
  const now = new Date();
  const existing = data[steamId] ? new Date(data[steamId]) : null;
  const base = existing && existing > now ? existing : now;

  const newDate = new Date(base);
  newDate.setMonth(newDate.getMonth() + months);
  const proUntil = newDate.toISOString();

  data[steamId] = proUntil;
  await writeProData(data);

  return proUntil;
}

export async function getAllProUsers(): Promise<Record<string, string>> {
  return await readProData();
}

// Track first login date
async function readFirstLogins(): Promise<Record<string, string>> {
  try {
    const data = await dbGet<Record<string, string>>(FIRST_LOGINS_KEY);
    if (data) return data;
  } catch (error) {
    console.warn('Database read failed for first logins, using fallback:', error);
  }
  return fallbackFirstLogins;
}

async function writeFirstLogins(data: Record<string, string>): Promise<void> {
  try {
    const success = await dbSet(FIRST_LOGINS_KEY, data);
    if (success) return;
  } catch (error) {
    console.warn('Database write failed for first logins, using fallback:', error);
  }
  fallbackFirstLogins = data;
}

// Track if user has claimed free month (one-time only)
async function readClaimedFreeMonth(): Promise<Record<string, boolean>> {
  try {
    const data = await dbGet<Record<string, boolean>>(CLAIMED_FREE_MONTH_KEY);
    if (data) return data;
  } catch (error) {
    console.warn('Database read failed for claimed free month, using fallback:', error);
  }
  return fallbackClaimedFree;
}

async function writeClaimedFreeMonth(data: Record<string, boolean>): Promise<void> {
  try {
    const success = await dbSet(CLAIMED_FREE_MONTH_KEY, data);
    if (success) return;
  } catch (error) {
    console.warn('Database write failed for claimed free month, using fallback:', error);
  }
  fallbackClaimedFree = data;
}

// Record first login (only if not already recorded)
export async function recordFirstLogin(steamId: string): Promise<void> {
  // Validate Steam ID format (should be numeric, 17 digits)
  if (!steamId || typeof steamId !== 'string' || !/^\d{17}$/.test(steamId)) {
    console.warn('Invalid Steam ID format for first login:', steamId);
    return;
  }

  const logins = await readFirstLogins();
  if (!logins[steamId]) {
    logins[steamId] = new Date().toISOString();
    await writeFirstLogins(logins);
  }
}

// Get first login date
export async function getFirstLoginDate(steamId: string): Promise<string | null> {
  const logins = await readFirstLogins();
  return logins[steamId] || null;
}

// Check if user has claimed free month
export async function hasClaimedFreeMonth(steamId: string): Promise<boolean> {
  const claimed = await readClaimedFreeMonth();
  return claimed[steamId] === true;
}

// Mark free month as claimed
export async function markFreeMonthClaimed(steamId: string): Promise<void> {
  const claimed = await readClaimedFreeMonth();
  claimed[steamId] = true;
  await writeClaimedFreeMonth(claimed);
}
