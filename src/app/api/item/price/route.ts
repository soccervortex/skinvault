import { NextResponse } from 'next/server';
import { getItemPrice } from '@/app/lib/inngest-functions';

function parseEur(raw: string): number | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.,]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const marketHashName = String(url.searchParams.get('market_hash_name') || url.searchParams.get('marketHashName') || '').trim();
    if (!marketHashName) {
      return NextResponse.json({ error: 'Missing market_hash_name' }, { status: 400 });
    }

    const price = await getItemPrice(marketHashName);
    if (!price?.price) {
      return NextResponse.json({ ok: true, market_hash_name: marketHashName, priceEur: null }, { status: 200 });
    }

    const eur = parseEur(price.price);
    return NextResponse.json(
      {
        ok: true,
        market_hash_name: marketHashName,
        priceEur: eur,
        raw: price.price,
        currency: price.currency || 'EUR',
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch price' }, { status: 500 });
  }
}
