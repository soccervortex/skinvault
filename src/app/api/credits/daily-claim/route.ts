import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isProMongoOnly } from '@/app/utils/pro-status-mongo';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';

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

function nextMidnightUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
}

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');

    const now = new Date();
    const today = dayKeyUtc(now);
    const nextEligibleAt = nextMidnightUtc(now);

    const doc = await creditsCol.findOne({ _id: steamId } as any);
    const lastDay = String((doc as any)?.lastDailyClaimDay || '');
    const canClaim = !lastDay || lastDay !== today;

    return NextResponse.json(
      {
        steamId,
        canClaim,
        nextEligibleAt: nextEligibleAt.toISOString(),
        serverNow: now.toISOString(),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load claim status' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const restriction = await getCreditsRestrictionStatus(steamId);
    if (restriction.banned) {
      return NextResponse.json({ error: 'Credits access is banned for this user' }, { status: 403 });
    }
    if (restriction.timeoutActive) {
      return NextResponse.json(
        { error: 'Credits access is temporarily restricted for this user', timeoutUntil: restriction.timeoutUntil },
        { status: 403 }
      );
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

    const now = new Date();
    const today = dayKeyUtc(now);
    const pro = await isProMongoOnly(steamId);
    const amount = pro ? 20 : 10;

    await creditsCol.updateOne(
      { _id: steamId } as any,
      { $setOnInsert: { _id: steamId, steamId, balance: 0, updatedAt: now } } as any,
      { upsert: true }
    );

    const doc = await creditsCol.findOneAndUpdate(
      {
        _id: steamId,
        $or: [{ lastDailyClaimDay: { $ne: today } }, { lastDailyClaimDay: { $exists: false } }],
      } as any,
      {
        $inc: { balance: amount },
        $set: { updatedAt: now, lastDailyClaimAt: now, lastDailyClaimDay: today },
      } as any,
      { returnDocument: 'after' }
    );

    const updated = (doc as any)?.value ?? null;
    if (!updated) {
      return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
    }

    await ledgerCol.insertOne({
      steamId,
      delta: amount,
      type: 'daily_claim',
      createdAt: now,
      meta: { day: today, pro },
    });

    return NextResponse.json(
      {
        steamId,
        balance: Number(updated?.balance || 0),
        claimed: amount,
        pro,
        nextEligibleAt: nextMidnightUtc(now).toISOString(),
        serverNow: now.toISOString(),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to claim' }, { status: 500 });
  }
}
