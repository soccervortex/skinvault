import { NextRequest, NextResponse } from 'next/server';
import { dbDelete, dbGet, dbSet } from '@/app/utils/database';
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
const TWITCH_CONNECTION_PREFIX = 'creator_twitch_connection_';
const TIKTOK_CONNECTION_PREFIX = 'creator_tiktok_connection_';

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

type TikTokConnection = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  openId?: string;
  scope?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  connectedAt?: string;
};

type TikTokVideoListResponse = {
  data?: {
    videos?: Array<{
      id?: string;
      title?: string;
      cover_image_url?: string;
      create_time?: number;
    }>;
    cursor?: number;
    has_more?: boolean;
  };
  error?: { code?: string; message?: string; log_id?: string };
};

function extractMetaContent(html: string, property: string): string {
  const h = String(html || '');
  if (!h) return '';

  // Match either <meta property="og:image" content="..."> or <meta content="..." property="og:image">
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`,
    'i'
  );
  const m = h.match(re);
  const v = (m && (m[1] || m[2])) ? String(m[1] || m[2]).trim() : '';
  return v;
}

async function fetchTwitchIsLiveWithOAuthDetailed(
  login: string,
  accessToken: string
): Promise<{ isLive: boolean | null; unauthorized: boolean }> {
  const l = String(login || '').trim().replace(/^@/, '');
  const token = String(accessToken || '').trim();
  const clientId = process.env.TWITCH_CLIENT_ID || '';
  if (!l || !token || !clientId) return { isLive: null, unauthorized: false };

  try {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(l)}`, {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) return { isLive: null, unauthorized: true };
    if (!res.ok) return { isLive: null, unauthorized: false };
    const json = await res.json().catch(() => ({} as any));
    const data = Array.isArray(json?.data) ? json.data : [];
    return { isLive: data.length > 0, unauthorized: false };
  } catch {
    return { isLive: null, unauthorized: false };
  }
}

async function fetchTikTokLatestVideoWithOAuthOrFallback(
  conn: TikTokConnection,
  usernameFallback: string
): Promise<{ url: string; title: string; thumbnailUrl?: string; unauthorized?: boolean } | null> {
  const token = String(conn?.accessToken || '').trim();
  const username = String(conn?.username || '').trim().replace(/^@/, '');
  const fallback = String(usernameFallback || '').trim().replace(/^@/, '');
  if (!token || (!username && !fallback)) return null;

  const url = 'https://open.tiktokapis.com/v2/video/list/?fields=cover_image_url,id,title';

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ max_count: 1 }),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return { url: '', title: '', unauthorized: true };
    }

    const json = (await res.json().catch(() => ({} as any))) as TikTokVideoListResponse;
    const videos = Array.isArray(json?.data?.videos) ? json.data.videos : [];
    const v = videos[0] || null;
    const videoId = v?.id ? String(v.id) : '';
    if (!res.ok || !videoId) return null;

    const useName = username || fallback;
    const videoUrl = `https://www.tiktok.com/@${encodeURIComponent(useName)}/video/${encodeURIComponent(videoId)}`;
    const title = v?.title ? String(v.title) : 'Latest TikTok';
    const thumbnailUrl = v?.cover_image_url ? String(v.cover_image_url) : undefined;
    return { url: videoUrl, title, thumbnailUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function fetchTikTokLatestVideoWithOAuth(conn: TikTokConnection): Promise<{ url: string; title: string; thumbnailUrl?: string } | null> {
  const token = String(conn?.accessToken || '').trim();
  const username = String(conn?.username || '').trim().replace(/^@/, '');
  if (!token || !username) return null;

  const url = 'https://open.tiktokapis.com/v2/video/list/?fields=cover_image_url,id,title';

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ max_count: 1 }),
      cache: 'no-store',
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => ({} as any))) as TikTokVideoListResponse;
    const videos = Array.isArray(json?.data?.videos) ? json.data.videos : [];
    const v = videos[0] || null;
    const videoId = v?.id ? String(v.id) : '';
    if (!res.ok || !videoId) return null;

    const videoUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}/video/${encodeURIComponent(videoId)}`;
    const title = v?.title ? String(v.title) : 'Latest TikTok';
    const thumbnailUrl = v?.cover_image_url ? String(v.cover_image_url) : undefined;
    return { url: videoUrl, title, thumbnailUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function fetchTwitchIsLiveWithOAuth(login: string, accessToken: string): Promise<boolean | null> {
  const l = String(login || '').trim().replace(/^@/, '');
  const token = String(accessToken || '').trim();
  const clientId = process.env.TWITCH_CLIENT_ID || '';
  if (!l || !token || !clientId) return null;

  try {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(l)}`, {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    return data.length > 0;
  } catch {
    return null;
  }
}

async function fetchYouTubeLiveVideoIdFast(channelId: string): Promise<string> {
  const id = String(channelId || '').trim();
  if (!id) return '';

  const html = await fetchText(`https://www.youtube.com/channel/${encodeURIComponent(id)}/live`, 2500);
  if (!html) return '';

  // Heuristic: YouTube sets isLiveNow for live streams.
  if (!/"isLiveNow"\s*:\s*true/i.test(html)) return '';

  // Find a videoId (first occurrence is usually the live stream).
  const m = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
  return m && m[1] ? String(m[1]) : '';
}

async function fetchYouTubeLatestVideoFast(channelId: string): Promise<{ videoId: string; title: string; publishedAt?: string; thumbnailUrl?: string } | null> {
  const id = String(channelId || '').trim();
  if (!id) return null;

  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`, 2500);
  if (!xml) return null;

  const videoId = (xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] || '').trim();
  if (!videoId) return null;

  const title = (xml.match(/<title>([^<]+)<\/title>/i)?.[1] || '').trim();
  const publishedAt = (xml.match(/<published>([^<]+)<\/published>/i)?.[1] || '').trim();
  const thumb = (xml.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] || '').trim();

  return {
    videoId,
    title: title || 'Latest YouTube',
    publishedAt: publishedAt || undefined,
    thumbnailUrl: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchYouTubeLiveVideoIdWithApi(channelId: string): Promise<string> {
  const key = process.env.YOUTUBE_API_KEY || '';
  const id = String(channelId || '').trim();
  if (!key || !id) return '';

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(id)}&eventType=live&type=video&maxResults=1&key=${encodeURIComponent(key)}`;
  const json = await fetchJsonWithTimeout(url, 4500);
  const item = Array.isArray(json?.items) ? json.items[0] : null;
  const videoId = item?.id?.videoId ? String(item.id.videoId) : '';
  return videoId;
}

async function fetchYouTubeLatestVideoWithApi(channelId: string): Promise<{ videoId: string; title: string; publishedAt?: string; thumbnailUrl?: string } | null> {
  const key = process.env.YOUTUBE_API_KEY || '';
  const id = String(channelId || '').trim();
  if (!key || !id) return null;

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(id)}&order=date&type=video&maxResults=1&key=${encodeURIComponent(key)}`;
  const json = await fetchJsonWithTimeout(url, 4500);
  const item = Array.isArray(json?.items) ? json.items[0] : null;
  const videoId = item?.id?.videoId ? String(item.id.videoId) : '';
  if (!videoId) return null;

  const title = item?.snippet?.title ? String(item.snippet.title) : 'Latest YouTube';
  const publishedAt = item?.snippet?.publishedAt ? String(item.snippet.publishedAt) : undefined;
  const thumb = item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url;

  return {
    videoId,
    title,
    publishedAt,
    thumbnailUrl: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

async function fetchTikTokOgPreviewFast(videoUrl: string): Promise<TikTokOEmbedResponse | null> {
  const u = String(videoUrl || '').trim();
  if (!u) return null;

  // TikTok oEmbed can rate-limit or be blocked. As a fallback, try to scrape OpenGraph tags.
  const html = await fetchText(u, 2500);
  if (!html) return null;

  const thumbnail_url = extractMetaContent(html, 'og:image');
  const title = extractMetaContent(html, 'og:title') || extractMetaContent(html, 'twitter:title');
  if (!thumbnail_url && !title) return null;

  return {
    title: title || undefined,
    thumbnail_url: thumbnail_url || undefined,
  };
}

async function fetchTikTokPreviewFast(videoUrl: string): Promise<TikTokOEmbedResponse | null> {
  const oembed = await fetchTikTokOEmbedFast(videoUrl, 2500);
  if (oembed?.thumbnail_url || oembed?.title) return oembed;
  return await fetchTikTokOgPreviewFast(videoUrl);
}

function getTikTokLatestVideoUrl(status: TikTokStatusApiResponse | null, username: string): string {
  if (!status) return '';
  const raw = (status as any)?.latest_video ?? (status as any)?.latestVideo ?? (status as any)?.latest_video_url;
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;

  // Some status APIs return only the video ID.
  if (/^\d+$/.test(v)) {
    const clean = String(username || '').trim().replace(/^@/, '');
    if (!clean) return '';
    return `https://www.tiktok.com/@${clean}/video/${v}`;
  }

  // If it already looks like a TikTok path, attempt to normalize.
  if (v.startsWith('/')) return `https://www.tiktok.com${v}`;
  if (v.includes('tiktok.com/')) return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return '';
}

type CreatorSnapshot = {
  creator: CreatorProfile;
  live: {
    twitch: boolean | null;
    tiktok: boolean | null;
    youtube: boolean | null;
  };
  connections: {
    twitchConnected: boolean;
    tiktokConnected: boolean;
  };
  links: {
    tiktok?: string;
    tiktokLive?: string;
    twitch?: string;
    twitchLive?: string;
    youtube?: string;
    youtubeLive?: string;
  };
  items: FeedItem[];
  updatedAt: string;
  lastCheckedAt: string;
  lastFastCheckedAt?: string;
  sources: {
    tiktokStatusApi?: string;
    tiktok?: string;
    twitch?: string;
    youtube?: string;
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

async function fetchTikTokOEmbedFast(videoUrl: string, timeoutMs: number = 2500): Promise<TikTokOEmbedResponse | null> {
  const u = String(videoUrl || '').trim();
  if (!u) return null;

  // Use a strict timeout so the snapshot response isn't blocked by TikTok oEmbed slowness.
  return await Promise.race([
    fetchTikTokOEmbed(u),
    new Promise<TikTokOEmbedResponse | null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
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

  // Keep this fast to avoid holding background refreshes for too long.
  // Retry once with a slightly higher timeout.
  const first = await attempt(4000);
  if (first) return first;
  return await attempt(6000);
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

async function refreshSnapshot(creator: CreatorProfile, cached?: CreatorSnapshot | null): Promise<CreatorSnapshot> {
  const sources: CreatorSnapshot['sources'] = {};
  sources.tiktokStatusApi = process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421';

  const live: CreatorSnapshot['live'] = { twitch: null, tiktok: null, youtube: null };
  const connections: CreatorSnapshot['connections'] = { twitchConnected: false, tiktokConnected: false };
  const links: CreatorSnapshot['links'] = {};
  const items: FeedItem[] = [];

  if (creator.twitchLogin) {
    const clean = String(creator.twitchLogin).trim().replace(/^@/, '');
    links.twitch = `https://www.twitch.tv/${clean}`;
    links.twitchLive = links.twitch;
    let liveFromOAuth: boolean | null = null;
    try {
      const conn = await dbGet<any>(`${TWITCH_CONNECTION_PREFIX}${creator.slug}`, true);
      const token = String(conn?.accessToken || '').trim();
      if (token) {
        connections.twitchConnected = true;
        sources.twitch = 'helix_oauth';
        const detailed = await fetchTwitchIsLiveWithOAuthDetailed(clean, token);
        if (detailed.unauthorized) {
          connections.twitchConnected = false;
          sources.twitch = 'public_fallback';
          await dbDelete(`${TWITCH_CONNECTION_PREFIX}${creator.slug}`);
        } else {
          liveFromOAuth = detailed.isLive;
        }
      }
    } catch {
      // ignore
    }

    live.twitch = liveFromOAuth !== null ? liveFromOAuth : await fetchTwitchIsLive(clean);
    if (!sources.twitch) sources.twitch = 'public_fallback';
  }

  if (creator.tiktokUsername) {
    const clean = String(creator.tiktokUsername).trim().replace(/^@/, '');
    links.tiktok = `https://www.tiktok.com/@${clean}`;
    links.tiktokLive = `https://www.tiktok.com/@${clean}/live`;

    // Default to offline when configured so the UI always has a stable boolean.
    live.tiktok = false;

    // Prefer official TikTok API when the creator connected via Login Kit.
    try {
      const conn = await dbGet<TikTokConnection>(`${TIKTOK_CONNECTION_PREFIX}${creator.slug}`, true);
      const token = String(conn?.accessToken || '').trim();
      if (token) connections.tiktokConnected = true;
      const latest = await fetchTikTokLatestVideoWithOAuthOrFallback(conn || {}, clean);
      if (latest && latest.unauthorized) {
        connections.tiktokConnected = false;
        await dbDelete(`${TIKTOK_CONNECTION_PREFIX}${creator.slug}`);
      } else if (latest?.url) {
        sources.tiktok = 'official_oauth';
        let title = latest.title || 'Latest TikTok';
        let thumbnailUrl = latest.thumbnailUrl;
        if (!thumbnailUrl || !title) {
          const preview = await fetchTikTokPreviewFast(latest.url);
          if (!title) title = (preview?.title && String(preview.title).trim()) || 'Latest TikTok';
          if (!thumbnailUrl) thumbnailUrl = preview?.thumbnail_url;
        }
        items.push({
          id: safeId(`tiktok_latest_${latest.url}`),
          platform: 'tiktok',
          title,
          url: latest.url,
          thumbnailUrl,
        });
      }
    } catch {
      // ignore
    }

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

    // If official OAuth didn't provide a latest video, fall back to the status API latest_video.
    const hasTikTokItem = items.some((i) => i.platform === 'tiktok' && i.url);
    if (!hasTikTokItem) {
      const latestUrl = getTikTokLatestVideoUrl(status, clean);
      if (latestUrl) {
        if (!sources.tiktok) sources.tiktok = 'status_api_fallback';
        const oembed = await fetchTikTokPreviewFast(latestUrl);
        items.push({
          id: safeId(`tiktok_latest_${latestUrl}`),
          platform: 'tiktok',
          title: (oembed?.title && String(oembed.title).trim()) || 'Latest TikTok',
          url: latestUrl,
          thumbnailUrl: oembed?.thumbnail_url,
        });
      }
    }
  }

  if (creator.youtubeChannelId) {
    const clean = String(creator.youtubeChannelId).trim();
    if (clean) {
      links.youtube = `https://www.youtube.com/channel/${clean}`;

      const hasYouTubeApiKey = !!process.env.YOUTUBE_API_KEY;
      let liveId = '';
      if (hasYouTubeApiKey) {
        sources.youtube = 'data_api_v3';
        liveId = await fetchYouTubeLiveVideoIdWithApi(clean);
      }
      if (!liveId) {
        if (!sources.youtube) sources.youtube = 'rss_html_fallback';
        liveId = await fetchYouTubeLiveVideoIdFast(clean);
      }
      if (liveId) {
        live.youtube = true;
        links.youtubeLive = `https://www.youtube.com/watch?v=${liveId}`;
        items.push({
          id: safeId(`youtube_live_${liveId}`),
          platform: 'youtube',
          title: 'Live on YouTube',
          url: links.youtubeLive,
          thumbnailUrl: `https://i.ytimg.com/vi/${liveId}/hqdefault.jpg`,
        });
      } else {
        live.youtube = false;

        let latest: { videoId: string; title: string; publishedAt?: string; thumbnailUrl?: string } | null = null;
        if (hasYouTubeApiKey) {
          if (!sources.youtube) sources.youtube = 'data_api_v3';
          latest = await fetchYouTubeLatestVideoWithApi(clean);
        }
        if (!latest?.videoId) {
          if (!sources.youtube) sources.youtube = 'rss_html_fallback';
          latest = await fetchYouTubeLatestVideoFast(clean);
        }
        if (latest?.videoId) {
          const latestUrl = `https://www.youtube.com/watch?v=${latest.videoId}`;
          items.push({
            id: safeId(`youtube_latest_${latest.videoId}`),
            platform: 'youtube',
            title: latest.title || 'Latest YouTube',
            url: latestUrl,
            thumbnailUrl: latest.thumbnailUrl,
            publishedAt: latest.publishedAt,
          });
        }
      }
    }
  }

  // Preserve last-known TikTok/YouTube items when external fetches are flaky.
  if (cached && Array.isArray(cached.items)) {
    if (creator.tiktokUsername) {
      const hasTikTok = items.some((i) => i.platform === 'tiktok' && i.url);
      if (!hasTikTok) {
        const prev = cached.items.find((i) => i.platform === 'tiktok' && i.url);
        if (prev) items.push(prev);
      }
    }
    if (creator.youtubeChannelId) {
      const hasYT = items.some((i) => i.platform === 'youtube' && i.url);
      if (!hasYT) {
        const prev = cached.items.find((i) => i.platform === 'youtube' && i.url);
        if (prev) items.push(prev);
      }
    }
  }

  const now = new Date().toISOString();
  return {
    creator,
    live,
    connections,
    links,
    items,
    updatedAt: now,
    lastCheckedAt: now,
    sources,
  };
}

function buildMinimalSnapshot(creator: CreatorProfile): CreatorSnapshot {
  const live: CreatorSnapshot['live'] = { twitch: null, tiktok: null, youtube: null };
  const connections: CreatorSnapshot['connections'] = { twitchConnected: false, tiktokConnected: false };
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
    connections,
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

  // Fast call; if it fails we keep cached values.
  const status = await fetchTikTokStatusApiFast(creator.tiktokUsername);
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

  const latestUrl = getTikTokLatestVideoUrl(status, clean);
  if (latestUrl) {
    const existingIdx = next.items.findIndex((i) => i.platform === 'tiktok');
    const existingUrl = existingIdx >= 0 ? String(next.items[existingIdx]?.url || '') : '';
    if (existingUrl !== latestUrl) {
      const oembed = await fetchTikTokPreviewFast(latestUrl);
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

    const clean = String(creator.tiktokUsername).trim().replace(/^@/, '');
    const latestUrl = getTikTokLatestVideoUrl(status, clean);
    if (latestUrl) {
      const existingIdx = updated.items.findIndex((i) => i.platform === 'tiktok');
      const existingUrl = existingIdx >= 0 ? String(updated.items[existingIdx]?.url || '') : '';
      if (existingUrl !== latestUrl) {
        const oembed = await fetchTikTokPreviewFast(latestUrl);
        const item: FeedItem = {
          id: safeId(`tiktok_latest_${latestUrl}`),
          platform: 'tiktok',
          title: (oembed?.title && String(oembed.title).trim()) || 'Latest TikTok',
          url: latestUrl,
          thumbnailUrl: oembed?.thumbnail_url,
        };
        if (existingIdx >= 0) updated.items[existingIdx] = item;
        else updated.items.unshift(item);
      }
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
    void refreshSnapshot(creator, minimal)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
    return NextResponse.json(minimal);
  }

  // If the TikTok status API config changed (or was newly enabled), refresh immediately
  // so the page can pick up latest_video/live without waiting for TTL.
  const currentStatusApi = process.env.TIKTOK_STATUS_API_BASE_URL || 'http://faashuis.ddns.net:8421';
  const cachedStatusApi = cached?.sources?.tiktokStatusApi || '';
  if (cached && currentStatusApi && cachedStatusApi !== currentStatusApi) {
    void refreshSnapshot(creator, cached)
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
      void refreshSnapshot(creator, cached)
        .then((fresh) => dbSet(snapshotKey, fresh))
        .catch(() => {});
      return NextResponse.json(cached);
    }
  }

  // If we have an older cached snapshot missing new fields, refresh now.
  if (cached && (!cached.links || !Array.isArray(cached.items) || !(cached as any).connections)) {
    void refreshSnapshot(creator, cached)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
    return NextResponse.json(cached);
  }

  // If cached snapshot is missing lastCheckedAt, don't block the response.
  // Schedule a background refresh and return cached immediately.
  if (!cached?.lastCheckedAt) {
    void refreshSnapshot(creator, cached)
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
    void refreshSnapshot(creator, cached)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
    return NextResponse.json(cached);
  }

  // Stale-while-revalidate: return cached immediately, but refresh in the background when stale.
  if (age > STALE_REVALIDATE_MS) {
    void refreshSnapshot(creator, cached)
      .then((fresh) => dbSet(snapshotKey, fresh))
      .catch(() => {});
  }

  return NextResponse.json(cached);
}
