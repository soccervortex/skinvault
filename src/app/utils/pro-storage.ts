import { kv } from '@vercel/kv';

const OWNER_STEAM_ID = '76561199235618867';
const PRO_USERS_KEY = 'pro_users';

// Fallback to in-memory storage if KV is not available (local dev)
let fallbackStorage: Record<string, string> = {};

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
