import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

const ADMIN_HEADER = 'x-admin-key';

function parseRange(raw: string | null): { mode: 'days'; days: number } | { mode: 'all' } {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || s === '30') return { mode: 'days', days: 30 };
  if (s === 'all' || s === 'all_time' || s === 'alltime') return { mode: 'all' };
  const n = Number(s);
  if (n === 1 || n === 7 || n === 30 || n === 90 || n === 365) return { mode: 'days', days: n };
  return { mode: 'days', days: 30 };
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

export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;
    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requesterSteamId = getSteamIdFromRequest(request);
    if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwner(requesterSteamId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const slug = String(searchParams.get('slug') || '').trim().toLowerCase();
    const steamId = sanitizeSteamId(searchParams.get('steamId'));
    const range = parseRange(searchParams.get('range'));

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    }

    const db = await getDatabase();
    const events = db.collection('analytics_events');
    const attributions = db.collection('creator_attribution');

    const attribution = await attributions.findOne({ steamId });

    let match: any = { refSlug: slug, steamId };
    let bucketFormat = '%Y-%m-%d';
    let points: Array<any> = [];

    if (range.mode === 'days') {
      const start = startOfDay(addDays(new Date(), -(range.days - 1)));
      const end = addDays(start, range.days);
      match.createdAt = { $gte: start, $lt: end };

      const pipeline = [
        { $match: match },
        {
          $project: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            event: 1,
          },
        },
        {
          $group: {
            _id: '$day',
            pageViews: { $sum: { $cond: [{ $eq: ['$event', 'page_view'] }, 1, 0] } },
            logins: { $sum: { $cond: [{ $eq: ['$event', 'steam_login'] }, 1, 0] } },
            newUsers: { $sum: { $cond: [{ $eq: ['$event', 'first_login'] }, 1, 0] } },
            proPurchases: { $sum: { $cond: [{ $eq: ['$event', 'pro_purchase'] }, 1, 0] } },
          },
        },
        { $project: { _id: 0, day: '$_id', pageViews: 1, logins: 1, newUsers: 1, proPurchases: 1 } },
        { $sort: { day: 1 } },
      ];

      const rows = (await events.aggregate(pipeline).toArray()) as any[];
      const byDay = new Map<string, any>();
      for (const r of rows) byDay.set(String(r.day), r);

      for (let i = 0; i < range.days; i++) {
        const d = toDayString(addDays(start, i));
        const r = byDay.get(d);
        points.push({
          bucket: d,
          pageViews: Number(r?.pageViews || 0),
          logins: Number(r?.logins || 0),
          newUsers: Number(r?.newUsers || 0),
          proPurchases: Number(r?.proPurchases || 0),
        });
      }
    } else {
      // all-time: bucket by month for performance
      bucketFormat = '%Y-%m';
      const pipeline = [
        { $match: match },
        {
          $project: {
            bucket: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            event: 1,
          },
        },
        {
          $group: {
            _id: '$bucket',
            pageViews: { $sum: { $cond: [{ $eq: ['$event', 'page_view'] }, 1, 0] } },
            logins: { $sum: { $cond: [{ $eq: ['$event', 'steam_login'] }, 1, 0] } },
            newUsers: { $sum: { $cond: [{ $eq: ['$event', 'first_login'] }, 1, 0] } },
            proPurchases: { $sum: { $cond: [{ $eq: ['$event', 'pro_purchase'] }, 1, 0] } },
          },
        },
        { $project: { _id: 0, bucket: '$_id', pageViews: 1, logins: 1, newUsers: 1, proPurchases: 1 } },
        { $sort: { bucket: 1 } },
      ];

      points = (await events.aggregate(pipeline).toArray()) as any[];
    }

    const totals = points.reduce(
      (acc, p) => {
        acc.pageViews += Number(p.pageViews || 0);
        acc.logins += Number(p.logins || 0);
        acc.newUsers += Number(p.newUsers || 0);
        acc.proPurchases += Number(p.proPurchases || 0);
        return acc;
      },
      { pageViews: 0, logins: 0, newUsers: 0, proPurchases: 0 }
    );

    return NextResponse.json({
      ok: true,
      slug,
      steamId,
      range,
      bucketFormat,
      attribution: {
        refSlug: attribution?.refSlug ? String(attribution.refSlug) : null,
        firstSeenAt: attribution?.firstSeenAt || null,
        lastSeenAt: attribution?.lastSeenAt || null,
      },
      totals,
      series: points,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load user stats' }, { status: 500 });
  }
}
