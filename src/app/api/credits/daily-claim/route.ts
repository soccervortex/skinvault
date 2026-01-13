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

type CreditsLedgerDoc = {
  steamId: string;
  delta: number;
  type: string;
  createdAt: Date;
  meta?: any;
};

function dayKeyUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDatabase();
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

    const now = new Date();
    const today = dayKeyUtc(now);
    const pro = await isProMongoOnly(steamId);
    const amount = pro ? 20 : 10;

    const updated = await creditsCol.findOneAndUpdate(
      {
        _id: steamId,
        $or: [{ lastDailyClaimDay: { $ne: today } }, { lastDailyClaimDay: { $exists: false } }],
      } as any,
      {
        $setOnInsert: { _id: steamId, steamId, balance: 0, updatedAt: now },
        $inc: { balance: amount },
        $set: { updatedAt: now, lastDailyClaimAt: now, lastDailyClaimDay: today },
      } as any,
      { upsert: true, returnDocument: 'after' }
    );

    const doc = updated?.value as any;
    if (!doc) {
      return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
    }

    await ledgerCol.insertOne({
      steamId,
      delta: amount,
      type: 'daily_claim',
      createdAt: now,
      meta: { day: today, pro },
    });

    return NextResponse.json({ steamId, balance: Number(doc.balance || 0), claimed: amount, pro }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to claim' }, { status: 500 });
  }
}
