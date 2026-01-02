import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

type PrimeCache = {
  isPrime: boolean;
  checkedAt: string;
  reason?: string;
};

const CACHE_MS = 1000 * 60 * 60 * 6; // 6 hours

function looksLikeServiceMedal(name: string): boolean {
  const s = String(name || '').toLowerCase();
  if (!s) return false;
  // "Service Medal" is strong evidence of Prime (earned via XP rank-ups).
  if (s.includes('service medal')) return true;
  return false;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const cacheKey = `prime_status_${steamId}`;
    const cached = await dbGet<PrimeCache>(cacheKey, true);
    if (cached?.checkedAt) {
      const age = Date.now() - new Date(cached.checkedAt).getTime();
      if (Number.isFinite(age) && age >= 0 && age < CACHE_MS) {
        return NextResponse.json(cached);
      }
    }

    // Use our own inventory API (server-side) to avoid CORS.
    // Prime detection should be lightweight and resilient.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let inv: any = null;
    try {
      const invRes = await fetch(
        `${url.origin}/api/steam/inventory?steamId=${encodeURIComponent(steamId)}&isPro=false`,
        { signal: controller.signal, cache: 'no-store' }
      );
      if (invRes.ok) {
        inv = await invRes.json();
      }
    } catch {
      // ignore
    } finally {
      clearTimeout(timeoutId);
    }

    const descriptions: any[] = Array.isArray(inv?.descriptions) ? inv.descriptions : [];

    let isPrime = false;
    let reason: string | undefined;

    for (const d of descriptions) {
      const name = String(d?.market_hash_name || d?.market_name || d?.name || '');
      if (looksLikeServiceMedal(name)) {
        isPrime = true;
        reason = 'service_medal';
        break;
      }
    }

    const result: PrimeCache = {
      isPrime,
      checkedAt: new Date().toISOString(),
      reason,
    };

    void dbSet(cacheKey, result).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    console.error('Prime status error:', error);
    return NextResponse.json({ error: 'Failed to detect Prime status' }, { status: 500 });
  }
}
