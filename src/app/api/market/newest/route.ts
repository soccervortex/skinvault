import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';

export const runtime = 'nodejs';

type MarketPriceDoc = {
  currency: string;
  market_hash_name: string;
  price: number;
  updatedAt?: string;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const currency = String(url.searchParams.get('currency') || '3').trim();

    const pageRaw = url.searchParams.get('page');
    const limitRaw = url.searchParams.get('limit');

    const page = Math.max(0, parseInt(String(pageRaw || '0'), 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(String(limitRaw || '6'), 10) || 6));
    const skip = page * limit;

    const db = await getDatabase();
    const col = db.collection<MarketPriceDoc>('market_prices');

    const docs = await col
      .find(
        { currency, updatedAt: { $exists: true, $ne: '' } } as any,
        { projection: { _id: 0, market_hash_name: 1, price: 1, updatedAt: 1 } } as any
      )
      .sort({ updatedAt: -1 } as any)
      .skip(skip)
      .limit(limit)
      .toArray();

    const items = (docs || []).map((d: any) => ({
      marketHashName: String(d?.market_hash_name || '').trim(),
      price: Number(d?.price),
      updatedAt: d?.updatedAt ? String(d.updatedAt) : null,
    }));

    const res = NextResponse.json({ currency, page, limit, items }, { status: 200 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load newest items' }, { status: 500 });
  }
}
