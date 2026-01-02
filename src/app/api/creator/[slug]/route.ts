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

type CreatorResponse = {
  creator: CreatorProfile;
  live: {
    twitch: boolean | null;
    tiktok: boolean | null;
    youtube: boolean | null;
  };
  items: FeedItem[];
  updatedAt: string;
  sources: {
    tiktok?: string;
    youtube?: string;
  };
};

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1');
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pickFirstTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return null;
  return decodeXmlEntities(stripCdata(m[1].trim()));
}

function pickAttr(block: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*>`, 'i');
  const m = block.match(re);
  return m ? decodeXmlEntities(m[1]) : null;
}

function pickEnclosureUrl(block: string): string | null {
  const m = block.match(/<enclosure[^>]*\surl="([^"]+)"[^>]*>/i);
  return m ? decodeXmlEntities(m[1]) : null;
}

function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
}

function parseRssItems(xml: string): Array<{ title: string; link: string; pubDate?: string; thumbnailUrl?: string }> {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return items
    .map((it) => {
      const title = pickFirstTag(it, 'title') || '';
      const link = pickFirstTag(it, 'link') || '';
      const pubDate = pickFirstTag(it, 'pubDate') || undefined;
      const thumbnailUrl = pickAttr(it, 'media:thumbnail', 'url') || pickEnclosureUrl(it) || undefined;
      return { title, link, pubDate, thumbnailUrl };
    })
    .filter((x) => x.title && x.link);
}

function parseYoutubeAtom(xml: string): Array<{ title: string; link: string; published?: string; thumbnailUrl?: string; videoId?: string }> {
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return entries
    .map((e) => {
      const title = pickFirstTag(e, 'title') || '';
      const videoId = pickFirstTag(e, 'yt:videoId') || undefined;
      const linkHref = (e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*\/>/i) || [])[1];
      const link = linkHref ? decodeXmlEntities(linkHref) : (pickFirstTag(e, 'link') || '');
      const published = pickFirstTag(e, 'published') || undefined;
      const thumb = pickAttr(e, 'media:thumbnail', 'url') || undefined;
      return { title, link, published, thumbnailUrl: thumb, videoId };
    })
    .filter((x) => x.title && x.link);
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xml,text/xml,*/*',
      },
    });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(id);
  }
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const storedCreators = await dbGet<CreatorProfile[]>('creators_v1', true);
  const creatorList = Array.isArray(storedCreators) && storedCreators.length > 0 ? storedCreators : CREATORS;
  const creator = creatorList.find((c) => c.slug.toLowerCase() === String(slug).toLowerCase()) || null;
  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  // Cache key includes handles so config updates take effect immediately.
  const cacheKey = `creator_feed_${creator.slug}_${creator.tiktokUsername || 'na'}_${creator.youtubeChannelId || 'na'}_${creator.twitchLogin || 'na'}`;
  const cached = await dbGet<{ updatedAt: string; data: CreatorResponse }>(cacheKey, true);
  const ttlMs = 1000 * 60 * 1;
  if (cached?.updatedAt) {
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (Number.isFinite(age) && age >= 0 && age < ttlMs) {
      return NextResponse.json(cached.data);
    }
  }

  const sources: CreatorResponse['sources'] = {};
  const items: FeedItem[] = [];

  const jobs: Array<Promise<void>> = [];

  if (creator.tiktokUsername) {
    const rsshubBase = process.env.RSSHUB_BASE_URL || 'https://rsshub.app';
    const url = `${rsshubBase.replace(/\/$/, '')}/tiktok/user/${encodeURIComponent(creator.tiktokUsername)}`;
    sources.tiktok = url;
    jobs.push(
      (async () => {
        try {
          const xml = await fetchText(url, 8000);
          const rssItems = parseRssItems(xml).slice(0, 12);
          rssItems.forEach((it) => {
            items.push({
              id: safeId(`tiktok_${it.link}`),
              platform: 'tiktok',
              title: it.title,
              url: it.link,
              publishedAt: it.pubDate,
              thumbnailUrl: it.thumbnailUrl,
            });
          });
        } catch {
          // ignore
        }
      })()
    );
  }

  if (creator.youtubeChannelId) {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(creator.youtubeChannelId)}`;
    sources.youtube = url;
    jobs.push(
      (async () => {
        try {
          const xml = await fetchText(url, 8000);
          const ytItems = parseYoutubeAtom(xml).slice(0, 12);
          ytItems.forEach((it) => {
            items.push({
              id: safeId(`youtube_${it.videoId || it.link}`),
              platform: 'youtube',
              title: it.title,
              url: it.link,
              publishedAt: it.published,
              thumbnailUrl: it.thumbnailUrl,
            });
          });
        } catch {
          // ignore
        }
      })()
    );
  }

  await Promise.allSettled(jobs);

  items.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  const data: CreatorResponse = {
    creator,
    live: { twitch: null, tiktok: null, youtube: null },
    items: items.slice(0, 12),
    updatedAt: new Date().toISOString(),
    sources,
  };

  await dbSet(cacheKey, { updatedAt: data.updatedAt, data });
  return NextResponse.json(data);
}
