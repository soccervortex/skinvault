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

type PriceDoc = {
  currency: string;
  market_hash_name: string;
  price: number;
  updatedAt: string;
  source: string;
};

async function getAllMarketHashNames(db: any): Promise<string[]> {
  // Cache names in Mongo to avoid refetching all datasets every invocation.
  const cacheCol = db.collection('market_price_names');
  const cacheKey = 'all_market_hash_names_v1';
  try {
    const cached = await cacheCol.findOne({ _id: cacheKey } as any);
    const updatedAt = cached?.updatedAt ? new Date(String(cached.updatedAt)) : null;
    const names = Array.isArray(cached?.names) ? cached.names : null;
    const fresh = updatedAt && Date.now() - updatedAt.getTime() < 1000 * 60 * 60 * 24;
    if (names && fresh) return Array.from(new Set(names.map((n: any) => String(n || '').trim()).filter(Boolean)));
  } catch {
    // ignore
  }

  const names: string[] = [];

  const results = await Promise.all(
    API_FILES.map(async (file) => {
      try {
        const res = await fetch(`${BASE_URL}/${file}`, { cache: 'force-cache' });
        if (!res.ok) return [];
        const data = await res.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        const out: string[] = [];
        for (const item of items) {
          const id = (item as any)?.id;
          if (isItemExcluded(id)) continue;
          const name = String((item as any)?.market_hash_name || (item as any)?.name || '').trim();
          if (name) out.push(name);
        }
        return out;
      } catch {
        return [];
      }
    })
  );

  for (const arr of results) names.push(...arr);

  const unique = Array.from(new Set(names));
  try {
    await cacheCol.updateOne(
      { _id: cacheKey } as any,
      { $set: { _id: cacheKey, names: unique, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
  } catch {
    // ignore
  }

  return unique;
}

async function fetchSteamPrice(origin: string, currency: string, marketHashName: string): Promise<number | null> {
  try {
    // Use internal endpoint (can fall back to proxies) to be resilient.
    const built = `${String(origin).replace(/\/$/, '')}/api/steam/price?market_hash_name=${encodeURIComponent(marketHashName)}&currency=${encodeURIComponent(currency)}`;
    const res = await fetch(built, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({} as any));
    const p = parsePriceNumber(json?.lowest_price ?? json?.median_price);
    return p;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const origin = url.origin;
    const currency = String(url.searchParams.get('currency') || '3').trim();
    const limit = Math.min(Math.max(parseInt(String(url.searchParams.get('limit') || '80'), 10) || 80, 1), 500);
    const startParamRaw = url.searchParams.get('start');
    const startParam = startParamRaw !== null ? (parseInt(String(startParamRaw), 10) || 0) : null;
    const db = await getDatabase();

    const allNames = await getAllMarketHashNames(db);
    const cursorKey = `market_prices_cursor_${currency}`;
    const cursorCol = db.collection('market_price_cursors');
    const cursorDoc = await cursorCol.findOne({ _id: cursorKey } as any);
    const cursorStart = Number(cursorDoc?.value || 0);

    const startValue = startParam !== null ? startParam : cursorStart;
    const start = Math.min(Math.max(startValue, 0), allNames.length);
    const slice = allNames.slice(start, start + limit);
    const col = db.collection<PriceDoc>('market_prices');

    const now = new Date().toISOString();

    let ok = 0;
    let failed = 0;

    const startedAt = Date.now();
    const timeBudgetMs = 7000;

    const concurrency = 4;
    let processed = 0;
    for (let i = 0; i < slice.length; i += concurrency) {
      if (Date.now() - startedAt > timeBudgetMs) break;

      const batch = slice.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (name) => {
          const price = await fetchSteamPrice(origin, currency, name);
          return { name, price };
        })
      );

      const ops: any[] = [];
      for (const r of results) {
        processed++;
        if (r.price === null) {
          failed++;
          continue;
        }
        ops.push({
          updateOne: {
            filter: { currency, market_hash_name: r.name },
            update: {
              $set: {
                currency,
                market_hash_name: r.name,
                price: r.price,
                updatedAt: now,
                source: 'steam_priceoverview',
              },
            },
            upsert: true,
          },
        });
        ok++;
      }

      if (ops.length) {
        await col.bulkWrite(ops, { ordered: false });
      }
    }

    const nextStart = start + processed;

    // Persist cursor for next run
    await cursorCol.updateOne(
      { _id: cursorKey } as any,
      { $set: { _id: cursorKey, value: nextStart >= allNames.length ? 0 : nextStart, updatedAt: now } },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      currency,
      total: allNames.length,
      start,
      processed,
      ok,
      failed,
      nextStart: nextStart >= allNames.length ? 0 : nextStart,
      finished: nextStart >= allNames.length,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
