import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { API_FILES, BASE_URL, isItemExcluded } from '@/data/api-endpoints';

function parsePriceNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (!s) return null;
  const cleaned = s.replace(/[^0-9,\.\-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
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

async function getAllMarketHashNames(db: any, force: boolean = false): Promise<string[]> {
  const cacheCol = db.collection('market_price_names');
  const cacheKey = 'all_market_hash_names_v1';
  
  if (!force) {
    try {
      const cached = await cacheCol.findOne({ _id: cacheKey } as any);
      if (cached && Array.isArray(cached.names) && cached.names.length > 0) {
        const updatedAt = new Date(String(cached.updatedAt));
        if (Date.now() - updatedAt.getTime() < 1000 * 60 * 60 * 24) {
          return cached.names;
        }
      }
    } catch (e) { /* ignore */ }
  }

  const names: string[] = [];
  const results = await Promise.all(
    API_FILES.map(async (file) => {
      try {
        const res = await fetch(`${BASE_URL}/${file}`, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        return items.map((item: any) => {
          if (isItemExcluded(item?.id)) return null;
          return String(item?.market_hash_name || item?.name || '').trim();
        }).filter(Boolean) as string[];
      } catch { return []; }
    })
  );

  for (const arr of results) names.push(...arr);
  const unique = Array.from(new Set(names));
  
  if (unique.length > 0) {
    await cacheCol.updateOne(
        { _id: cacheKey } as any, 
        { $set: { names: unique, updatedAt: new Date().toISOString() } }, 
        { upsert: true }
    );
  }
  return unique;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const currency = String(searchParams.get('currency') || '3');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const force = searchParams.get('force') === 'true';

    const db = await getDatabase();
    const allNames = await getAllMarketHashNames(db, force);

    if (allNames.length === 0) {
        return NextResponse.json({ success: false, error: "Source APIs returned 0 items", names: [] });
    }

    const cursorKey = `market_prices_cursor_${currency}`;
    const cursorCol = db.collection('market_price_cursors');
    const cursorDoc = await cursorCol.findOne({ _id: cursorKey } as any);
    const start = Number(cursorDoc?.value || 0);

    const slice = allNames.slice(start, start + limit);
    const nextStart = (start + slice.length) >= allNames.length ? 0 : (start + slice.length);

    await cursorCol.updateOne(
        { _id: cursorKey } as any, 
        { $set: { value: nextStart, updatedAt: new Date().toISOString() } }, 
        { upsert: true }
    );

    return NextResponse.json({ success: true, names: slice, nextStart, total: allNames.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { prices, currency } = await req.json();
    const db = await getDatabase();
    
    // 1. Update current prices
    const col = db.collection<PriceDoc>('market_prices');
    const ops = prices.map((p: any) => ({
      updateOne: {
        filter: { currency: String(currency), market_hash_name: p.name },
        update: { $set: { price: p.price, updatedAt: new Date().toISOString(), source: 'external_worker' } },
        upsert: true
      }
    }));
    await col.bulkWrite(ops, { ordered: false });

    // 2. Save to History
    const historyCol = db.collection('market_price_history');
    const historyOps = prices.map((p: any) => ({
        insertOne: { document: { market_hash_name: p.name, currency: String(currency), price: p.price, timestamp: new Date() } }
    }));
    await historyCol.bulkWrite(historyOps, { ordered: false });

    return NextResponse.json({ success: true, count: ops.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}