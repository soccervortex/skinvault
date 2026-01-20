import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner, OWNER_STEAM_IDS } from '@/app/utils/owner-ids';
import { readCreators } from '@/app/api/creators/route';

const ADMIN_HEADER = 'x-admin-key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SpinHistoryRow = {
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

function getCreatorDailyLimit(): number {
  const raw = Number(process.env.CREATOR_SPINS_PER_DAY || 25);
  if (!Number.isFinite(raw)) return 25;
  return Math.max(1, Math.floor(raw));
}

async function getRoleAndLimit(steamId: string): Promise<{ role: 'owner' | 'creator' | 'user'; dailyLimit: number | null }> {
  if (isOwner(steamId)) return { role: 'owner', dailyLimit: null };
  try {
    const creators = await readCreators();
    const isCreator = creators.some((c) => String((c as any)?.partnerSteamId || '').trim() === steamId);
    if (isCreator) return { role: 'creator', dailyLimit: getCreatorDailyLimit() };
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

    const steamId = sanitizeSteamId(url.searchParams.get('steamId'));
    const qRaw = String(url.searchParams.get('q') || '').trim();
    const q = qRaw ? qRaw.replace(/[^0-9]/g, '') : '';

    const hasFilter = Boolean(steamId) || Boolean(q);

    const db = await getDatabase();
    const historyCol = db.collection('spin_history');
    const spinsCol = db.collection('daily_spins');
    const bonusCol = db.collection('bonus_spins');

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const todayKey = dayKeyUtc(new Date());
    const todayStart = startOfDayUtc(new Date());

    const matchBase: any = {};
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
        { $match: { ...matchBase, createdAt: { $gte: todayStart } } },
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

      const usedDoc = await spinsCol.findOne({ _id: `${steamId}_${todayKey}` } as any);
      const usedSpins = Number((usedDoc as any)?.count);
      const used = Number.isFinite(usedSpins) ? Math.max(0, Math.floor(usedSpins)) : (usedDoc ? 1 : 0);

      const bonusDoc = await bonusCol.findOne({ _id: `${steamId}_${todayKey}` } as any);
      const bonusCount = Number((bonusDoc as any)?.count);
      const bonus = Number.isFinite(bonusCount) ? Math.max(0, Math.floor(bonusCount)) : 0;

      const limitForDay = roleInfo.dailyLimit === null ? null : roleInfo.dailyLimit + bonus;
      const remainingSpins = limitForDay === null ? null : Math.max(0, limitForDay - used);

      const userTodayAgg = await historyCol
        .aggregate([
          { $match: { steamId, createdAt: { $gte: todayStart } } },
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
        bonusSpins: bonus,
        usedSpins: used,
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
