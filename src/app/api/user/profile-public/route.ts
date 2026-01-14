import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbGet } from '@/app/utils/database';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

export const runtime = 'nodejs';

type UserCreditsDoc = {
  _id: string;
  steamId: string;
  balance: number;
  updatedAt: Date;
  lastDailyClaimAt?: Date;
  lastDailyClaimDay?: string;
};

const BANNED_KEY = 'banned_steam_ids';
const TIMEOUT_USERS_KEY = 'timeout_users';
const BAN_REASONS_KEY = 'ban_reasons';
const TIMEOUT_REASONS_KEY = 'timeout_reasons';

const CREDITS_BANNED_KEY = 'credits_banned_steam_ids';
const CREDITS_TIMEOUT_USERS_KEY = 'credits_timeout_users';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const steamId = sanitizeSteamId(url.searchParams.get('steamId'));
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    }

    const [bannedList, timeoutMap, banReasons, timeoutReasons, creditsBannedList, creditsTimeoutMap] = await Promise.all([
      dbGet<string[]>(BANNED_KEY, false),
      dbGet<Record<string, string>>(TIMEOUT_USERS_KEY, false),
      dbGet<Record<string, any>>(BAN_REASONS_KEY, false),
      dbGet<Record<string, any>>(TIMEOUT_REASONS_KEY, false),
      dbGet<string[]>(CREDITS_BANNED_KEY, false),
      dbGet<Record<string, string>>(CREDITS_TIMEOUT_USERS_KEY, false),
    ]);

    const banned = Array.isArray(bannedList) ? bannedList.includes(steamId) : false;

    const tmap = timeoutMap && typeof timeoutMap === 'object' ? timeoutMap : {};
    const timeoutUntilRaw = String((tmap as any)?.[steamId] || '').trim();
    const timeoutUntil = timeoutUntilRaw || null;

    const untilMs = timeoutUntil ? Date.parse(timeoutUntil) : NaN;
    const timeoutActive = Number.isFinite(untilMs) ? untilMs > Date.now() : false;
    const timeoutMinutesRemaining = timeoutActive ? Math.max(0, Math.ceil((untilMs - Date.now()) / (1000 * 60))) : 0;

    const reasonsBan = banReasons && typeof banReasons === 'object' ? banReasons : {};
    const reasonsTimeout = timeoutReasons && typeof timeoutReasons === 'object' ? timeoutReasons : {};

    const banReason = banned ? String((reasonsBan as any)?.[steamId]?.reason || (reasonsBan as any)?.[steamId] || '').trim() : '';
    const timeoutReason = timeoutActive ? String((reasonsTimeout as any)?.[steamId]?.reason || (reasonsTimeout as any)?.[steamId] || '').trim() : '';

    const creditsBanned = Array.isArray(creditsBannedList) ? creditsBannedList.includes(steamId) : false;
    const ctmap = creditsTimeoutMap && typeof creditsTimeoutMap === 'object' ? creditsTimeoutMap : {};
    const creditsTimeoutUntilRaw = String((ctmap as any)?.[steamId] || '').trim();
    const creditsTimeoutUntil = creditsTimeoutUntilRaw || null;
    const creditsUntilMs = creditsTimeoutUntil ? Date.parse(creditsTimeoutUntil) : NaN;
    const creditsTimeoutActive = Number.isFinite(creditsUntilMs) ? creditsUntilMs > Date.now() : false;
    const creditsTimeoutMinutesRemaining = creditsTimeoutActive
      ? Math.max(0, Math.ceil((creditsUntilMs - Date.now()) / (1000 * 60)))
      : 0;

    let creditsBalance = 0;
    if (!hasMongoConfig()) {
      return NextResponse.json(
        {
          ok: true,
          steamId,
          creditsBalance: 0,
          banned,
          banReason: banReason || null,
          timeoutUntil,
          timeoutActive,
          timeoutMinutesRemaining,
          timeoutReason: timeoutReason || null,
          creditsBanned,
          creditsTimeoutUntil,
          creditsTimeoutActive,
          creditsTimeoutMinutesRemaining,
        },
        { status: 200 }
      );
    }

    const db = await getDatabase();
    const col = db.collection<UserCreditsDoc>('user_credits');
    const doc = await col.findOne({ _id: steamId } as any);
    creditsBalance = Number(doc?.balance || 0);

    const res = NextResponse.json(
      {
        ok: true,
        steamId,
        creditsBalance: Number.isFinite(creditsBalance) ? creditsBalance : 0,
        banned,
        banReason: banReason || null,
        timeoutUntil,
        timeoutActive,
        timeoutMinutesRemaining,
        timeoutReason: timeoutReason || null,
        creditsBanned,
        creditsTimeoutUntil,
        creditsTimeoutActive,
        creditsTimeoutMinutesRemaining,
      },
      { status: 200 }
    );
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load profile status' }, { status: 500 });
  }
}
