import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

type SpinHistoryDoc = {
  steamId: string;
  reward: number;
  createdAt: Date;
  day: string;
  role: 'owner' | 'creator' | 'pro' | 'user';
  deletedAt?: Date;
};

function getSteamIdFromRequestOrBot(req: NextRequest): string | null {
  const sessionSteamId = getSteamIdFromRequest(req);
  if (sessionSteamId) return sessionSteamId;

  const expected = process.env.DISCORD_BOT_API_TOKEN;
  if (!expected) return null;
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) return null;

  const url = new URL(req.url);
  const fromQuery = String(url.searchParams.get('steamId') || '').trim();
  const fromHeader = String(req.headers.get('x-steam-id') || '').trim();
  const steamId = fromQuery || fromHeader;
  return /^\d{17}$/.test(steamId) ? steamId : null;
}

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequestOrBot(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!hasMongoConfig()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const url = new URL(req.url);
    const rawDays = Number(url.searchParams.get('days') || 7);
    const days = Math.max(1, Math.min(30, Math.floor(Number.isFinite(rawDays) ? rawDays : 7)));

    const rawLimit = Number(url.searchParams.get('limit') || 25);
    const limit = Math.max(1, Math.min(100, Math.floor(Number.isFinite(rawLimit) ? rawLimit : 25)));

    const db = await getDatabase();
    const historyCol = db.collection<SpinHistoryDoc>('spin_history');

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const baseMatch: any = { steamId, deletedAt: { $exists: false } };

    const summaryAgg = await historyCol
      .aggregate([
        { $match: { ...baseMatch, createdAt: { $gte: cutoff } } },
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
    const summary = {
      totalSpins: Number(summaryRow?.totalSpins || 0),
      totalCredits: Number(summaryRow?.totalCredits || 0),
      bestReward: Number(summaryRow?.bestReward || 0),
    };

    const allTimeAgg = await historyCol
      .aggregate([
        { $match: baseMatch },
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
    const allTimeSummary = {
      totalSpins: Number(allTimeRow?.totalSpins || 0),
      totalCredits: Number(allTimeRow?.totalCredits || 0),
      bestReward: Number(allTimeRow?.bestReward || 0),
    };

    const rows = await historyCol
      .find({ ...baseMatch, createdAt: { $gte: cutoff } } as any)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const items = rows.map((r: any) => ({
      reward: Number(r?.reward || 0),
      createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : null,
      day: String(r?.day || ''),
      role: String(r?.role || 'user'),
    }));

    return NextResponse.json(
      {
        ok: true,
        steamId,
        days,
        limit,
        summary,
        allTimeSummary,
        items,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load spin history' }, { status: 500 });
  }
}
