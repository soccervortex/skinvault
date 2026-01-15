import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

export const runtime = 'nodejs';

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSteamProfileViaWebApi(steamId: string): Promise<{ name: string; avatar: string } | null> {
  try {
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) return null;
    if (!/^\d{17}$/.test(String(steamId || '').trim())) return null;

    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return null;

    const data: any = await res.json().catch(() => null);
    const player = data?.response?.players?.[0];
    const name = String(player?.personaname || '').trim();
    const avatar = String(player?.avatarfull || '').trim();
    if (!name) return null;
    return { name, avatar };
  } catch {
    return null;
  }
}

function parseSteamProfileXml(xml: string): { name: string; avatar: string } | null {
  try {
    const text = String(xml || '');
    if (!text) return null;

    const nameMatch = text.match(/<steamID>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/steamID>/);
    const avatarMatch = text.match(/<avatarFull>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/avatarFull>/);

    const name = String(nameMatch?.[1] || '').trim();
    const avatar = String(avatarMatch?.[1] || '').trim();
    if (!name) return null;
    return { name, avatar };
  } catch {
    return null;
  }
}

// Server-side Steam profile fetcher (no proxies needed - server can fetch directly)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId') || searchParams.get('id');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId parameter' }, { status: 400 });
    }

    const safeSteamId = String(steamId).trim();

    const blockedSteamId = String(process.env.SV_WEBSITE_PRIVATE_STEAM_ID || '76561198750974604').trim();
    if (blockedSteamId && safeSteamId === blockedSteamId) {
      const viewerSteamId = getSteamIdFromRequest(request);
      if (String(viewerSteamId || '') !== blockedSteamId) {
        return NextResponse.json({ error: 'Profile is private' }, { status: 403 });
      }
    }

    const avatarFallback = `${new URL(request.url).origin}/icons/web-app-manifest-192x192.png`;

    // Prefer Steam Web API when available (more reliable than scraping XML)
    const viaWebApi = await fetchSteamProfileViaWebApi(safeSteamId);
    if (viaWebApi) {
      return NextResponse.json({
        steamId: safeSteamId,
        name: viaWebApi.name,
        avatar: viaWebApi.avatar || avatarFallback,
      });
    }

    // Fallback: Steam Community XML
    const steamUrl = `https://steamcommunity.com/profiles/${safeSteamId}/?xml=1`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      
      const textRes = await fetch(steamUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        next: { revalidate: 86400 },
      });
      
      clearTimeout(timeoutId);
      
      if (textRes.ok) {
        const text = await textRes.text();
        const parsed = parseSteamProfileXml(text);
        if (parsed) {
          return NextResponse.json({
            steamId: safeSteamId,
            name: parsed.name,
            avatar: parsed.avatar || avatarFallback,
          });
        }
      }

      // Last resort: return 200 so metadata generation doesn't fall back to null.
      return NextResponse.json({
        steamId: safeSteamId,
        name: 'Unknown User',
        avatar: avatarFallback,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return NextResponse.json({
          steamId: safeSteamId,
          name: 'Unknown User',
          avatar: avatarFallback,
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Steam profile fetch failed:', error);
    // Return 200 fallback to keep SEO metadata stable.
    const origin = (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return 'https://www.skinvaults.online';
      }
    })();
    return NextResponse.json({
      steamId: '',
      name: 'Unknown User',
      avatar: `${origin}/icons/web-app-manifest-192x192.png`,
    });
  }
}

