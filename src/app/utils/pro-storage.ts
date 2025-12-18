import { kv } from '@vercel/kv';

const OWNER_STEAM_ID = '76561199235618867';
const PRO_USERS_KEY = 'pro_users';
const FIRST_LOGINS_KEY = 'first_logins'; // Track first login dates
const CLAIMED_FREE_MONTH_KEY = 'claimed_free_month'; // Track who claimed free month

// Fallback to in-memory storage if KV is not available (local dev)
let fallbackStorage: Record<string, string> = {};
let fallbackFirstLogins: Record<string, string> = {};
let fallbackClaimedFree: Record<string, boolean> = {};

async function readProData(): Promise<Record<string, string>> {
  try {
    // Try Vercel KV first (only if credentials are set)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const data = await kv.get<Record<string, string>>(PRO_USERS_KEY);
      return data || {};
    }
  } catch (error) {
    console.warn('KV read failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage for local dev
  return fallbackStorage;
}

async function writeProData(data: Record<string, string>): Promise<void> {
  try {
    // Try Vercel KV first (only if credentials are set)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(PRO_USERS_KEY, data);
      return;
    }
  } catch (error) {
    console.warn('KV write failed, using fallback:', error);
  }
  
  // Fallback to in-memory storage for local dev
  fallbackStorage = data;
}

export async function getProUntil(steamId: string): Promise<string | null> {
  const data = await readProData();
  let proUntil = data[steamId] || null;

  // Owner account has Pro forever
  if (steamId === OWNER_STEAM_ID && !proUntil) {
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
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const data = await kv.get<Record<string, string>>(FIRST_LOGINS_KEY);
      return data || {};
    }
  } catch (error) {
    console.warn('KV read failed for first logins, using fallback:', error);
  }
  return fallbackFirstLogins;
}

async function writeFirstLogins(data: Record<string, string>): Promise<void> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(FIRST_LOGINS_KEY, data);
      return;
    }
  } catch (error) {
    console.warn('KV write failed for first logins, using fallback:', error);
  }
  fallbackFirstLogins = data;
}

// Track if user has claimed free month (one-time only)
async function readClaimedFreeMonth(): Promise<Record<string, boolean>> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const data = await kv.get<Record<string, boolean>>(CLAIMED_FREE_MONTH_KEY);
      return data || {};
    }
  } catch (error) {
    console.warn('KV read failed for claimed free month, using fallback:', error);
  }
  return fallbackClaimedFree;
}

async function writeClaimedFreeMonth(data: Record<string, boolean>): Promise<void> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(CLAIMED_FREE_MONTH_KEY, data);
      return;
    }
  } catch (error) {
    console.warn('KV write failed for claimed free month, using fallback:', error);
  }
  fallbackClaimedFree = data;
}

// Record first login (only if not already recorded)
export async function recordFirstLogin(steamId: string): Promise<void> {
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
