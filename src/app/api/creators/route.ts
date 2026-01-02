import { NextResponse } from 'next/server';
import { dbDelete, dbGet, dbSet } from '@/app/utils/database';
import { isOwner } from '@/app/utils/owner-ids';
import { CREATORS, type CreatorProfile } from '@/data/creators';

const CREATORS_KEY = 'creators_v1';

function normalizeSlug(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeHandle(input: unknown): string {
  const s = String(input || '').trim();
  if (!s) return '';
  return s.replace(/^@/, '');
}

export async function readCreators(): Promise<CreatorProfile[]> {
  const stored = await dbGet<CreatorProfile[]>(CREATORS_KEY, false);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return CREATORS;
}

export async function GET() {
  try {
    const creators = await readCreators();
    return NextResponse.json({ creators });
  } catch (error) {
    console.error('Failed to get creators:', error);
    return NextResponse.json({ creators: CREATORS });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const displayName = String(body?.displayName || '').trim();
    const slug = normalizeSlug(body?.slug || displayName);

    if (!displayName || !slug) {
      return NextResponse.json({ error: 'Missing displayName/slug' }, { status: 400 });
    }

    const nextCreator: CreatorProfile = {
      slug,
      displayName,
      tagline: typeof body?.tagline === 'string' ? body.tagline : undefined,
      avatarUrl: typeof body?.avatarUrl === 'string' ? body.avatarUrl : undefined,
      tiktokUsername: sanitizeHandle(body?.tiktokUsername),
      youtubeChannelId: sanitizeHandle(body?.youtubeChannelId),
      twitchLogin: sanitizeHandle(body?.twitchLogin),
    };

    const creators = await readCreators();
    const exists = creators.some((c) => c.slug.toLowerCase() === slug.toLowerCase());
    if (exists) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    const updated = [nextCreator, ...creators];
    await dbSet(CREATORS_KEY, updated);

    return NextResponse.json({ success: true, creator: nextCreator, creators: updated });
  } catch (error: any) {
    console.error('Failed to create creator:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create creator' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');
    const slug = String(url.searchParams.get('slug') || '').trim().toLowerCase();

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const creators = await readCreators();
    const toDelete = creators.find((c) => c.slug.toLowerCase() === slug) || null;
    if (!toDelete) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    const updated = creators.filter((c) => c.slug.toLowerCase() !== slug);
    await dbSet(CREATORS_KEY, updated);

    // Delete snapshot + cache keys.
    await dbDelete(`creator_snapshot_${toDelete.slug}`);
    await dbDelete(`creator_feed_key_${toDelete.slug}`);

    return NextResponse.json({ success: true, deleted: toDelete.slug, creators: updated });
  } catch (error: any) {
    console.error('Failed to delete creator:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete creator' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');
    const slug = String(url.searchParams.get('slug') || '').trim().toLowerCase();

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const body = await request.json();

    const creators = await readCreators();
    const idx = creators.findIndex((c) => c.slug.toLowerCase() === slug);
    if (idx === -1) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    const existing = creators[idx];

    const updatedCreator: CreatorProfile = {
      ...existing,
      displayName: typeof body?.displayName === 'string' ? body.displayName.trim() || existing.displayName : existing.displayName,
      tagline: typeof body?.tagline === 'string' ? body.tagline : existing.tagline,
      avatarUrl: typeof body?.avatarUrl === 'string' ? body.avatarUrl : existing.avatarUrl,
      tiktokUsername: typeof body?.tiktokUsername !== 'undefined' ? sanitizeHandle(body?.tiktokUsername) : existing.tiktokUsername,
      youtubeChannelId: typeof body?.youtubeChannelId !== 'undefined' ? sanitizeHandle(body?.youtubeChannelId) : existing.youtubeChannelId,
      twitchLogin: typeof body?.twitchLogin !== 'undefined' ? sanitizeHandle(body?.twitchLogin) : existing.twitchLogin,
    };

    const updated = [...creators];
    updated[idx] = updatedCreator;
    await dbSet(CREATORS_KEY, updated);

    await dbDelete(`creator_snapshot_${existing.slug}`);

    return NextResponse.json({ success: true, creator: updatedCreator, creators: updated });
  } catch (error: any) {
    console.error('Failed to update creator:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update creator' }, { status: 500 });
  }
}
