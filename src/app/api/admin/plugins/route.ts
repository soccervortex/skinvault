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

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === '1';

    const db = await getDatabase();
    const plugins = await listPlugins(db, includeDeleted);

    const res = NextResponse.json({ plugins });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load plugins' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await request.json().catch(() => null);

    const slug = normalizePluginSlug(body?.slug);
    const name = String(body?.name || '').trim().slice(0, 80);
    const type = sanitizePluginType(body?.type);
    const enabled = body?.enabled === true;

    if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    if (!type) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    const config = sanitizeConfig(type, body?.config);

    const now = new Date().toISOString();
    const db = await getDatabase();
    const col = db.collection('plugins');

    const existing = await col.findOne({ _id: slug } as any);
    if (existing && existing.deleted !== true) {
      return NextResponse.json({ error: 'Plugin already exists' }, { status: 409 });
    }

    await col.updateOne(
      { _id: slug } as any,
      {
        $setOnInsert: {
          _id: slug,
          slug,
          createdAt: now,
        } as any,
        $set: {
          slug,
          name,
          type,
          enabled,
          deleted: false,
          config,
          updatedAt: now,
        } as any,
      } as any,
      { upsert: true }
    );

    const plugins = await listPlugins(db, true);
    const plugin = plugins.find((p) => p._id === slug) || null;

    return NextResponse.json({ ok: true, plugin });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create plugin' }, { status: 500 });
  }
}
