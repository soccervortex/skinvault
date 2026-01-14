import { dbGet } from '@/app/utils/database';

const CREDITS_BANNED_KEY = 'credits_banned_steam_ids';
const CREDITS_TIMEOUT_USERS_KEY = 'credits_timeout_users';

export type CreditsRestrictionStatus = {
  banned: boolean;
  timeoutUntil: string | null;
  timeoutActive: boolean;
};

export async function getCreditsRestrictionStatus(steamId: string): Promise<CreditsRestrictionStatus> {
  const id = String(steamId || '').trim();
  if (!/^\d{17}$/.test(id)) {
    return { banned: false, timeoutUntil: null, timeoutActive: false };
  }

  const [bannedList, timeoutMap] = await Promise.all([
    dbGet<string[]>(CREDITS_BANNED_KEY, false),
    dbGet<Record<string, string>>(CREDITS_TIMEOUT_USERS_KEY, false),
  ]);

  const banned = Array.isArray(bannedList) ? bannedList.includes(id) : false;
  const timeoutUntil = timeoutMap && typeof timeoutMap === 'object' ? String(timeoutMap[id] || '') : '';

  if (!timeoutUntil) {
    return { banned, timeoutUntil: null, timeoutActive: false };
  }

  const untilMs = Date.parse(timeoutUntil);
  const timeoutActive = Number.isFinite(untilMs) ? untilMs > Date.now() : false;

  return { banned, timeoutUntil: timeoutUntil || null, timeoutActive };
}

export async function isCreditsRestricted(steamId: string): Promise<boolean> {
  const st = await getCreditsRestrictionStatus(steamId);
  return !!st.banned || !!st.timeoutActive;
}
