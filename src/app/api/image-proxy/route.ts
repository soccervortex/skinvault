import { NextRequest } from 'next/server';

const MAX_BYTES = 2_000_000;

const FALLBACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#0f111a"/></svg>';

function fallbackResponse() {
  return new Response(FALLBACK_SVG, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=600',
    },
  });
}

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
      host.startsWith('p16-') ||
      host === 'steamcommunity.com' ||
      host.endsWith('.steamstatic.com') ||
      host.endsWith('.steamstaticusercontent.com') ||
      host.endsWith('.akamai.steamstatic.com') ||
      host.endsWith('.cloudflare.steamstatic.com');

    if (!allowed) return null;

    // Only allow fetching images (avoid proxying random content)
    const path = u.pathname.toLowerCase();
    const isSteamEconomyImage =
      (host.endsWith('.steamstatic.com') || host.endsWith('.akamai.steamstatic.com') || host.endsWith('.cloudflare.steamstatic.com')) &&
      path.includes('/economy/image/');
    if (!/\.(png|jpe?g|webp|gif|bmp|svg)$/.test(path) && !path.includes('tos-') && !isSteamEconomyImage) {
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
    console.error('Image proxy: URL not allowed:', target);
    return new Response('Forbidden', { status: 403 });
  }

  // Use a shorter timeout to avoid Vercel function timeout (10s max)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds

  try {
    const upstream = await fetch(allowed.toString(), {
      cache: 'no-store',
      redirect: 'follow', // Let fetch handle redirects for now
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.tiktok.com/',
      },
    });

    clearTimeout(timeoutId);

    if (!upstream.ok) {
      console.error('Image proxy: Upstream failed', { status: upstream.status, url: allowed.toString() });
      return fallbackResponse();
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      console.error('Image proxy: Invalid content type:', contentType);
      return fallbackResponse();
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
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Log the error for debugging but always return fallback
    console.error('Image proxy error:', error?.message || error);
    return fallbackResponse();
  }
}
