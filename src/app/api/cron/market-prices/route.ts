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

async function getAllMarketHashNames(): Promise<string[]> {
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

  return Array.from(new Set(names));
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
    const limit = Math.min(Math.max(parseInt(String(url.searchParams.get('limit') || '200'), 10) || 200, 1), 1000);
    const startParamRaw = url.searchParams.get('start');
    const startParam = startParamRaw !== null ? (parseInt(String(startParamRaw), 10) || 0) : null;

    const allNames = await getAllMarketHashNames();

    const db = await getDatabase();
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

    const concurrency = 6;
    for (let i = 0; i < slice.length; i += concurrency) {
      const batch = slice.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (name) => {
          const price = await fetchSteamPrice(origin, currency, name);
          if (price === null) return { name, price: null };
          return { name, price };
        })
      );

      for (const r of results) {
        if (r.price === null) {
          failed++;
          continue;
        }
        await col.updateOne(
          { currency, market_hash_name: r.name },
          {
            $set: {
              currency,
              market_hash_name: r.name,
              price: r.price,
              updatedAt: now,
              source: 'steam_priceoverview',
            },
          },
          { upsert: true }
        );
        ok++;
      }
    }

    const nextStart = start + slice.length;

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
      processed: slice.length,
      ok,
      failed,
      nextStart: nextStart >= allNames.length ? 0 : nextStart,
      finished: nextStart >= allNames.length,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
