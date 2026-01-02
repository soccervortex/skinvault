import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { CREATORS, type CreatorProfile } from '@/data/creators';

type FeedItem = {
  id: string;
  platform: 'tiktok' | 'youtube';
  title: string;
  url: string;
  thumbnailUrl?: string;
  publishedAt?: string;
};

type TikTokStatusApiResponse = {
  is_live?: string;
  latest_video?: string;
  live_url?: string;
  user?: string;
};

type TikTokOEmbedResponse = {
  title?: string;
  thumbnail_url?: string;
};

type CreatorSnapshot = {
  creator: CreatorProfile;
  live: {
    twitch: boolean | null;
    tiktok: boolean | null;
    youtube: boolean | null;
  };
  links: {
    tiktok?: string;
    tiktokLive?: string;
    twitch?: string;
    twitchLive?: string;
  };
  items: FeedItem[];
  updatedAt: string;
  lastCheckedAt: string;
  lastFastCheckedAt?: string;
  sources: {
    tiktokStatusApi?: string;
  };
};

const TTL_REFRESH_MS = 1000 * 60 * 15; // refresh cadence
const STALE_REVALIDATE_MS = 1000 * 60 * 5; // if older than this, refresh in background
const FAST_TIKTOK_REFRESH_MS = 1000 * 60 * 2; // quick TikTok-only refresh cadence

function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,*/*',
      },
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(id);
  }
}

async function fetchTwitchIsLive(login: string): Promise<boolean | null> {
  const l = String(login || '').trim().replace(/^@/, '');
  if (!l) return null;
  const url = `https://www.twitch.tv/${encodeURIComponent(l)}`;
  const html = await fetchText(url, 8000);
  if (!html) return null;

  // Twitch embeds a large JSON blob containing isLiveBroadcast.
  const m = html.match(/"isLiveBroadcast"\s*:\s*(true|false)/i);
  if (m && m[1]) return m[1].toLowerCase() === 'true';

  // If we fetched the page but couldn't locate the field, treat as Offline rather than Unknown.
  // (This avoids showing null for configured streamers.)
  return false;
}

async function fetchTikTokOEmbed(videoUrl: string): Promise<TikTokOEmbedResponse | null> {
  const u = String(videoUrl || '').trim();
  if (!u) return null;

  const url = `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json,*/*',
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as TikTokOEmbedResponse;
    if (!json || typeof json !== 'object') return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function fetchTikTokStatusApi(username: string): Promise<TikTokStatusApiResponse | null> {
  const base = process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421';
  const u = String(username || '').trim().replace(/^@/, '');
  if (!base || !u) return null;

  const url = `${String(base).replace(/\/$/, '')}/${encodeURIComponent(u)}`;
  const attempt = async (timeoutMs: number): Promise<TikTokStatusApiResponse | null> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json,*/*',
          'User-Agent': 'Mozilla/5.0',
        },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as TikTokStatusApiResponse;
      if (!json || typeof json !== 'object') return null;
      return json;
    } catch {
      return null;
    } finally {
      clearTimeout(id);
    }
  };

  // Try once with a generous timeout; retry once if the first attempt fails.
  const first = await attempt(15000);
  if (first) return first;
  return await attempt(20000);
}

async function refreshSnapshot(creator: CreatorProfile): Promise<CreatorSnapshot> {
  const sources: CreatorSnapshot['sources'] = {};
  sources.tiktokStatusApi = process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421';

  const live: CreatorSnapshot['live'] = { twitch: null, tiktok: null, youtube: null };
  const links: CreatorSnapshot['links'] = {};
  const items: FeedItem[] = [];

  if (creator.twitchLogin) {
    const clean = String(creator.twitchLogin).trim().replace(/^@/, '');
    links.twitch = `https://www.twitch.tv/${clean}`;
    links.twitchLive = links.twitch;
    live.twitch = await fetchTwitchIsLive(clean);
  }

  if (creator.tiktokUsername) {
    const clean = String(creator.tiktokUsername).trim().replace(/^@/, '');
    links.tiktok = `https://www.tiktok.com/@${clean}`;
    links.tiktokLive = `https://www.tiktok.com/@${clean}/live`;

    const status = await fetchTikTokStatusApi(creator.tiktokUsername);
    if (status?.is_live) {
      const v = String(status.is_live).trim().toUpperCase();
      if (v === 'YES') live.tiktok = true;
      else if (v === 'NO') live.tiktok = false;
    }

    if (status?.live_url) {
      const u = String(status.live_url).trim();
      if (u) links.tiktokLive = u;
    }

    if (status?.latest_video) {
      const url = String(status.latest_video).trim();
      if (url) {
        const oembed = await fetchTikTokOEmbed(url);
        items.push({
          id: safeId(`tiktok_latest_${url}`),
          platform: 'tiktok',
          title: (oembed?.title && String(oembed.title).trim()) || 'Latest TikTok',
          url,
          thumbnailUrl: oembed?.thumbnail_url,
        });
      }
    }
  }

  const now = new Date().toISOString();
  return {
    creator,
    live,
    links,
    items,
    updatedAt: now,
    lastCheckedAt: now,
    sources,
  };
}

async function refreshTikTokOnly(cached: CreatorSnapshot, creator: CreatorProfile): Promise<CreatorSnapshot> {
  if (!creator.tiktokUsername) return cached;

  const clean = String(creator.tiktokUsername).trim().replace(/^@/, '');
  const next: CreatorSnapshot = {
    ...cached,
    creator,
    links: {
      ...cached.links,
      tiktok: `https://www.tiktok.com/@${clean}`,
      tiktokLive: `https://www.tiktok.com/@${clean}/live`,
    },
    live: { ...cached.live },
    items: Array.isArray(cached.items) ? [...cached.items] : [],
  };

  const status = await fetchTikTokStatusApi(creator.tiktokUsername);
  if (status?.is_live) {
    const v = String(status.is_live).trim().toUpperCase();
    if (v === 'YES') next.live.tiktok = true;
    else if (v === 'NO') next.live.tiktok = false;
  }

  if (status?.live_url) {
    const u = String(status.live_url).trim();
    if (u) next.links.tiktokLive = u;
  }

  const latestUrl = status?.latest_video ? String(status.latest_video).trim() : '';
  if (latestUrl) {
    const existingIdx = next.items.findIndex((i) => i.platform === 'tiktok');
    const existingUrl = existingIdx >= 0 ? String(next.items[existingIdx]?.url || '') : '';
    if (existingUrl !== latestUrl) {
      const oembed = await fetchTikTokOEmbed(latestUrl);
      const item: FeedItem = {
        id: safeId(`tiktok_latest_${latestUrl}`),
        platform: 'tiktok',
        title: (oembed?.title && String(oembed.title).trim()) || 'Latest TikTok',
        url: latestUrl,
        thumbnailUrl: oembed?.thumbnail_url,
      };
      if (existingIdx >= 0) next.items[existingIdx] = item;
      else next.items.unshift(item);
    }
  }

  next.lastFastCheckedAt = new Date().toISOString();
  return next;
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  const storedCreators = await dbGet<CreatorProfile[]>('creators_v1', true);
  const creatorList = Array.isArray(storedCreators) && storedCreators.length > 0 ? storedCreators : CREATORS;
  const creator = creatorList.find((c) => c.slug.toLowerCase() === String(slug).toLowerCase()) || null;
  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  const snapshotKey = `creator_snapshot_${creator.slug}`;
  const cached = await dbGet<CreatorSnapshot>(snapshotKey, true);

  // If the TikTok status API config changed (or was newly enabled), refresh immediately
  // so the page can pick up latest_video/live without waiting for TTL.
  const currentStatusApi = process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421';
  const cachedStatusApi = cached?.sources?.tiktokStatusApi || '';
  if (cached && currentStatusApi && cachedStatusApi !== currentStatusApi) {
    const fresh = await refreshSnapshot(creator);
    await dbSet(snapshotKey, fresh);
    return NextResponse.json(fresh);
  }

  // If creator has TikTok configured but cached snapshot has no latest video yet, refresh now.
  // This avoids waiting for TTL when the status API already has the latest_video.
  if (cached && creator.tiktokUsername) {
    const hasLatestTikTok = Array.isArray(cached.items)
      ? cached.items.some((i) => i.platform === 'tiktok' && typeof i.url === 'string' && i.url.length > 0)
      : false;
    const hasTikTokLiveUrl = !!cached.links?.tiktokLive;
    if (!hasLatestTikTok || !hasTikTokLiveUrl) {
      const fresh = await refreshSnapshot(creator);
      await dbSet(snapshotKey, fresh);
      return NextResponse.json(fresh);
    }
  }

  // If we have an older cached snapshot missing new fields, refresh now.
  if (cached && (!cached.links || !Array.isArray(cached.items))) {
    const fresh = await refreshSnapshot(creator);
    await dbSet(snapshotKey, fresh);
    return NextResponse.json(fresh);
  }

  // If missing or too old, refresh synchronously.
  if (!cached?.lastCheckedAt) {
    const fresh = await refreshSnapshot(creator);
    await dbSet(snapshotKey, fresh);
    return NextResponse.json(fresh);
  }

  // Fast path: keep TikTok latest_video/live fresh even when full snapshot TTL hasn't expired.
  if (cached && creator.tiktokUsername) {
    const lastFast = cached.lastFastCheckedAt || cached.lastCheckedAt;
    const fastAge = Date.now() - new Date(lastFast).getTime();
    if (Number.isFinite(fastAge) && fastAge >= FAST_TIKTOK_REFRESH_MS) {
      try {
        const updated = await refreshTikTokOnly(cached, creator);
        await dbSet(snapshotKey, updated);
        return NextResponse.json(updated);
      } catch {
        // ignore fast refresh errors; fall through to normal cached response
      }
    }
  }

  const age = Date.now() - new Date(cached.lastCheckedAt).getTime();

  if (!Number.isFinite(age) || age < 0 || age > TTL_REFRESH_MS) {
    const fresh = await refreshSnapshot(creator);
    await dbSet(snapshotKey, fresh);
    return NextResponse.json(fresh);
  }

  // Stale-while-revalidate: return cached immediately, but refresh in the background when stale.
  if (age > STALE_REVALIDATE_MS) {
    void refreshSnapshot(creator)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
  }

  return NextResponse.json(cached);
}
