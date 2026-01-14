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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const steamId = sanitizeSteamId(url.searchParams.get('steamId'));
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    }

    const [bannedList, timeoutMap, banReasons, timeoutReasons] = await Promise.all([
      dbGet<string[]>(BANNED_KEY, false),
      dbGet<Record<string, string>>(TIMEOUT_USERS_KEY, false),
      dbGet<Record<string, any>>(BAN_REASONS_KEY, false),
      dbGet<Record<string, any>>(TIMEOUT_REASONS_KEY, false),
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
      },
      { status: 200 }
    );
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load profile status' }, { status: 500 });
  }
}
