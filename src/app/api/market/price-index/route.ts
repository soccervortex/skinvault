import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const currency = String(url.searchParams.get('currency') || '3').trim();

    const db = await getDatabase();
    const col = db.collection('market_prices');

    const docs = await col
      .find({ currency }, { projection: { _id: 0, market_hash_name: 1, price: 1, updatedAt: 1 } })
      .toArray();

    const prices: Record<string, number> = {};
    let updatedAtMax = '';

    for (const d of docs) {
      const k = String((d as any)?.market_hash_name || '').trim();
      const p = Number((d as any)?.price);
      const u = String((d as any)?.updatedAt || '').trim();
      if (k && Number.isFinite(p)) prices[k] = p;
      if (u && (!updatedAtMax || u > updatedAtMax)) updatedAtMax = u;
    }

    const res = NextResponse.json({ currency, updatedAt: updatedAtMax || null, prices }, { status: 200 });
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load price index' }, { status: 500 });
  }
}
