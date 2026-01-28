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

type PatchBody = {
  enabled?: boolean;
  permissions?: unknown[];
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ steamId: string }> }) {
  const access = await getAdminAccess(req);
  if (!hasAdminPermission(access, 'admin_users')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const params = await Promise.resolve(ctx.params as any);
    const steamId = sanitizeSteamId(params?.steamId) || null;
    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as PatchBody | null;

    const patch: Record<string, any> = {};

    if (typeof body?.enabled === 'boolean') {
      patch.enabled = body.enabled;
    }

    if (typeof body?.permissions !== 'undefined') {
      const permsRaw = Array.isArray(body.permissions) ? body.permissions : [];
      const perms = Array.from(
        new Set(
          permsRaw
            .map((x) => normalizePermission(x))
            .filter(Boolean)
            .slice(0, 64) as string[]
        )
      );
      if (perms.length === 0) return NextResponse.json({ error: 'Missing permissions' }, { status: 400 });
      patch.permissions = perms;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No changes' }, { status: 400 });
    }

    patch.updatedAt = new Date().toISOString();

    const db = await getDatabase();
    const col = db.collection<AdminUserDoc>('admin_users');

    const existing = await col.findOne({ _id: steamId } as any, { projection: { _id: 1 } } as any);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await col.updateOne({ _id: steamId } as any, { $set: patch } as any);

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update admin' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ steamId: string }> }) {
  const access = await getAdminAccess(req);
  if (!hasAdminPermission(access, 'admin_users')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const params = await Promise.resolve(ctx.params as any);
    const steamId = sanitizeSteamId(params?.steamId) || null;
    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

    const db = await getDatabase();
    const col = db.collection<AdminUserDoc>('admin_users');

    const resDelete = await col.deleteOne({ _id: steamId } as any);
    if (resDelete.deletedCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete admin' }, { status: 500 });
  }
}
