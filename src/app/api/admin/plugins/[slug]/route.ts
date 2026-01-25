import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { listPlugins, normalizePluginSlug, type PluginType } from '@/app/utils/plugins';

export const runtime = 'nodejs';

const ADMIN_HEADER = 'x-admin-key';

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ADMIN_PRO_TOKEN;
  const adminKey = request.headers.get(ADMIN_HEADER);

  if (expected && adminKey === expected) return true;

  const steamId = getSteamIdFromRequest(request);
  if (steamId && isOwner(steamId)) return true;

  return false;
}

function sanitizePluginType(value: unknown): PluginType | null {
  const t = String(value || '').trim();
  if (t === 'tawkto' || t === 'external_script') return t;
  return null;
}

function sanitizeConfig(type: PluginType, config: unknown): Record<string, any> {
  const raw = (config && typeof config === 'object') ? (config as any) : {};

  if (type === 'tawkto') {
    const embedUrl = String(raw?.embedUrl || '').trim();
    return {
      embedUrl: embedUrl || null,
    };
  }

  const src = String(raw?.src || '').trim();
  return {
    src: src || null,
  };
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const slug = normalizePluginSlug(params?.slug);
    if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

    const body = await request.json().catch(() => null);

    const db = await getDatabase();
    const col = db.collection('plugins');
    const existing = await col.findOne({ _id: slug } as any);

    if (!existing || existing.deleted === true) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    const patch: Record<string, any> = {};

    if (typeof body?.enabled === 'boolean') {
      patch.enabled = body.enabled;
    }

    if (typeof body?.name === 'string') {
      const name = String(body.name || '').trim().slice(0, 80);
      if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      patch.name = name;
    }

    if (typeof body?.type !== 'undefined') {
      const type = sanitizePluginType(body?.type);
      if (!type) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      patch.type = type;
      patch.config = sanitizeConfig(type, body?.config);
    } else if (typeof body?.config !== 'undefined') {
      const type = sanitizePluginType(existing.type) || 'external_script';
      patch.config = sanitizeConfig(type as any, body?.config);
    }

    const now = new Date().toISOString();
    patch.updatedAt = now;

    await col.updateOne({ _id: slug } as any, { $set: patch } as any);

    const plugins = await listPlugins(db, true);
    const plugin = plugins.find((p) => p._id === slug) || null;

    return NextResponse.json({ ok: true, plugin });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update plugin' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ slug: string }> | { slug: string } }) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const slug = normalizePluginSlug(params?.slug);
    if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

    const db = await getDatabase();
    const col = db.collection('plugins');

    const existing = await col.findOne({ _id: slug } as any);
    if (!existing || existing.deleted === true) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    await col.updateOne(
      { _id: slug } as any,
      {
        $set: {
          deleted: true,
          enabled: false,
          updatedAt: now,
        },
      } as any
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete plugin' }, { status: 500 });
  }
}
