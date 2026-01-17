import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isProMongoOnly } from '@/app/utils/pro-status-mongo';
import { createUserNotification } from '@/app/utils/user-notifications';

export const runtime = 'nodejs';

type UserSpinsDoc = {
  _id: string;
  steamId: string;
  spins: number;
  updatedAt: Date;
  lastDailyClaimAt?: Date;
  lastDailyClaimDay?: string;
};

type UserCreditsDoc = {
  _id: string;
  steamId: string;
  balance: number;
  updatedAt: Date;
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

function randomSpinRewardCredits(): number {
  const r = Math.random();
  if (r < 0.55) return 10;
  if (r < 0.80) return 25;
  if (r < 0.93) return 50;
  if (r < 0.985) return 100;
  return 250;
}

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const spinsCol = db.collection<UserSpinsDoc>('user_spins');
    const claimsCol = db.collection('spins_daily_claims');

    const now = new Date();
    const today = dayKeyUtc(now);

    const claimKey = `${steamId}_${today}`;
    const alreadyClaimed = await claimsCol.findOne({ _id: claimKey } as any, { projection: { _id: 1 } });
    const canClaim = !alreadyClaimed;

    const doc = await spinsCol.findOne({ _id: steamId } as any);
    const spins = Number((doc as any)?.spins || 0);
    const pro = await isProMongoOnly(steamId);

    return NextResponse.json(
      {
        ok: true,
        steamId,
        spins: Number.isFinite(spins) ? spins : 0,
        pro,
        canClaim,
        nextEligibleAt: nextMidnightUtc(now).toISOString(),
        serverNow: now.toISOString(),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load spins' }, { status: 500 });
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

    const body = await req.json().catch(() => null);
    const action = String(body?.action || '').trim();

    const db = await getDatabase();
    const spinsCol = db.collection<UserSpinsDoc>('user_spins');
    const claimsCol = db.collection('spins_daily_claims');

    if (action === 'daily_claim') {
      const now = new Date();
      const today = dayKeyUtc(now);
      const claimKey = `${steamId}_${today}`;
      const pro = await isProMongoOnly(steamId);
      const amount = pro ? 2 : 1;

      try {
        await claimsCol.insertOne({ _id: claimKey, steamId, day: today, createdAt: now, amount, pro } as any);
      } catch (e: any) {
        if (e?.code === 11000) {
          return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
        }
        throw e;
      }

      const upd = await spinsCol.findOneAndUpdate(
        { _id: steamId } as any,
        {
          $setOnInsert: { _id: steamId, steamId } as any,
          $inc: { spins: amount },
          $set: { updatedAt: now, lastDailyClaimAt: now, lastDailyClaimDay: today },
        } as any,
        { upsert: true, returnDocument: 'after' }
      );

      const newSpins = Number((upd as any)?.value?.spins || 0);

      try {
        await createUserNotification(
          db,
          steamId,
          'daily_spin_claim',
          'Daily Spins Claimed',
          `You claimed ${amount} daily spin${amount === 1 ? '' : 's'}.`,
          { amount, day: today, pro }
        );
      } catch {
      }

      return NextResponse.json(
        {
          ok: true,
          steamId,
          claimed: amount,
          spins: Number.isFinite(newSpins) ? newSpins : 0,
          pro,
          nextEligibleAt: nextMidnightUtc(now).toISOString(),
          serverNow: now.toISOString(),
        },
        { status: 200 }
      );
    }

    if (action === 'roll') {
      const now = new Date();

      const doc = await spinsCol.findOne({ _id: steamId } as any);
      const currentSpins = Number((doc as any)?.spins || 0);
      const safeSpins = Number.isFinite(currentSpins) ? currentSpins : 0;
      if (safeSpins <= 0) {
        return NextResponse.json({ error: 'No spins available', spins: safeSpins }, { status: 400 });
      }

      const reward = randomSpinRewardCredits();

      await spinsCol.updateOne(
        { _id: steamId } as any,
        { $inc: { spins: -1 }, $set: { updatedAt: now } } as any,
        { upsert: true }
      );

      const creditsCol = db.collection<UserCreditsDoc>('user_credits');
      const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

      const upd = await creditsCol.findOneAndUpdate(
        { _id: steamId } as any,
        {
          $setOnInsert: { _id: steamId, steamId } as any,
          $inc: { balance: reward },
          $set: { updatedAt: now },
        } as any,
        { upsert: true, returnDocument: 'after' }
      );

      await ledgerCol.insertOne({
        steamId,
        delta: reward,
        type: 'spin_reward',
        createdAt: now,
        meta: { reward, source: 'website' },
      });

      const newBalance = Number((upd as any)?.value?.balance || 0);
      const newSpinsDoc = await spinsCol.findOne({ _id: steamId } as any);
      const newSpins = Number((newSpinsDoc as any)?.spins || 0);

      try {
        await createUserNotification(
          db,
          steamId,
          'spin_reward',
          'Spin Reward',
          `You rolled a spin and won ${reward} credits!`,
          { reward }
        );
      } catch {
      }

      return NextResponse.json(
        {
          ok: true,
          steamId,
          rewardCredits: reward,
          spins: Number.isFinite(newSpins) ? newSpins : 0,
          balance: Number.isFinite(newBalance) ? newBalance : 0,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
