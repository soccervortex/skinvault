import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({} as any));
        const currency = String(body?.currency || '3').trim();
        const pricesRaw = Array.isArray(body?.prices) ? body.prices : [];
        const prices = pricesRaw.slice(0, 1000);

        if (!prices.length) {
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 });
        }

        const db = await getDatabase();
        const col = db.collection('market_prices');
        const now = new Date().toISOString();

        const ops = prices
            .map((item: any) => {
                const name = String(item?.name || '').trim();
                const p = Number(item?.price);
                if (!name || !Number.isFinite(p) || p <= 0) return null;
                return {
                    updateOne: {
                        filter: { currency, market_hash_name: name },
                        update: {
                            $set: {
                                currency,
                                market_hash_name: name,
                                price: p,
                                updatedAt: now,
                                source: 'external_worker',
                            },
                        },
                        upsert: true,
                    },
                };
            })
            .filter(Boolean);

        if (ops.length > 0) {
            await col.bulkWrite(ops as any, { ordered: false });
        }

        return NextResponse.json({ success: true, updated: ops.length }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
    }
}