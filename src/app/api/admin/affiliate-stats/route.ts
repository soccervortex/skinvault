import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';

type RangeDays = 1 | 7 | 30 | 90 | 365 | 'all';

type SeriesPoint = {
  day: string;
  referrals: number;
  claims: number;
  creditsGranted: number;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseRangeDays(raw: string | null): RangeDays {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'all' || s === 'all_time' || s === 'alltime') return 'all';
  const n = Number(s);
  if (n === 1 || n === 7 || n === 30 || n === 90 || n === 365) return n as any;
  return 30;
}

async function computeSeriesDaily(db: any, start: Date, days: number): Promise<SeriesPoint[]> {
  const referralsCol = db.collection('affiliate_referrals');
  const claimsCol = db.collection('affiliate_milestone_claims');

  const end = addDays(start, days);

  const referralsPipeline = [
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $project: {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      },
    },
    { $group: { _id: '$day', referrals: { $sum: 1 } } },
    { $project: { _id: 0, day: '$_id', referrals: 1 } },
    { $sort: { day: 1 } },
  ];

  const claimsPipeline = [
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $project: {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        rewardType: '$reward.type',
        rewardAmount: '$reward.amount',
      },
    },
    {
      $group: {
        _id: '$day',
        claims: { $sum: 1 },
        creditsGranted: {
          $sum: {
            $cond: [
              { $eq: ['$rewardType', 'credits'] },
              { $ifNull: ['$rewardAmount', 0] },
              0,
            ],
          },
        },
      },
    },
    { $project: { _id: 0, day: '$_id', claims: 1, creditsGranted: 1 } },
    { $sort: { day: 1 } },
  ];

  const referralsRows = (await referralsCol.aggregate(referralsPipeline).toArray()) as any[];
  const claimsRows = (await claimsCol.aggregate(claimsPipeline).toArray()) as any[];

  const referralsByDay = new Map<string, number>();
  for (const r of referralsRows) {
    referralsByDay.set(String(r.day), Number(r.referrals || 0));
  }

  const claimsByDay = new Map<string, { claims: number; creditsGranted: number }>();
  for (const c of claimsRows) {
    claimsByDay.set(String(c.day), {
      claims: Number(c.claims || 0),
      creditsGranted: Number(c.creditsGranted || 0),
    });
  }

  const out: SeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const day = toDayString(addDays(start, i));
    const c = claimsByDay.get(day);
    out.push({
      day,
      referrals: Number(referralsByDay.get(day) || 0),
      claims: Number(c?.claims || 0),
      creditsGranted: Number(c?.creditsGranted || 0),
    });
  }

  return out;
}

async function computeSeriesMonthly(db: any): Promise<SeriesPoint[]> {
  const referralsCol = db.collection('affiliate_referrals');
  const claimsCol = db.collection('affiliate_milestone_claims');

  const referralsPipeline = [
    { $match: { createdAt: { $ne: null } } },
    {
      $project: {
        month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
      },
    },
    { $group: { _id: '$month', referrals: { $sum: 1 } } },
    { $project: { _id: 0, day: '$_id', referrals: 1 } },
    { $sort: { day: 1 } },
  ];

  const claimsPipeline = [
    { $match: { createdAt: { $ne: null } } },
    {
      $project: {
        month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        rewardType: '$reward.type',
        rewardAmount: '$reward.amount',
      },
    },
    {
      $group: {
        _id: '$month',
        claims: { $sum: 1 },
        creditsGranted: {
          $sum: {
            $cond: [
              { $eq: ['$rewardType', 'credits'] },
              { $ifNull: ['$rewardAmount', 0] },
              0,
            ],
          },
        },
      },
    },
    { $project: { _id: 0, day: '$_id', claims: 1, creditsGranted: 1 } },
    { $sort: { day: 1 } },
  ];

  const referralsRows = (await referralsCol.aggregate(referralsPipeline).toArray()) as any[];
  const claimsRows = (await claimsCol.aggregate(claimsPipeline).toArray()) as any[];

  const byKey = new Map<string, SeriesPoint>();
  for (const r of referralsRows) {
    const k = String(r.day);
    byKey.set(k, { day: k, referrals: Number(r.referrals || 0), claims: 0, creditsGranted: 0 });
  }
  for (const c of claimsRows) {
    const k = String(c.day);
    const prev = byKey.get(k) || { day: k, referrals: 0, claims: 0, creditsGranted: 0 };
    byKey.set(k, {
      ...prev,
      claims: Number(c.claims || 0),
      creditsGranted: Number(c.creditsGranted || 0),
    });
  }

  return Array.from(byKey.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));
}

type LeaderboardRow = {
  steamId: string;
  referrals: number;
  claims: number;
  creditsGranted: number;
  firstReferralAt: string | null;
  lastReferralAt: string | null;
};

async function computeLeaderboard(db: any, start: Date | null): Promise<LeaderboardRow[]> {
  const referralsCol = db.collection('affiliate_referrals');
  const claimsCol = db.collection('affiliate_milestone_claims');

  const referralsMatch: any = {};
  if (start) referralsMatch.createdAt = { $gte: start };

  const referralsPipeline = [
    { $match: referralsMatch },
    {
      $group: {
        _id: '$referrerSteamId',
        referrals: { $sum: 1 },
        firstReferralAt: { $min: '$createdAt' },
        lastReferralAt: { $max: '$createdAt' },
      },
    },
    {
      $project: {
        _id: 0,
        steamId: '$_id',
        referrals: 1,
        firstReferralAt: 1,
        lastReferralAt: 1,
      },
    },
    { $sort: { referrals: -1 } },
    { $limit: 100 },
  ];

  const claimsMatch: any = {};
  if (start) claimsMatch.createdAt = { $gte: start };

  const claimsPipeline = [
    { $match: claimsMatch },
    {
      $project: {
        steamId: 1,
        rewardType: '$reward.type',
        rewardAmount: '$reward.amount',
      },
    },
    {
      $group: {
        _id: '$steamId',
        claims: { $sum: 1 },
        creditsGranted: {
          $sum: {
            $cond: [
              { $eq: ['$rewardType', 'credits'] },
              { $ifNull: ['$rewardAmount', 0] },
              0,
            ],
          },
        },
      },
    },
    { $project: { _id: 0, steamId: '$_id', claims: 1, creditsGranted: 1 } },
  ];

  const referralRows = (await referralsCol.aggregate(referralsPipeline).toArray()) as any[];
  const claimRows = (await claimsCol.aggregate(claimsPipeline).toArray()) as any[];

  const claimsBySteamId = new Map<string, { claims: number; creditsGranted: number }>();
  for (const r of claimRows) {
    const steamId = String(r.steamId || '').trim();
    if (!steamId) continue;
    claimsBySteamId.set(steamId, {
      claims: Number(r.claims || 0),
      creditsGranted: Number(r.creditsGranted || 0),
    });
  }

  return referralRows
    .map((r) => {
      const steamId = String(r.steamId || '').trim();
      const c = claimsBySteamId.get(steamId);
      return {
        steamId,
        referrals: Number(r.referrals || 0),
        claims: Number(c?.claims || 0),
        creditsGranted: Number(c?.creditsGranted || 0),
        firstReferralAt: r.firstReferralAt ? new Date(r.firstReferralAt).toISOString() : null,
        lastReferralAt: r.lastReferralAt ? new Date(r.lastReferralAt).toISOString() : null,
      };
    })
    .filter((r) => /^\d{17}$/.test(r.steamId));
}

async function computeTotals(db: any) {
  const referralsCol = db.collection('affiliate_referrals');
  const claimsCol = db.collection('affiliate_milestone_claims');

  const totalReferrals = await referralsCol.countDocuments({});
  const uniqueAffiliates = (await referralsCol.distinct('referrerSteamId', {})).filter((x: any) => /^\d{17}$/.test(String(x || '').trim())).length;

  const claimsAgg = (await claimsCol
    .aggregate([
      {
        $project: {
          rewardType: '$reward.type',
          rewardAmount: '$reward.amount',
        },
      },
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          creditsGranted: {
            $sum: {
              $cond: [
                { $eq: ['$rewardType', 'credits'] },
                { $ifNull: ['$rewardAmount', 0] },
                0,
              ],
            },
          },
        },
      },
      { $project: { _id: 0, totalClaims: 1, creditsGranted: 1 } },
    ])
    .toArray()) as any[];

  const claimsRow = claimsAgg[0] || {};

  return {
    totalReferrals: Number(totalReferrals || 0),
    uniqueAffiliates: Number(uniqueAffiliates || 0),
    totalClaims: Number(claimsRow?.totalClaims || 0),
    creditsGranted: Number(claimsRow?.creditsGranted || 0),
  };
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!access.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasAdminPermission(access, 'affiliate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const rangeDays = parseRangeDays(searchParams.get('rangeDays'));

    const db = await getDatabase();

    const totals = await computeTotals(db);

    let series: SeriesPoint[] = [];
    let seriesMeta: any = null;

    if (rangeDays === 'all') {
      series = await computeSeriesMonthly(db);
      seriesMeta = {
        range: 'all',
        bucketFormat: '%Y-%m',
      };
    } else {
      const start = startOfDay(addDays(new Date(), -(rangeDays - 1)));
      series = await computeSeriesDaily(db, start, rangeDays);
      seriesMeta = {
        range: rangeDays,
        bucketFormat: '%Y-%m-%d',
        startDay: toDayString(start),
        endDay: toDayString(startOfDay(new Date())),
      };
    }

    const leaderboardStart = rangeDays === 'all'
      ? null
      : startOfDay(addDays(new Date(), -(rangeDays - 1)));

    const leaderboard = await computeLeaderboard(db, leaderboardStart);

    return NextResponse.json({
      ok: true,
      totals,
      series: { ...seriesMeta, data: series },
      leaderboard,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to compute affiliate stats' }, { status: 500 });
  }
}
