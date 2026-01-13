import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isProMongoOnly } from '@/app/utils/pro-status-mongo';

type UserCreditsDoc = {
  _id: string;
  steamId: string;
  balance: number;
  updatedAt: Date;
  lastDailyClaimAt?: Date;
  lastDailyClaimDay?: string;
};

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDatabase();
    const col = db.collection<UserCreditsDoc>('user_credits');
    const doc = await col.findOne({ _id: steamId });
    const balance = Number(doc?.balance || 0);
    const pro = await isProMongoOnly(steamId);
    return NextResponse.json({ steamId, balance, pro }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load balance' }, { status: 500 });
  }
}
