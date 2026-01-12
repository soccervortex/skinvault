import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getAllProUsers } from '@/app/utils/pro-storage';
import { dbGet } from '@/app/utils/database';
import { CREATORS, type CreatorProfile } from '@/data/creators';

const ADMIN_HEADER = 'x-admin-key';

type WindowKey = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';

type SeriesPoint = {
  day: string;
  pageViews: number;
  uniqueVisitors: number;
  activeUsers: number;
  logins: number;
  newUsers: number;
  proPurchases: number;
};

function getStartForWindow(key: WindowKey): Date | null {
  const now = new Date();
  if (key === 'all_time') return null;

  if (key === 'daily') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const days = key === 'weekly' ? 7 : key === 'monthly' ? 30 : 365;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

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

function parseRange(raw: string | null): { mode: 'days'; days: number } | { mode: 'all' } {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'all' || s === 'all_time' || s === 'alltime') return { mode: 'all' };
  const n = Number(s);
  if (n === 1 || n === 7 || n === 30 || n === 90 || n === 365) return { mode: 'days', days: n };
  return { mode: 'days', days: 30 };
}

const CREATORS_KEY = 'creators_v1';

function findCreatorInList(list: CreatorProfile[], slug: string): CreatorProfile | null {
  const s = String(slug || '').toLowerCase();
  return (
    list.find((c) => {
      if (String(c.slug || '').toLowerCase() === s) return true;
      const aliases = Array.isArray(c.slugAliases) ? c.slugAliases : [];
      return aliases.some((a) => String(a || '').toLowerCase() === s);
    }) || null
  );
}

async function readCreators(): Promise<CreatorProfile[]> {
  const stored = await dbGet<CreatorProfile[]>(CREATORS_KEY, false);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return CREATORS;
}

async function computeLeaderboard(
  db: any,
  start: Date,
  slug: string | null,
  proMap: Record<string, string>,
  excludeSteamId: string | null,
) {
  const events = db.collection('analytics_events');
  const match: any = { createdAt: { $gte: start }, refSlug: { $ne: null } };
  if (slug) match.refSlug = String(slug).toLowerCase();
  if (excludeSteamId) match.steamId = { $ne: excludeSteamId };

  const pipeline = [
    { $match: match },
    {
      $project: {
        refSlug: 1,
        event: 1,
        sid: 1,
        steamId: 1,
      },
    },
    {
      $group: {
        _id: '$refSlug',
        pageViews: { $sum: { $cond: [{ $eq: ['$event', 'page_view'] }, 1, 0] } },
        logins: { $sum: { $cond: [{ $eq: ['$event', 'steam_login'] }, 1, 0] } },
        proPurchases: { $sum: { $cond: [{ $eq: ['$event', 'pro_purchase'] }, 1, 0] } },
        uniqueVisitorsSet: {
          $addToSet: {
            $cond: [
              { $and: [{ $eq: ['$event', 'page_view'] }, { $ne: ['$sid', null] }] },
              '$sid',
              '$$REMOVE',
            ],
          },
        },
        activeUsersSet: {
          $addToSet: {
            $cond: [{ $ne: ['$steamId', null] }, '$steamId', '$$REMOVE'],
          },
        },
        newUsersSet: {
          $addToSet: {
            $cond: [
              { $and: [{ $eq: ['$event', 'first_login'] }, { $ne: ['$steamId', null] }] },
              '$steamId',
              '$$REMOVE',
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        slug: '$_id',
        pageViews: 1,
        logins: 1,
        proPurchases: 1,
        uniqueVisitors: { $size: '$uniqueVisitorsSet' },
        activeUsers: { $size: '$activeUsersSet' },
        newUsers: { $size: '$newUsersSet' },
        activeUsersList: '$activeUsersSet',
      },
    },
  ];

  const rows = (await events.aggregate(pipeline).toArray()) as any[];
  const now = new Date();
  return rows
    .map((r) => {
      const list = Array.isArray(r.activeUsersList) ? r.activeUsersList : [];
      let proActiveUsers = 0;
      for (const sid of list) {
        const until = proMap[String(sid)] || null;
        if (until && new Date(until) > now) proActiveUsers++;
      }
      return {
        slug: String(r.slug || ''),
        pageViews: Number(r.pageViews || 0),
        uniqueVisitors: Number(r.uniqueVisitors || 0),
        activeUsers: Number(r.activeUsers || 0),
        uniqueUsers: Number(r.activeUsers || 0),
        newUsers: Number(r.newUsers || 0),
        returningUsers: Math.max(0, Number(r.activeUsers || 0) - Number(r.newUsers || 0)),
        logins: Number(r.logins || 0),
        proPurchases: Number(r.proPurchases || 0),
        proActiveUsers,
      };
    })
    .sort((a, b) => b.pageViews - a.pageViews);
}

async function computeSeries(
  db: any,
  start: Date,
  days: number,
  slug: string | null,
  excludeSteamId: string | null,
): Promise<SeriesPoint[]> {
  const events = db.collection('analytics_events');
  const end = addDays(start, days);

  const match: any = { createdAt: { $gte: start, $lt: end } };
  if (slug) {
    match.refSlug = String(slug).toLowerCase();
  } else {
    match.refSlug = { $ne: null };
  }
  if (excludeSteamId) match.steamId = { $ne: excludeSteamId };

  const pipeline = [
    { $match: match },
    {
      $project: {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        event: 1,
        sid: 1,
        steamId: 1,
      },
    },
    {
      $group: {
        _id: '$day',
        pageViews: { $sum: { $cond: [{ $eq: ['$event', 'page_view'] }, 1, 0] } },
        logins: { $sum: { $cond: [{ $eq: ['$event', 'steam_login'] }, 1, 0] } },
        proPurchases: { $sum: { $cond: [{ $eq: ['$event', 'pro_purchase'] }, 1, 0] } },
        uniqueVisitorsSet: {
          $addToSet: {
            $cond: [
              { $and: [{ $eq: ['$event', 'page_view'] }, { $ne: ['$sid', null] }] },
              '$sid',
              '$$REMOVE',
            ],
          },
        },
        activeUsersSet: {
          $addToSet: {
            $cond: [{ $ne: ['$steamId', null] }, '$steamId', '$$REMOVE'],
          },
        },
        newUsersSet: {
          $addToSet: {
            $cond: [
              { $and: [{ $eq: ['$event', 'first_login'] }, { $ne: ['$steamId', null] }] },
              '$steamId',
              '$$REMOVE',
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        day: '$_id',
        pageViews: 1,
        logins: 1,
        proPurchases: 1,
        uniqueVisitors: { $size: '$uniqueVisitorsSet' },
        activeUsers: { $size: '$activeUsersSet' },
        newUsers: { $size: '$newUsersSet' },
      },
    },
    { $sort: { day: 1 } },
  ];

  const rows = (await events.aggregate(pipeline).toArray()) as any[];
  const byDay = new Map<string, any>();
  for (const r of rows) {
    byDay.set(String(r.day), r);
  }

  const out: SeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = toDayString(addDays(start, i));
    const r = byDay.get(d);
    out.push({
      day: d,
      pageViews: Number(r?.pageViews || 0),
      uniqueVisitors: Number(r?.uniqueVisitors || 0),
      activeUsers: Number(r?.activeUsers || 0),
      logins: Number(r?.logins || 0),
      newUsers: Number(r?.newUsers || 0),
      proPurchases: Number(r?.proPurchases || 0),
    });
  }
  return out;
}

async function computeSeriesMonthly(db: any, slug: string | null, excludeSteamId: string | null): Promise<SeriesPoint[]> {
  const events = db.collection('analytics_events');

  const match: any = {};
  if (slug) {
    match.refSlug = String(slug).toLowerCase();
  } else {
    match.refSlug = { $ne: null };
  }
  if (excludeSteamId) match.steamId = { $ne: excludeSteamId };

  const pipeline = [
    { $match: match },
    {
      $project: {
        month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        event: 1,
        sid: 1,
        steamId: 1,
      },
    },
    {
      $group: {
        _id: '$month',
        pageViews: { $sum: { $cond: [{ $eq: ['$event', 'page_view'] }, 1, 0] } },
        logins: { $sum: { $cond: [{ $eq: ['$event', 'steam_login'] }, 1, 0] } },
        proPurchases: { $sum: { $cond: [{ $eq: ['$event', 'pro_purchase'] }, 1, 0] } },
        uniqueVisitorsSet: {
          $addToSet: {
            $cond: [
              { $and: [{ $eq: ['$event', 'page_view'] }, { $ne: ['$sid', null] }] },
              '$sid',
              '$$REMOVE',
            ],
          },
        },
        activeUsersSet: {
          $addToSet: {
            $cond: [{ $ne: ['$steamId', null] }, '$steamId', '$$REMOVE'],
          },
        },
        newUsersSet: {
          $addToSet: {
            $cond: [
              { $and: [{ $eq: ['$event', 'first_login'] }, { $ne: ['$steamId', null] }] },
              '$steamId',
              '$$REMOVE',
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        day: '$_id',
        pageViews: 1,
        logins: 1,
        proPurchases: 1,
        uniqueVisitors: { $size: '$uniqueVisitorsSet' },
        activeUsers: { $size: '$activeUsersSet' },
        newUsers: { $size: '$newUsersSet' },
      },
    },
    { $sort: { day: 1 } },
  ];

  const rows = (await events.aggregate(pipeline).toArray()) as any[];
  return rows.map((r) => ({
    day: String(r.day),
    pageViews: Number(r.pageViews || 0),
    uniqueVisitors: Number(r.uniqueVisitors || 0),
    activeUsers: Number(r.activeUsers || 0),
    logins: Number(r.logins || 0),
    newUsers: Number(r.newUsers || 0),
    proPurchases: Number(r.proPurchases || 0),
  }));
}

async function computeWindow(
  db: any,
  refSlugs: string[],
  start: Date | null,
  proMap: Record<string, string>,
  excludeSteamId: string | null,
) {
  const events = db.collection('analytics_events');
  const matchBase: any = {};
  if (start) matchBase.createdAt = { $gte: start };
  if (excludeSteamId) matchBase.steamId = { $ne: excludeSteamId };

  const result: Record<string, any> = {};

  for (const slug of refSlugs) {
    const match = { ...matchBase, refSlug: slug };

    const pageViews = await events.countDocuments({ ...match, event: 'page_view' });
    const uniqueVisitors = (await events.distinct('sid', { ...match, event: 'page_view', sid: { $ne: null } })).length;
    const activeUsersList = await events.distinct('steamId', { ...match, steamId: { $ne: null } });
    const activeUsers = activeUsersList.length;

    const newUsers = (await events.distinct('steamId', { ...match, event: 'first_login', steamId: { $ne: null } })).length;
    const logins = await events.countDocuments({ ...match, event: 'steam_login' });
    const proPurchases = await events.countDocuments({ ...match, event: 'pro_purchase' });

    let proActiveUsers = 0;
    const now = new Date();
    for (const sid of activeUsersList) {
      const until = proMap[String(sid)] || null;
      if (until && new Date(until) > now) proActiveUsers++;
    }

    result[slug] = {
      pageViews,
      uniqueVisitors,
      activeUsers,
      uniqueUsers: activeUsers,
      returningUsers: Math.max(0, activeUsers - newUsers),
      newUsers,
      logins,
      proPurchases,
      proActiveUsers,
    };
  }

  return result;
}

export async function GET(request: Request) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;
    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const range = parseRange(searchParams.get('rangeDays'));

    const includeWindows = searchParams.get('includeWindows') !== '0';
    const includeSeries = searchParams.get('includeSeries') !== '0';
    const includeLeaderboard = searchParams.get('includeLeaderboard') !== '0';

    const normalizedSlug = slug ? String(slug).toLowerCase() : null;

    // Exclude creator's own SteamID from their stats when querying a single creator.
    let excludeSteamId: string | null = null;
    if (normalizedSlug) {
      try {
        const creators = await readCreators();
        const c = findCreatorInList(creators, normalizedSlug);
        const pid = String(c?.partnerSteamId || '').trim();
        excludeSteamId = /^\d{17}$/.test(pid) ? pid : null;
      } catch {
        excludeSteamId = null;
      }
    }

    const db = await getDatabase();
    const events = db.collection('analytics_events');

    const proMap = await getAllProUsers().catch(() => ({} as Record<string, string>));

    const refSlugs = slug
      ? [String(slug).toLowerCase()]
      : (await events.distinct('refSlug', { refSlug: { $ne: null } })).map((s: any) => String(s).toLowerCase());

    const uniqueRefSlugs = Array.from(new Set(refSlugs)).filter(Boolean);

    const out: any = { creators: uniqueRefSlugs };

    if (includeWindows) {
      const windows: WindowKey[] = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];
      out.windows = {};
      for (const w of windows) {
        const start = getStartForWindow(w);
        out.windows[w] = await computeWindow(db, uniqueRefSlugs, start, proMap, excludeSteamId);
      }
    }

    if (includeSeries) {
      if (range.mode === 'all') {
        out.series = {
          range: 'all',
          bucketFormat: '%Y-%m',
          slug: normalizedSlug,
          startDay: null,
          endDay: toDayString(startOfDay(new Date())),
          data: await computeSeriesMonthly(db, normalizedSlug, excludeSteamId),
        };
      } else {
        const seriesStart = startOfDay(addDays(new Date(), -(range.days - 1)));
        out.series = {
          range: range.days,
          bucketFormat: '%Y-%m-%d',
          slug: normalizedSlug,
          startDay: toDayString(seriesStart),
          endDay: toDayString(startOfDay(new Date())),
          data: await computeSeries(db, seriesStart, range.days, normalizedSlug, excludeSteamId),
        };
      }
    }

    if (includeLeaderboard) {
      const leaderboardStart = range.mode === 'all'
        ? null
        : startOfDay(addDays(new Date(), -(range.days - 1)));
      const leaderboardStartDate = leaderboardStart || new Date(0);

      out.leaderboard = await computeLeaderboard(db, leaderboardStartDate, null, proMap, null);
      if (slug) {
        out.leaderboard = out.leaderboard.filter((r: any) => String(r.slug) === String(slug).toLowerCase());
      }
    }

    out.excludedSteamId = excludeSteamId;

    return NextResponse.json(out);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to compute creator stats' }, { status: 500 });
  }
}
