import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';
import { sanitizeSteamId } from '@/app/utils/sanitize';

export const runtime = 'nodejs';

type AdminUserDoc = {
  _id: string;
  enabled: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
};

function normalizePermission(value: unknown): string | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw.length > 64) return null;
  if (!/^[a-z0-9_*.-]+$/.test(raw)) return null;
  return raw;
}

export async function GET(req: NextRequest) {
  const access = await getAdminAccess(req);
  if (!hasAdminPermission(access, 'admin_users')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const db = await getDatabase();
    const col = db.collection<AdminUserDoc>('admin_users');

    const rows = await col
      .find({}, { projection: { _id: 1, enabled: 1, permissions: 1, createdAt: 1, updatedAt: 1 } } as any)
      .sort({ updatedAt: -1 } as any)
      .limit(500)
      .toArray();

    const admins = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      steamId: String(r?._id || ''),
      enabled: r?.enabled === true,
      permissions: Array.isArray(r?.permissions) ? r.permissions.map((p: any) => String(p || '')).filter(Boolean).slice(0, 64) : [],
      createdAt: String(r?.createdAt || ''),
      updatedAt: String(r?.updatedAt || ''),
    }));

    const res = NextResponse.json({ ok: true, admins }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load admins' }, { status: 500 });
  }
}

type CreateBody = {
  steamId?: string;
  permissions?: unknown[];
  enabled?: boolean;
};

export async function POST(req: NextRequest) {
  const access = await getAdminAccess(req);
  if (!hasAdminPermission(access, 'admin_users')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const body = (await req.json().catch(() => null)) as CreateBody | null;
    const steamId = sanitizeSteamId(body?.steamId) || null;
    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

    const enabled = body?.enabled !== false;
    const permsRaw = Array.isArray(body?.permissions) ? body!.permissions : [];
    const perms = Array.from(
      new Set(
        permsRaw
          .map((x) => normalizePermission(x))
          .filter(Boolean)
          .slice(0, 64) as string[]
      )
    );

    if (perms.length === 0) return NextResponse.json({ error: 'Missing permissions' }, { status: 400 });

    const now = new Date().toISOString();

    const db = await getDatabase();
    const col = db.collection<AdminUserDoc>('admin_users');

    await col.updateOne(
      { _id: steamId } as any,
      {
        $setOnInsert: { _id: steamId, createdAt: now } as any,
        $set: { enabled, permissions: perms, updatedAt: now } as any,
      } as any,
      { upsert: true }
    );

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save admin' }, { status: 500 });
  }
}
