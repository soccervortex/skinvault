import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner, OWNER_STEAM_IDS } from '@/app/utils/owner-ids';
import { readCreators } from '@/app/api/creators/route';
import { getProUntil } from '@/app/utils/pro-storage';

const ADMIN_HEADER = 'x-admin-key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SpinHistoryRow = {
  id: string;
  steamId: string;
  reward: number;
  createdAt: string;
  role: string;
};

type SpinHistorySummary = {
  totalSpins: number;
  totalCredits: number;
  bestReward: number;
};

function usedCountFromDoc(doc: any): number {
  if (!doc) return 0;
  const n = Number(doc?.count);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  return 1;
}

function bonusBalanceFromDoc(doc: any): number {
  if (!doc) return 0;
  const n = Number(doc?.count);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  return 0;
}

async function getOrMigrateBonusBalance(db: any, steamId: string): Promise<number> {
  const bonusCol = db.collection('bonus_spins');
  const balanceDoc = await bonusCol.findOne({ _id: steamId } as any);
  if (balanceDoc) return bonusBalanceFromDoc(balanceDoc);

  const legacyDocs = await bonusCol.find({ steamId, day: { $exists: true } } as any).toArray();
  const legacyTotal = (legacyDocs || []).reduce((sum: number, d: any) => sum + usedCountFromDoc(d), 0);
  const now = new Date();

  try {
    await bonusCol.updateOne(
      { _id: steamId } as any,
      {
        $setOnInsert: { _id: steamId, steamId, createdAt: now } as any,
        $set: { count: legacyTotal, updatedAt: now, migratedAt: now } as any,
      } as any,
      { upsert: true }
    );
  } catch {
  }

  return legacyTotal;
}

function safeInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sanitizeSteamId(input: string | null): string | null {
  const s = String(input || '').trim();
  return /^\d{17}$/.test(s) ? s : null;
}

function dayKeyUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function startOfDayWithTzOffset(now: Date, tzOffsetMinutes: number): Date {
  // tzOffsetMinutes matches JS Date.getTimezoneOffset(): minutes = UTC - local.
  // Convert to "local" by shifting, take UTC date parts, then shift back.
  const localMs = now.getTime() - tzOffsetMinutes * 60 * 1000;
  const local = new Date(localMs);
  const startLocalUtcMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0, 0);
  const startUtcMs = startLocalUtcMs + tzOffsetMinutes * 60 * 1000;
  return new Date(startUtcMs);
}

function localDayKeyWithTzOffset(now: Date, tzOffsetMinutes: number): string {
  const localMs = now.getTime() - tzOffsetMinutes * 60 * 1000;
  const local = new Date(localMs);
  const yyyy = local.getUTCFullYear();
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(local.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function timezoneFromTzOffset(tzOffsetMinutes: number): string {
  // tzOffsetMinutes is minutes = UTC - local. Mongo timezone wants offset from UTC.
  const offset = -tzOffsetMinutes;
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

function parseIsoDate(input: string | null): Date | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function getCreatorDailyLimit(): number {
  const raw = Number(process.env.CREATOR_SPINS_PER_DAY || 25);
  if (!Number.isFinite(raw)) return 25;
  return Math.max(1, Math.floor(raw));
}

function getProDailyLimit(): number {
  const raw = Number(process.env.PRO_SPINS_PER_DAY || 5);
  if (!Number.isFinite(raw)) return 5;
  return Math.max(1, Math.floor(raw));
}

async function getRoleAndLimit(steamId: string): Promise<{ role: 'owner' | 'creator' | 'pro' | 'user'; dailyLimit: number | null }> {
  if (isOwner(steamId)) return { role: 'owner', dailyLimit: null };
  try {
    const creators = await readCreators();
    const isCreator = creators.some((c) => String((c as any)?.partnerSteamId || '').trim() === steamId);
    if (isCreator) return { role: 'creator', dailyLimit: getCreatorDailyLimit() };
  } catch {
  }

  try {
    const proUntil = await getProUntil(steamId);
    if (proUntil) {
      const d = new Date(proUntil);
      if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
        return { role: 'pro', dailyLimit: getProDailyLimit() };
      }
    }
  } catch {
  }

  return { role: 'user', dailyLimit: 1 };
}

export async function GET(request: NextRequest) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requesterSteamId = getSteamIdFromRequest(request);
  if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOwner(requesterSteamId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!hasMongoConfig()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  try {
    const url = new URL(request.url);
    const days = safeInt(url.searchParams.get('days'), 30, 1, 365);
    const page = safeInt(url.searchParams.get('page'), 1, 1, 100000);
    const limit = safeInt(url.searchParams.get('limit'), 100, 1, 500);

    const tzOffset = safeInt(url.searchParams.get('tzOffset'), 0, -14 * 60, 14 * 60);

    const steamId = sanitizeSteamId(url.searchParams.get('steamId'));
    const qRaw = String(url.searchParams.get('q') || '').trim();
    const q = qRaw ? qRaw.replace(/[^0-9]/g, '') : '';

    const hasFilter = Boolean(steamId) || Boolean(q);

    const db = await getDatabase();
    const historyCol = db.collection('spin_history');
    const spinsCol = db.collection('daily_spins');

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const now = new Date();

    const todayStartFromClient = parseIsoDate(url.searchParams.get('todayStart'));
    const todayEndFromClient = parseIsoDate(url.searchParams.get('todayEnd'));

    const todayStart = todayStartFromClient || startOfDayWithTzOffset(now, tzOffset);
    const todayEnd = todayEndFromClient && todayEndFromClient.getTime() > todayStart.getTime()
      ? todayEndFromClient
      : new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const matchBase: any = { deletedAt: { $exists: false } };
    if (!hasFilter) {
      matchBase.steamId = { $nin: Array.from(OWNER_STEAM_IDS as any) };
    }

    if (steamId) {
      matchBase.steamId = steamId;
    } else if (q) {
      matchBase.steamId = {
        ...(matchBase.steamId && typeof matchBase.steamId === 'object' ? matchBase.steamId : {}),
        $regex: q,
      };
    }

    const summaryAgg = await historyCol
      .aggregate([
        { $match: { ...matchBase, createdAt: { $gte: cutoff } } },
        {
          $group: {
            _id: null,
            totalSpins: { $sum: 1 },
            totalCredits: { $sum: '$reward' },
            bestReward: { $max: '$reward' },
          },
        },
      ] as any)
      .toArray();

    const summaryRow: any = summaryAgg?.[0] || null;
    const summary: SpinHistorySummary = {
      totalSpins: Number(summaryRow?.totalSpins || 0),
      totalCredits: Number(summaryRow?.totalCredits || 0),
      bestReward: Number(summaryRow?.bestReward || 0),
    };

    const allTimeAgg = await historyCol
      .aggregate([
        {
          $match: { ...matchBase },
        },
        {
          $group: {
            _id: null,
            totalSpins: { $sum: 1 },
            totalCredits: { $sum: '$reward' },
            bestReward: { $max: '$reward' },
          },
        },
      ] as any)
      .toArray();

    const allTimeRow: any = allTimeAgg?.[0] || null;
    const allTimeSummary: SpinHistorySummary = {
      totalSpins: Number(allTimeRow?.totalSpins || 0),
      totalCredits: Number(allTimeRow?.totalCredits || 0),
      bestReward: Number(allTimeRow?.bestReward || 0),
    };

    const todayAgg = await historyCol
      .aggregate([
        {
          $match: {
            ...matchBase,
            createdAt: { $gte: todayStart, $lt: todayEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalSpins: { $sum: 1 },
            totalCredits: { $sum: '$reward' },
            bestReward: { $max: '$reward' },
          },
        },
      ] as any)
      .toArray();

    const todayRow: any = todayAgg?.[0] || null;
    const todaySummary: SpinHistorySummary = {
      totalSpins: Number(todayRow?.totalSpins || 0),
      totalCredits: Number(todayRow?.totalCredits || 0),
      bestReward: Number(todayRow?.bestReward || 0),
    };

    let userStats: any = null;
    if (steamId) {
      const roleInfo = await getRoleAndLimit(steamId);

      const userTodayAgg = await historyCol
        .aggregate([
          {
            $match: {
              steamId,
              createdAt: { $gte: todayStart, $lt: todayEnd },
            },
          },
          {
            $group: {
              _id: null,
              totalSpins: { $sum: 1 },
              totalCredits: { $sum: '$reward' },
              bestReward: { $max: '$reward' },
            },
          },
        ] as any)
        .toArray();

      const userTodayRow: any = userTodayAgg?.[0] || null;
      const userTodaySummary: SpinHistorySummary = {
        totalSpins: Number(userTodayRow?.totalSpins || 0),
        totalCredits: Number(userTodayRow?.totalCredits || 0),
        bestReward: Number(userTodayRow?.bestReward || 0),
      };

      const localStart = todayStart;
      const localEnd = new Date(localStart.getTime() + 24 * 60 * 60 * 1000);
      const startUtcDay = dayKeyUtc(localStart);
      const endUtcDay = dayKeyUtc(new Date(localEnd.getTime() - 1));

      const spinKeys = startUtcDay === endUtcDay
        ? [`${steamId}_${startUtcDay}`]
        : [`${steamId}_${startUtcDay}`, `${steamId}_${endUtcDay}`];

      const [usedDocs, bonusBalance] = await Promise.all([
        spinsCol.find({ _id: { $in: spinKeys } } as any).toArray(),
        getOrMigrateBonusBalance(db as any, steamId),
      ]);

      const usedLocal = (usedDocs || []).reduce((sum: number, d: any) => sum + usedCountFromDoc(d), 0);
      const bonusLocal = Number(bonusBalance || 0);

      const remainingSpins = roleInfo.dailyLimit === null ? null : Math.max(0, roleInfo.dailyLimit - usedLocal) + bonusLocal;

      const userAllTimeAgg = await historyCol
        .aggregate([
          { $match: { steamId } },
          {
            $group: {
              _id: null,
              totalSpins: { $sum: 1 },
              totalCredits: { $sum: '$reward' },
              bestReward: { $max: '$reward' },
            },
          },
        ] as any)
        .toArray();

      const userAllTimeRow: any = userAllTimeAgg?.[0] || null;
      const userAllTimeSummary: SpinHistorySummary = {
        totalSpins: Number(userAllTimeRow?.totalSpins || 0),
        totalCredits: Number(userAllTimeRow?.totalCredits || 0),
        bestReward: Number(userAllTimeRow?.bestReward || 0),
      };

      userStats = {
        steamId,
        role: roleInfo.role,
        dailyLimit: roleInfo.dailyLimit,
        bonusSpins: bonusLocal,
        usedSpins: usedLocal,
        remainingSpins,
        today: userTodaySummary,
        allTime: userAllTimeSummary,
      };
    }

    const matchItems: any = { ...matchBase, createdAt: { $gte: cutoff } };
    const total = await historyCol.countDocuments(matchItems);
    const skip = (page - 1) * limit;

    const rows = await historyCol
      .find(matchItems)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const items: SpinHistoryRow[] = rows.map((r: any) => ({
      id: String(r?._id || ''),
      steamId: String(r?.steamId || ''),
      reward: Number(r?.reward || 0),
      createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : new Date(0).toISOString(),
      role: String(r?.role || 'user'),
    }));

    return NextResponse.json(
      {
        ok: true,
        days,
        page,
        limit,
        total,
        tzOffset,
        q: qRaw || null,
        steamId: steamId || null,
        todaySummary,
        summary,
        allTimeSummary,
        user: userStats,
        items,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
