import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

const ADMIN_HEADER = 'x-admin-key';

function safeInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sanitizeSteamId(input: string | null): string | null {
  const s = String(input || '').trim();
  return /^\d{17}$/.test(s) ? s : null;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GrantRow = {
  createdAt: string;
  bySteamId: string;
  targetSteamId: string;
  day: string;
  amount: number;
  reason: string | null;
  ip: string | null;
};

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
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const url = new URL(request.url);
    const page = safeInt(url.searchParams.get('page'), 1, 1, 100000);
    const limit = safeInt(url.searchParams.get('limit'), 50, 1, 200);

    const steamId = sanitizeSteamId(url.searchParams.get('steamId'));
    const qRaw = String(url.searchParams.get('q') || '').trim();
    const q = qRaw ? qRaw.replace(/[^0-9]/g, '') : '';

    const db = await getDatabase();
    const adminActionsCol = db.collection('admin_actions');

    const query: any = { type: 'spin_grant' };
    if (steamId) {
      query.targetSteamId = steamId;
    } else if (q) {
      query.$or = [
        { bySteamId: { $regex: q } },
        { targetSteamId: { $regex: q } },
      ];
    }
    const total = await adminActionsCol.countDocuments(query);
    const skip = (page - 1) * limit;

    const rows = await adminActionsCol
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const items: GrantRow[] = rows.map((r: any) => ({
      createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : new Date(0).toISOString(),
      bySteamId: String(r?.bySteamId || ''),
      targetSteamId: String(r?.targetSteamId || ''),
      day: String(r?.day || ''),
      amount: Number(r?.amount || 0),
      reason: r?.reason ? String(r.reason) : null,
      ip: r?.ip ? String(r.ip) : null,
    }));

    return NextResponse.json(
      { ok: true, page, limit, total, steamId: steamId || null, q: qRaw || null, items },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load grants' }, { status: 500 });
  }
}
