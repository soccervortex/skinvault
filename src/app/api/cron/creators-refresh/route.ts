import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { CREATORS, type CreatorProfile } from '@/data/creators';

type CreatorSnapshot = {
  creator: CreatorProfile;
  live: {
    twitch: boolean | null;
    tiktok: boolean | null;
    youtube: boolean | null;
  };
  items: Array<{
    id: string;
    platform: 'tiktok' | 'youtube';
    title: string;
    url: string;
    thumbnailUrl?: string;
    publishedAt?: string;
  }>;
  updatedAt: string;
  lastCheckedAt: string;
  sources: {
    tiktokStatusApi?: string;
  };
};

function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
}

async function fetchTikTokStatusApi(username: string): Promise<any | null> {
  const base = process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421';
  const u = String(username || '').trim().replace(/^@/, '');
  if (!base || !u) return null;

  try {
    const url = `${String(base).replace(/\/$/, '')}/${encodeURIComponent(u)}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json,*/*', 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) return null;
      return await res.json();
    } finally {
      clearTimeout(id);
    }
  } catch {
    return null;
  }
}

async function refreshSnapshot(creator: CreatorProfile): Promise<CreatorSnapshot> {
  const sources: CreatorSnapshot['sources'] = {};
  sources.tiktokStatusApi = process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421';

  const live: CreatorSnapshot['live'] = { twitch: null, tiktok: null, youtube: null };
  const items: CreatorSnapshot['items'] = [];

  if (creator.tiktokUsername) {
    const status = await fetchTikTokStatusApi(creator.tiktokUsername);
    if (status?.is_live) {
      const v = String(status.is_live).trim().toUpperCase();
      if (v === 'YES') live.tiktok = true;
      else if (v === 'NO') live.tiktok = false;
    }
    if (status?.latest_video) {
      const url = String(status.latest_video).trim();
      if (url) {
        items.push({
          id: safeId(`tiktok_latest_${url}`),
          platform: 'tiktok',
          title: 'Latest TikTok',
          url,
        });
      }
    }
  }

  const now = new Date().toISOString();
  return { creator, live, items, updatedAt: now, lastCheckedAt: now, sources };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storedCreators = await dbGet<CreatorProfile[]>('creators_v1', false);
    const creators = Array.isArray(storedCreators) && storedCreators.length > 0 ? storedCreators : CREATORS;

    const results: Array<{ slug: string; ok: boolean; error?: string }> = [];
    for (const c of creators) {
      try {
        const snapshot = await refreshSnapshot(c);
        await dbSet(`creator_snapshot_${c.slug}`, snapshot);
        results.push({ slug: c.slug, ok: true });
      } catch (e: any) {
        results.push({ slug: c.slug, ok: false, error: e?.message || 'failed' });
      }
    }

    return NextResponse.json({ success: true, count: creators.length, results });
  } catch (error: any) {
    console.error('[Creators Refresh Cron] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
