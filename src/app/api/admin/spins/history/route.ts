import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

const ADMIN_HEADER = 'x-admin-key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SpinHistoryRow = {
  steamId: string;
  reward: number;
  createdAt: string;
  role: string;
};

type SpinHistorySummary = {
  totalSpins: number;
  totalCredits: number;
  bestReward: number;
};

export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasMongoConfig()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  try {
    const url = new URL(request.url);
    const rawDays = Number(url.searchParams.get('days') || 30);
    const days = Math.max(1, Math.min(30, Math.floor(Number.isFinite(rawDays) ? rawDays : 30)));

    const rawLimit = Number(url.searchParams.get('limit') || 2000);
    const limit = Math.max(1, Math.min(5000, Math.floor(Number.isFinite(rawLimit) ? rawLimit : 2000)));

    const db = await getDatabase();
    const historyCol = db.collection('spin_history');

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const summaryAgg = await historyCol
      .aggregate([
        { $match: { createdAt: { $gte: cutoff } } },
        {
          $group: {
            _id: null,
            totalSpins: { $sum: 1 },
            totalCredits: { $sum: '$reward' },
            bestReward: { $max: '$reward' },
          },
        },
      ] as any)
      .toArray();

    const summaryRow: any = summaryAgg?.[0] || null;
    const summary: SpinHistorySummary = {
      totalSpins: Number(summaryRow?.totalSpins || 0),
      totalCredits: Number(summaryRow?.totalCredits || 0),
      bestReward: Number(summaryRow?.bestReward || 0),
    };

    const allTimeAgg = await historyCol
      .aggregate([
        {
          $group: {
            _id: null,
            totalSpins: { $sum: 1 },
            totalCredits: { $sum: '$reward' },
            bestReward: { $max: '$reward' },
          },
        },
      ] as any)
      .toArray();

    const allTimeRow: any = allTimeAgg?.[0] || null;
    const allTimeSummary: SpinHistorySummary = {
      totalSpins: Number(allTimeRow?.totalSpins || 0),
      totalCredits: Number(allTimeRow?.totalCredits || 0),
      bestReward: Number(allTimeRow?.bestReward || 0),
    };

    const rows = await historyCol
      .find({ createdAt: { $gte: cutoff } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const items: SpinHistoryRow[] = rows.map((r: any) => ({
      steamId: String(r?.steamId || ''),
      reward: Number(r?.reward || 0),
      createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : new Date(0).toISOString(),
      role: String(r?.role || 'user'),
    }));

    return NextResponse.json(
      { success: true, days, limit, count: items.length, summary, allTimeSummary, items },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
