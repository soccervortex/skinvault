import { NextRequest } from 'next/server';

const MAX_BYTES = 2_000_000;

function isAllowedUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;

    const host = u.hostname.toLowerCase();
    const allowed =
      host.endsWith('.tiktokcdn.com') ||
      host.endsWith('.tiktokcdn-eu.com') ||
      host === 'p16-pu-sign-no.tiktokcdn-eu.com' ||
      host === 'p16-common-sign.tiktokcdn-eu.com' ||
      host.startsWith('p16-');

    if (!allowed) return null;

    // Only allow fetching images (avoid proxying random content)
    const path = u.pathname.toLowerCase();
    if (!/\.(png|jpe?g|webp|gif|bmp|svg)$/.test(path) && !path.includes('tos-')) {
      // TikTok avatar URLs often don't end with image extension; allow tos-* paths.
      return null;
    }

    return u;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = String(url.searchParams.get('url') || '').trim();
  if (!target) {
    return new Response('Missing url', { status: 400 });
  }

  const allowed = isAllowedUrl(target);
  if (!allowed) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10_000);

    let upstream: Response;
    try {
      upstream = await fetch(allowed.toString(), {
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });
    } finally {
      clearTimeout(id);
    }

    if (!upstream.ok) {
      return new Response('Upstream error', { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new Response('Invalid content type', { status: 415 });
    }

    const len = Number(upstream.headers.get('content-length') || '0');
    if (Number.isFinite(len) && len > MAX_BYTES) {
      return new Response('Image too large', { status: 413 });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return new Response('Image too large', { status: 413 });
    }

    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': contentType,
        // Cache for a day at CDN level; avatars change rarely.
        'cache-control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return new Response('Fetch failed', { status: 502 });
  }
}
