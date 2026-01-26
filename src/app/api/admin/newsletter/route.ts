import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const requesterSteamId = getSteamIdFromRequest(req);
  if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOwner(requesterSteamId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const col = db.collection('newsletter_subscribers');

    const [activeCount, totalCount] = await Promise.all([
      col.countDocuments({ active: true } as any),
      col.countDocuments({} as any),
    ]);

    const list = await col
      .find({ active: true } as any, { projection: { _id: 0, email: 1, steamId: 1, subscribedAt: 1, source: 1 } })
      .sort({ subscribedAt: -1 })
      .limit(5000)
      .toArray();

    return NextResponse.json({ ok: true, activeCount, totalCount, subscribers: list || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load subscribers' }, { status: 500 });
  }
}
