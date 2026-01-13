import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';

type UserCreditsDoc = {
  _id: string;
  steamId: string;
  balance: number;
  updatedAt: Date;
  lastDailyClaimAt?: Date;
  lastDailyClaimDay?: string;
};

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const adminSteamId = getSteamIdFromRequest(req);
  if (!adminSteamId || !isOwner(adminSteamId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const url = new URL(req.url);
    const steamId = sanitizeSteamId(url.searchParams.get('steamId'));
    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

    const db = await getDatabase();
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');

    const doc = await creditsCol.findOne({ _id: steamId } as any);

    return NextResponse.json(
      {
        ok: true,
        steamId,
        balance: Number((doc as any)?.balance || 0),
        updatedAt: (doc as any)?.updatedAt ? new Date((doc as any).updatedAt).toISOString() : null,
        lastDailyClaimAt: (doc as any)?.lastDailyClaimAt ? new Date((doc as any).lastDailyClaimAt).toISOString() : null,
        lastDailyClaimDay: (doc as any)?.lastDailyClaimDay ? String((doc as any).lastDailyClaimDay) : null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load user credits' }, { status: 500 });
  }
}
