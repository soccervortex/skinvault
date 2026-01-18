import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

const ADMIN_HEADER = 'x-admin-key';

type SpinHistoryRow = {
  steamId: string;
  reward: number;
  createdAt: string;
  role: string;
};

export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasMongoConfig()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const days = Math.max(1, Math.min(30, Number(new URL(request.url).searchParams.get('days') || 7)));
    const limit = Math.max(1, Math.min(5000, Number(new URL(request.url).searchParams.get('limit') || 2000)));

    const db = await getDatabase();
    const historyCol = db.collection('spin_history');

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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

    return NextResponse.json({ success: true, days, count: items.length, items });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
