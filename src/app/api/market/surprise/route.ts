import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { API_FILES, BASE_URL, isItemExcluded } from '@/data/api-endpoints';

function parsePriceNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (!s) return null;
  const cleaned = s
    .replace(/[^0-9,\.\-]/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

type PoolItem = {
  id: string;
  name: string;
  marketHashName: string;
  wearName?: string;
  weaponName?: string;
};

type CacheDoc = {
  _id: string;
  createdAt: string;
  expiresAt: Date;
  payload: any;
};

type PoolCacheDoc = {
  _id: string;
  updatedAt: string;
  items: PoolItem[];
};

function normalizeMinMax(searchParams: URLSearchParams) {
  const minRaw = searchParams.get('min');
  const maxRaw = searchParams.get('max');
  const min = minRaw !== null && String(minRaw).trim() !== '' ? Number(minRaw) : undefined;
  const max = maxRaw !== null && String(maxRaw).trim() !== '' ? Number(maxRaw) : undefined;
  return {
    min: Number.isFinite(min as any) ? (min as number) : undefined,
    max: Number.isFinite(max as any) ? (max as number) : undefined,
  };
}

function buildMarketHashName(item: PoolItem): string {
  const raw = String(item.marketHashName || item.name || '').trim();
  const wear = String(item.wearName || '').trim();
  if (raw && wear && !raw.includes(`(${wear})`)) return `${raw} (${wear})`;
  return raw;
}

async function loadItemPool(db: any): Promise<PoolItem[]> {
  const col = db.collection('market_items_cache');
  const cacheKey = 'byMyKel_pool_v1';

  try {
    const cached = (await col.findOne({ _id: cacheKey } as any)) as PoolCacheDoc | null;
    const updatedAt = cached?.updatedAt ? new Date(String(cached.updatedAt)) : null;
    const fresh = updatedAt && Date.now() - updatedAt.getTime() < 1000 * 60 * 60 * 24;
    if (fresh && Array.isArray(cached?.items) && cached.items.length) {
      return cached.items;
    }
  } catch {
    // ignore
  }

  const results = await Promise.all(
    API_FILES.map(async (file) => {
      try {
        const res = await fetch(`${BASE_URL}/${file}`, { cache: 'force-cache' });
        if (!res.ok) return [];
        const data = await res.json();
        const items = Array.isArray(data) ? data : Object.values(data);

        const out: PoolItem[] = [];
        for (const it of items as any[]) {
          const id = String(it?.id || '').trim();
          if (!id || isItemExcluded(id)) continue;

          const name = String(it?.name || '').trim();
          if (!name) continue;

          const marketHashName = String(it?.market_hash_name || it?.marketHashName || it?.market_name || it?.marketName || name).trim();

          out.push({
            id,
            name,
            marketHashName,
            wearName: String(it?.wear?.name || '').trim() || undefined,
            weaponName: String(it?.weapon?.name || '').trim() || undefined,
          });
        }
        return out;
      } catch {
        return [];
      }
    })
  );

  const merged = results.flat();
  const unique: PoolItem[] = [];
  const seen = new Set<string>();
  for (const it of merged) {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      unique.push(it);
    }
  }

  try {
    await col.updateOne(
      { _id: cacheKey } as any,
      { $set: { _id: cacheKey, updatedAt: new Date().toISOString(), items: unique } },
      { upsert: true }
    );
  } catch {
    // ignore
  }

  return unique;
}

async function logBadPrize(db: any, name: string) {
  try {
    const col = db.collection('surprise_bad_items');
    await col.updateOne(
      { _id: name } as any,
      { $set: { _id: name, name, updatedAt: new Date().toISOString() }, $inc: { count: 1 } },
      { upsert: true }
    );
  } catch {
    // ignore
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const currency = String(url.searchParams.get('currency') || '3').trim();
    const q = String(url.searchParams.get('q') || '').trim();
    const wear = String(url.searchParams.get('wear') || '').trim();
    const { min, max } = normalizeMinMax(url.searchParams);

    const now = Date.now();
    const msIntoMinute = now % 60_000;
    const isMinuteBoundary = msIntoMinute < 1000;
    const ttlMs = 60_000 - msIntoMinute;

    const db = await getDatabase();
    const cacheCol = db.collection('surprise_cache');

    const cacheKey = `surprise_${currency}_${q}_${wear}_${min ?? ''}_${max ?? ''}`;

    if (isMinuteBoundary) {
      try {
        await cacheCol.deleteOne({ _id: cacheKey } as any);
      } catch {
        // ignore
      }
    } else {
      try {
        const cached = (await cacheCol.findOne({ _id: cacheKey } as any)) as CacheDoc | null;
        if (cached?.payload && cached.expiresAt && cached.expiresAt.getTime() > Date.now()) {
          const res = NextResponse.json({ ...(cached.payload as any), cached: true }, { status: 200 });
          res.headers.set('x-sv-cache', 'hit');
          return res;
        }
      } catch {
        // ignore
      }
    }

    const pool = await loadItemPool(db);

    const matchesQuery = (item: PoolItem) => {
      if (!q) return true;
      const lower = q.toLowerCase();
      return String(item.name || '').toLowerCase().includes(lower) || String(item.weaponName || '').toLowerCase().includes(lower);
    };

    const matchesWear = (item: PoolItem) => {
      if (!wear) return true;
      return String(item.wearName || '') === wear;
    };

    const filteredPool = pool.filter((it) => matchesQuery(it) && matchesWear(it));

    if (!filteredPool.length) {
      return NextResponse.json({ error: 'No items match filters' }, { status: 404 });
    }

    const maxAttempts = 60;
    let badDashTries = 0;

    for (let i = 0; i < maxAttempts; i++) {
      const candidate = filteredPool[Math.floor(Math.random() * filteredPool.length)];
      const marketHash = buildMarketHashName(candidate);

      if (!marketHash) continue;

      if (marketHash.includes('---')) {
        badDashTries++;
        await logBadPrize(db, marketHash);
        if (badDashTries < 3) continue;
        // after 3, keep skipping but allow other attempts
        continue;
      }

      const priceRes = await fetch(
        `${url.origin}/api/steam/price?market_hash_name=${encodeURIComponent(marketHash)}&currency=${encodeURIComponent(currency)}`,
        { cache: 'no-store' }
      );

      if (!priceRes.ok) continue;
      const priceJson = await priceRes.json().catch(() => ({} as any));
      const priceNum = parsePriceNumber(priceJson?.lowest_price ?? priceJson?.median_price);
      if (priceNum === null) continue;

      if (min !== undefined && priceNum < min) continue;
      if (max !== undefined && priceNum > max) continue;

      const payload = {
        itemId: candidate.id,
        marketHashName: marketHash,
        price: priceNum,
        currency,
        cached: false,
      };

      try {
        await cacheCol.updateOne(
          { _id: cacheKey } as any,
          {
            $set: {
              _id: cacheKey,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + ttlMs),
              payload,
            },
          },
          { upsert: true }
        );
      } catch {
        // ignore
      }

      const res = NextResponse.json(payload, { status: 200 });
      res.headers.set('x-sv-cache', 'miss');
      return res;
    }

    return NextResponse.json({ error: 'No prize found in range' }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
