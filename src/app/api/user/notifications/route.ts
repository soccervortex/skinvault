import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';

type UserNotificationDoc = {
  _id: ObjectId;
  steamId: string;
  type: string;
  title: string;
  message: string;
  createdAt: Date;
  readAt?: Date;
  meta?: any;
};

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const requesterSteamId = getSteamIdFromRequest(req);
  if (!requesterSteamId) {
    const url = new URL(req.url);
    const requested = sanitizeSteamId(url.searchParams.get('steamId'));
    const steamId = requested || null;
    const res = NextResponse.json(
      { ok: true, steamId, unreadCount: 0, notifications: [] },
      { status: 200 }
    );
    res.headers.set('cache-control', 'no-store');
    return res;
  }

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const url = new URL(req.url);
    const requested = sanitizeSteamId(url.searchParams.get('steamId'));
    const steamId = requested || requesterSteamId;

    const requesterIsOwner = isOwner(requesterSteamId);
    if (!requesterIsOwner && steamId !== requesterSteamId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rawLimit = Number(url.searchParams.get('limit') || 50);
    const limit = Math.min(200, Math.max(1, Math.floor(Number.isFinite(rawLimit) ? rawLimit : 50)));
    const unreadOnly = String(url.searchParams.get('unreadOnly') || '').trim() === 'true';

    const db = await getDatabase();
    const col = db.collection<UserNotificationDoc>('user_notifications');

    const filter: any = { steamId };
    if (unreadOnly) {
      filter.readAt = { $exists: false };
    }

    const rows = await col.find(filter, { sort: { createdAt: -1 }, limit }).toArray();

    const out = rows.map((r: any) => ({
      id: r?._id ? String(r._id) : '',
      steamId: String(r?.steamId || ''),
      type: String(r?.type || ''),
      title: String(r?.title || ''),
      message: String(r?.message || ''),
      createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : null,
      readAt: r?.readAt ? new Date(r.readAt).toISOString() : null,
      meta: r?.meta ?? null,
    }));

    const unreadCount = await col.countDocuments({ steamId, readAt: { $exists: false } } as any);

    const res = NextResponse.json({ ok: true, steamId, unreadCount, notifications: out }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load notifications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const requesterSteamId = getSteamIdFromRequest(req);
  if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const requested = sanitizeSteamId(body?.steamId);
    const steamId = requested || requesterSteamId;

    const requesterIsOwner = isOwner(requesterSteamId);
    if (!requesterIsOwner && steamId !== requesterSteamId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const markAll = !!body?.markAll;
    const idsRaw: any[] = Array.isArray(body?.ids) ? body.ids : [];

    const now = new Date();
    const db = await getDatabase();
    const col = db.collection<UserNotificationDoc>('user_notifications');

    if (markAll) {
      await col.updateMany({ steamId, readAt: { $exists: false } } as any, { $set: { readAt: now } } as any);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const ids = idsRaw
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 200);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Missing ids' }, { status: 400 });
    }

    const objectIds: ObjectId[] = [];
    for (const id of ids) {
      try {
        objectIds.push(new ObjectId(id));
      } catch {
        // ignore invalid
      }
    }

    if (objectIds.length === 0) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 });
    }

    await col.updateMany(
      { steamId, _id: { $in: objectIds }, readAt: { $exists: false } } as any,
      { $set: { readAt: now } } as any
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const requesterSteamId = getSteamIdFromRequest(req);
  if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const requested = sanitizeSteamId(body?.steamId);
    const steamId = requested || requesterSteamId;

    const requesterIsOwner = isOwner(requesterSteamId);
    if (!requesterIsOwner && steamId !== requesterSteamId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const idsRaw: any[] = Array.isArray(body?.ids) ? body.ids : (body?.id ? [body.id] : []);
    const ids = idsRaw
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 200);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Missing ids' }, { status: 400 });
    }

    const objectIds: ObjectId[] = [];
    for (const id of ids) {
      try {
        objectIds.push(new ObjectId(id));
      } catch {
        // ignore invalid
      }
    }

    if (objectIds.length === 0) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 });
    }

    const db = await getDatabase();
    const col = db.collection<UserNotificationDoc>('user_notifications');

    const res = await col.deleteMany({ steamId, _id: { $in: objectIds } } as any);
    return NextResponse.json({ ok: true, deleted: res?.deletedCount || 0 }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete notifications' }, { status: 500 });
  }
}
