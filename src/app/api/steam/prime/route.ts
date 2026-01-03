import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

type PrimeCache = {
  isPrime: boolean;
  checkedAt: string;
  reason?: string;
};

const CACHE_MS = 1000 * 60 * 60 * 6; // 6 hours

function normalizeItemName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeText(input: unknown): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function primeEvidenceReasonFromItemName(name: string): string | null {
  const s = normalizeItemName(name);
  if (!s) return null;

  // Annual Service Medals are strong Prime evidence (earned via XP rank-ups).
  if (s.includes('service medal')) return 'service_medal';

  // Legacy/account badges/coins that are effectively Prime-gated in practice.
  // We keep these as strict full-phrase checks to avoid false positives.
  if (s.includes('loyalty badge')) return 'loyalty_badge';
  if (s.includes('global offensive badge')) return 'global_offensive_badge';

  // Veteran coins are account/steam-age bound and not tradable. Not strictly Prime-only,
  // but they correlate strongly with established accounts and help catch missing Prime flags.
  if (s.includes('5-year veteran coin') || s.includes('10-year veteran coin')) return 'veteran_coin';

  // CS:GO 10-year coin (commemorative). Treated as Prime evidence.
  if (s.includes('10-year birthday coin') || s.includes('10 year birthday coin')) return '10_year_coin';

  // Major/tournament/operation coins and similar XP progression items.
  // Example: "Budapest 2025 Silver Coin"
  if (/\b\d{4}\b/.test(s) && s.includes(' coin')) return 'xp_coin';
  if (s.includes('silver coin') || s.includes('gold coin') || s.includes('bronze coin') || s.includes('diamond coin')) return 'xp_coin';

  return null;
}

function primeEvidenceReasonFromDescriptionText(text: string): string | null {
  const s = normalizeText(text);
  if (!s) return null;

  // Any explicit XP grant/progression strongly indicates the account has CS progression,
  // which correlates with Prime in practice.
  if (s.includes('xp') || s.includes('experience points') || s.includes('profile rank')) return 'xp_item';
  if (s.includes('rank up') || s.includes('rank-up')) return 'xp_item';
  if (s.includes('watching') && s.includes('coin')) return 'xp_coin';
  return null;
}

function getAllDescriptionText(d: any): string {
  const parts: string[] = [];
  const name = d?.market_hash_name || d?.market_name || d?.name;
  if (name) parts.push(String(name));
  const descriptions = Array.isArray(d?.descriptions) ? d.descriptions : [];
  for (const it of descriptions) {
    if (it?.value) parts.push(String(it.value));
  }
  return parts.join(' | ');
}

async function fetchCommunityDescriptions(steamId: string): Promise<any[] | null> {
  const id = String(steamId || '').trim();
  if (!id) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const invUrl = `https://steamcommunity.com/inventory/${encodeURIComponent(id)}/730/2?l=english&count=2000`;
    const res = await fetch(invUrl, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json,text/plain,*/*',
        Referer: 'https://steamcommunity.com/',
      },
    });

    const text = await res.text();
    if (!res.ok) return null;
    if (!text) return null;
    if (/<html|<!doctype/i.test(text)) return null;

    const json = JSON.parse(text);
    const descriptions: any[] = Array.isArray(json?.descriptions) ? json.descriptions : [];
    return descriptions;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');
    const refresh = url.searchParams.get('refresh') === '1';

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const cacheKey = `prime_status_${steamId}`;
    const cached = await dbGet<PrimeCache>(cacheKey, true);
    if (!refresh && cached?.checkedAt) {
      const age = Date.now() - new Date(cached.checkedAt).getTime();
      if (Number.isFinite(age) && age >= 0 && age < CACHE_MS) {
        return NextResponse.json(cached);
      }
    }

    // Use our own inventory API (server-side) to avoid CORS.
    // Prime detection should be lightweight and resilient.
    let descriptions: any[] = (await fetchCommunityDescriptions(steamId)) || [];
    if (!descriptions.length) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        const invRes = await fetch(
          `${url.origin}/api/steam/inventory?steamId=${encodeURIComponent(steamId)}&isPro=false`,
          { signal: controller.signal, cache: 'no-store' }
        );
        if (invRes.ok) {
          const inv = await invRes.json();
          descriptions = Array.isArray(inv?.descriptions) ? inv.descriptions : [];
        }
      } catch {
        // ignore
      } finally {
        clearTimeout(timeoutId);
      }
    }

    let isPrime = false;
    let reason: string | undefined;

    for (const d of descriptions) {
      const name = String(d?.market_hash_name || d?.market_name || d?.name || '');
      const r = primeEvidenceReasonFromItemName(name) || primeEvidenceReasonFromDescriptionText(getAllDescriptionText(d));
      if (r) {
        isPrime = true;
        reason = r;
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
