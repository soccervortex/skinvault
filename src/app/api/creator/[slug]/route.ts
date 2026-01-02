import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { getCreatorBySlug, type CreatorProfile } from '@/data/creators';

type FeedItem = {
  id: string;
  platform: 'tiktok' | 'youtube';
  title: string;
  url: string;
  thumbnailUrl?: string;
  publishedAt?: string;
};

const CREATORS_KEY = 'creators_v1';

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

function findCreatorInList(creators: CreatorProfile[], slug: string): CreatorProfile | null {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return null;
  return (
    creators.find((c) => {
      if (String(c?.slug || '').toLowerCase() === s) return true;
      const aliases = Array.isArray((c as any)?.slugAliases) ? (c as any).slugAliases : [];
      return aliases.some((a: unknown) => String(a || '').toLowerCase() === s);
    }) || null
  );
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

  // Fast path: public uptime endpoint (no API key).
  // Returns either "offline" or a human-readable uptime when live.
  const uptimeText = await fetchText(`https://decapi.me/twitch/uptime/${encodeURIComponent(l)}`, 3000);
  if (uptimeText) {
    const s = uptimeText.trim().toLowerCase();
    if (s.includes('offline')) return false;
    // If it doesn't say offline, treat as live (examples: "1 hour 2 minutes")
    return true;
  }

  // Fallback: parse channel HTML (best-effort)
  const url = `https://www.twitch.tv/${encodeURIComponent(l)}`;
  const html = await fetchText(url, 4000);
  if (!html) return null;
  const m = html.match(/"isLiveBroadcast"\s*:\s*(true|false)/i);
  if (m && m[1]) return m[1].toLowerCase() === 'true';

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

async function fetchTikTokStatusApiFast(username: string): Promise<TikTokStatusApiResponse | null> {
  const base = process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421';
  const u = String(username || '').trim().replace(/^@/, '');
  if (!base || !u) return null;

  const url = `${String(base).replace(/\/$/, '')}/${encodeURIComponent(u)}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 2500);
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

    // Default to offline when configured so the UI always has a stable boolean.
    live.tiktok = false;

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

function buildMinimalSnapshot(creator: CreatorProfile): CreatorSnapshot {
  const live: CreatorSnapshot['live'] = { twitch: null, tiktok: null, youtube: null };
  const links: CreatorSnapshot['links'] = {};
  if (creator.tiktokUsername) {
    const clean = String(creator.tiktokUsername).trim().replace(/^@/, '');
    links.tiktok = `https://www.tiktok.com/@${clean}`;
    links.tiktokLive = `https://www.tiktok.com/@${clean}/live`;
  }
  if (creator.twitchLogin) {
    const clean = String(creator.twitchLogin).trim().replace(/^@/, '');
    links.twitch = `https://www.twitch.tv/${clean}`;
    links.twitchLive = links.twitch;
  }

  const now = new Date().toISOString();
  return {
    creator,
    live: { twitch: null, tiktok: creator.tiktokUsername ? false : null, youtube: null },
    links,
    items: [],
    updatedAt: now,
    lastCheckedAt: now,
    lastFastCheckedAt: now,
    sources: {
      tiktokStatusApi: process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421',
    },
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

  // Ensure a stable boolean when configured.
  if (creator.tiktokUsername && next.live.tiktok === null) next.live.tiktok = false;

  const status = await fetchTikTokStatusApi(creator.tiktokUsername);
  // If the status API is unreachable, keep the previous cached state so the badge doesn't disappear.
  if (!status) {
    next.lastFastCheckedAt = new Date().toISOString();
    return next;
  }
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const storedCreators = await dbGet<CreatorProfile[]>(CREATORS_KEY, false);
  const creatorFromDb = Array.isArray(storedCreators) ? findCreatorInList(storedCreators, slug) : null;
  const creator = creatorFromDb || getCreatorBySlug(slug);
  if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const snapshotKey = `creator_snapshot_${creator.slug}`;
  const cached = await dbGet<CreatorSnapshot>(snapshotKey, true);

  const url = new URL(request.url);
  const realtime = url.searchParams.get('realtime') === '1';

  // Optional realtime mode: do a quick TikTok status check (2.5s max) and merge it into the response.
  // This lets the UI poll for accurate live status without waiting for background refreshes.
  if (realtime && cached && creator.tiktokUsername) {
    const updated: CreatorSnapshot = {
      ...cached,
      live: { ...cached.live },
      links: { ...cached.links },
      items: Array.isArray(cached.items) ? [...cached.items] : [],
    };
    if (updated.live.tiktok === null) updated.live.tiktok = false;

    const status = await fetchTikTokStatusApiFast(creator.tiktokUsername);
    if (status?.is_live) {
      const v = String(status.is_live).trim().toUpperCase();
      if (v === 'YES') updated.live.tiktok = true;
      else if (v === 'NO') updated.live.tiktok = false;
    }
    if (status?.live_url) {
      const u = String(status.live_url).trim();
      if (u) updated.links.tiktokLive = u;
    }

    // Persist in background.
    void dbSet(snapshotKey, { ...updated, lastFastCheckedAt: new Date().toISOString() }).catch(() => {});
    return NextResponse.json(updated);
  }

  // Always respond fast: if no cached snapshot, return a minimal snapshot immediately
  // and refresh full data in the background.
  if (!cached) {
    const minimal = buildMinimalSnapshot(creator);
    void dbSet(snapshotKey, minimal);
    void refreshSnapshot(creator)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
    return NextResponse.json(minimal);
  }

  // If the TikTok status API config changed (or was newly enabled), refresh immediately
  // so the page can pick up latest_video/live without waiting for TTL.
  const currentStatusApi = process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421';
  const cachedStatusApi = cached?.sources?.tiktokStatusApi || '';
  if (cached && currentStatusApi && cachedStatusApi !== currentStatusApi) {
    void refreshSnapshot(creator)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
    return NextResponse.json(cached);
  }

  // If creator has TikTok configured but cached snapshot has no latest video yet, refresh now.
  // This avoids waiting for TTL when the status API already has the latest_video.
  if (cached && creator.tiktokUsername) {
    const hasLatestTikTok = Array.isArray(cached.items)
      ? cached.items.some((i) => i.platform === 'tiktok' && typeof i.url === 'string' && i.url.length > 0)
      : false;
    const hasTikTokLiveUrl = !!cached.links?.tiktokLive;
    if (!hasLatestTikTok || !hasTikTokLiveUrl) {
      void refreshSnapshot(creator)
        .then((fresh) => dbSet(snapshotKey, fresh))
        .catch(() => {});
      return NextResponse.json(cached);
    }
  }

  // If we have an older cached snapshot missing new fields, refresh now.
  if (cached && (!cached.links || !Array.isArray(cached.items))) {
    void refreshSnapshot(creator)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
    return NextResponse.json(cached);
  }

  // If cached snapshot is missing lastCheckedAt, don't block the response.
  // Schedule a background refresh and return cached immediately.
  if (!cached?.lastCheckedAt) {
    void refreshSnapshot(creator)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
    return NextResponse.json(cached);
  }

  // Fast path: keep TikTok latest_video/live fresh, but do it in the background
  // so requests return instantly.
  if (cached && creator.tiktokUsername) {
    const lastFast = cached.lastFastCheckedAt || cached.lastCheckedAt;
    const fastAge = Date.now() - new Date(lastFast).getTime();
    if (Number.isFinite(fastAge) && fastAge >= FAST_TIKTOK_REFRESH_MS) {
      void refreshTikTokOnly(cached, creator)
        .then((updated) => dbSet(snapshotKey, updated))
        .catch(() => {});
    }
  }

  const age = Date.now() - new Date(cached.lastCheckedAt).getTime();

  if (!Number.isFinite(age) || age < 0 || age > TTL_REFRESH_MS) {
    // Don't block response; refresh in background.
    void refreshSnapshot(creator)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
    return NextResponse.json(cached);
  }

  // Stale-while-revalidate: return cached immediately, but refresh in the background when stale.
  if (age > STALE_REVALIDATE_MS) {
    void refreshSnapshot(creator)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
  }

  return NextResponse.json(cached);
}
