import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';

type Body = {
  currency?: string;
  hashes?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const currency = String(body?.currency || '3').trim();
    const hashesRaw = Array.isArray(body?.hashes) ? body.hashes : [];
    const hashes = hashesRaw
      .map((h) => String(h || '').trim())
      .filter(Boolean)
      .slice(0, 500);

    if (!hashes.length) {
      return NextResponse.json({ currency, prices: {} }, { status: 200 });
    }

    const db = await getDatabase();
    const col = db.collection('market_prices');

    const docs = await col
      .find({ currency, market_hash_name: { $in: hashes } }, { projection: { _id: 0, market_hash_name: 1, price: 1 } })
      .toArray();

    const prices: Record<string, number> = {};
    for (const d of docs) {
      const k = String((d as any)?.market_hash_name || '').trim();
      const p = Number((d as any)?.price);
      if (k && Number.isFinite(p)) prices[k] = p;
    }

    return NextResponse.json({ currency, prices }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load prices' }, { status: 500 });
  }
}
