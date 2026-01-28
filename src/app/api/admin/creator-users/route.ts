import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { dbGet } from '@/app/utils/database';
import { OWNER_STEAM_IDS } from '@/app/utils/owner-ids';
import { isOwner } from '@/app/utils/owner-ids';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { CREATORS, type CreatorProfile } from '@/data/creators';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';
const CREATORS_KEY = 'creators_v1';

function safeInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

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

function collectExcludedSteamIds(creators: CreatorProfile[]): string[] {
  const out = new Set<string>();
  for (const sid of OWNER_STEAM_IDS as any) {
    const s = String(sid || '').trim();
    if (/^\d{17}$/.test(s)) out.add(s);
  }
  for (const c of creators) {
    const pid = String((c as any)?.partnerSteamId || '').trim();
    if (/^\d{17}$/.test(pid)) out.add(pid);
  }
  return Array.from(out);
}

export async function GET(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!access.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasAdminPermission(access, 'creator_users')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const slug = String(searchParams.get('slug') || '').trim().toLowerCase();
    const q = String(searchParams.get('q') || '').trim();
    const page = safeInt(searchParams.get('page'), 1, 1, 100000);
    const limit = safeInt(searchParams.get('limit'), 50, 1, 200);
    const range = parseRange(searchParams.get('range'));

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const creators = await readCreators();
    const creator = findCreatorInList(creators, slug);
    const excludeSteamIds = collectExcludedSteamIds(creators);
    const partnerSteamId = String(creator?.partnerSteamId || '').trim();
    const excludeSteamId = /^\d{17}$/.test(partnerSteamId) ? partnerSteamId : null;

    const db = await getDatabase();
    const attributions = db.collection('creator_attribution');

    const filter: any = { refSlug: slug };
    if (excludeSteamIds.length > 0) filter.steamId = { $nin: excludeSteamIds };
    if (q) {
      // SteamID is numeric, so substring search is fine.
      filter.steamId = {
        ...(filter.steamId && typeof filter.steamId === 'object' ? filter.steamId : {}),
        $regex: q.replace(/[^0-9]/g, ''),
      };
    }

    const total = await attributions.countDocuments(filter);
    const skip = (page - 1) * limit;

    const rows = await attributions
      .find(filter)
      .sort({ lastSeenAt: -1, firstSeenAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const steamIds = rows.map((r: any) => String(r.steamId)).filter((x: string) => /^\d{17}$/.test(x));

    let start: Date | null = null;
    if (range.mode === 'days') {
      start = startOfDay(addDays(new Date(), -(range.days - 1)));
    }

    const statsBySteamId = new Map<string, any>();
    if (steamIds.length > 0) {
      const events = db.collection('analytics_events');
      const match: any = { refSlug: slug, steamId: { $in: steamIds } };
      if (start) match.createdAt = { $gte: start };

      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: '$steamId',
            pageViews: { $sum: { $cond: [{ $eq: ['$event', 'page_view'] }, 1, 0] } },
            logins: { $sum: { $cond: [{ $eq: ['$event', 'steam_login'] }, 1, 0] } },
            newUsers: { $sum: { $cond: [{ $eq: ['$event', 'first_login'] }, 1, 0] } },
            proPurchases: { $sum: { $cond: [{ $eq: ['$event', 'pro_purchase'] }, 1, 0] } },
            lastEventAt: { $max: '$createdAt' },
          },
        },
        {
          $project: {
            _id: 0,
            steamId: '$_id',
            pageViews: 1,
            logins: 1,
            newUsers: 1,
            proPurchases: 1,
            lastEventAt: 1,
          },
        },
      ];

      const stats = (await events.aggregate(pipeline).toArray()) as any[];
      for (const s of stats) {
        statsBySteamId.set(String(s.steamId), s);
      }
    }

    const users = rows.map((r: any) => {
      const steamId = String(r.steamId);
      const s = statsBySteamId.get(steamId) || null;
      return {
        steamId,
        refSlug: String(r.refSlug || slug),
        firstSeenAt: r.firstSeenAt || null,
        lastSeenAt: r.lastSeenAt || null,
        sid: r.sid || null,
        pageViews: Number(s?.pageViews || 0),
        logins: Number(s?.logins || 0),
        newUsers: Number(s?.newUsers || 0),
        proPurchases: Number(s?.proPurchases || 0),
        lastEventAt: s?.lastEventAt || null,
      };
    });

    return NextResponse.json({
      ok: true,
      slug,
      excludeSteamId,
      excludeSteamIds,
      range,
      page,
      limit,
      total,
      users,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load creator users' }, { status: 500 });
  }
}
