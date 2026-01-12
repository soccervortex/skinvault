import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getAllProUsers } from '@/app/utils/pro-storage';

const ADMIN_HEADER = 'x-admin-key';

type WindowKey = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';

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

async function computeWindow(db: any, refSlugs: string[], start: Date | null, proMap: Record<string, string>) {
  const events = db.collection('analytics_events');
  const matchBase: any = {};
  if (start) matchBase.createdAt = { $gte: start };

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

    const db = await getDatabase();
    const events = db.collection('analytics_events');

    const proMap = await getAllProUsers().catch(() => ({} as Record<string, string>));

    const refSlugs = slug
      ? [String(slug).toLowerCase()]
      : (await events.distinct('refSlug', { refSlug: { $ne: null } })).map((s: any) => String(s).toLowerCase());

    const uniqueRefSlugs = Array.from(new Set(refSlugs)).filter(Boolean);

    const windows: WindowKey[] = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];
    const out: any = { windows: {} };

    for (const w of windows) {
      const start = getStartForWindow(w);
      out.windows[w] = await computeWindow(db, uniqueRefSlugs, start, proMap);
    }

    return NextResponse.json(out);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to compute creator stats' }, { status: 500 });
  }
}
