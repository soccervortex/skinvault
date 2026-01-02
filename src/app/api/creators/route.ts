import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
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

async function readCreators(): Promise<CreatorProfile[]> {
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
      links: typeof body?.links === 'object' && body.links
        ? {
            website: typeof body.links.website === 'string' ? body.links.website : undefined,
            discord: typeof body.links.discord === 'string' ? body.links.discord : undefined,
            x: typeof body.links.x === 'string' ? body.links.x : undefined,
          }
        : undefined,
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
