import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isProMongoOnly } from '@/app/utils/pro-status-mongo';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';
import { createUserNotification } from '@/app/utils/user-notifications';

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
    const claimsCol = db.collection('credits_daily_claims');

    const now = new Date();
    const today = dayKeyUtc(now);
    const nextEligibleAt = nextMidnightUtc(now);

    const claimKey = `${steamId}_${today}`;
    const alreadyClaimed = await claimsCol.findOne({ _id: claimKey } as any, { projection: { _id: 1 } });
    const canClaim = !alreadyClaimed;

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
    const claimsCol = db.collection('credits_daily_claims');

    const now = new Date();
    const today = dayKeyUtc(now);
    const pro = await isProMongoOnly(steamId);
    const amount = pro ? 150 : 50;

    const claimKey = `${steamId}_${today}`;
    try {
      await claimsCol.insertOne({
        _id: claimKey,
        steamId,
        day: today,
        createdAt: now,
        amount,
        pro,
      } as any);
    } catch (e: any) {
      if (e?.code === 11000) {
        return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
      }
      throw e;
    }

    let updatedDoc: any = null;
    try {
      const upd = await creditsCol.findOneAndUpdate(
        { _id: steamId } as any,
        {
          $setOnInsert: { _id: steamId, steamId } as any,
          $inc: { balance: amount },
          $set: { updatedAt: now, lastDailyClaimAt: now, lastDailyClaimDay: today },
        } as any,
        { upsert: true, returnDocument: 'after' }
      );
      updatedDoc = (upd as any)?.value ?? null;
    } catch (e) {
      try {
        await claimsCol.deleteOne({ _id: claimKey } as any);
      } catch {
        // ignore
      }
      throw e;
    }

    await ledgerCol.insertOne({
      steamId,
      delta: amount,
      type: 'daily_claim',
      createdAt: now,
      meta: { day: today, pro },
    });

    try {
      await createUserNotification(
        db,
        steamId,
        'daily_claim',
        'Daily Credits Claimed',
        `You claimed ${amount} credits from your daily reward.`,
        { amount, day: today, pro }
      );
    } catch {
    }

    return NextResponse.json(
      {
        steamId,
        balance: Number(updatedDoc?.balance || 0),
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
