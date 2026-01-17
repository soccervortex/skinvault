import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { isProMongoOnly } from '@/app/utils/pro-status-mongo';
import { createUserNotification } from '@/app/utils/user-notifications';

export const runtime = 'nodejs';

function checkBotAuth(request: Request): boolean {
  const expected = String(process.env.DISCORD_BOT_API_TOKEN || '').trim();
  if (!expected) return false;
  const auth = String(request.headers.get('authorization') || '').trim();
  return auth === `Bearer ${expected}`;
}

async function steamIdFromDiscordId(discordId: string): Promise<string | null> {
  const id = String(discordId || '').trim();
  if (!id) return null;
  const connections = (await dbGet<Record<string, any>>('discord_connections', false)) || {};
  for (const [steamId, connection] of Object.entries(connections)) {
    if (!connection) continue;
    if (String((connection as any).discordId || '') !== id) continue;
    const expiresAt = Number((connection as any).expiresAt || 0);
    if (expiresAt && Date.now() > expiresAt) continue;
    return String(steamId);
  }
  return null;
}

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
  // Simple weighted-ish reward. Keep cheap and safe.
  const r = Math.random();
  if (r < 0.55) return 10;
  if (r < 0.80) return 25;
  if (r < 0.93) return 50;
  if (r < 0.985) return 100;
  return 250;
}

export async function GET(request: Request) {
  if (!checkBotAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const discordId = String(url.searchParams.get('discordId') || '').trim();
  const steamId = await steamIdFromDiscordId(discordId);
  if (!steamId) return NextResponse.json({ error: 'Discord account not connected' }, { status: 404 });

  if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

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
}

export async function POST(request: Request) {
  if (!checkBotAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const discordId = String(body?.discordId || '').trim();
  const action = String(body?.action || '').trim();

  const steamId = await steamIdFromDiscordId(discordId);
  if (!steamId) return NextResponse.json({ error: 'Discord account not connected' }, { status: 404 });

  if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const restriction = await getCreditsRestrictionStatus(steamId);
  if (restriction.banned) {
    return NextResponse.json({ error: 'Credits access is banned for this user' }, { status: 403 });
  }
  if (restriction.timeoutActive) {
    return NextResponse.json({ error: 'Credits access is temporarily restricted for this user', timeoutUntil: restriction.timeoutUntil }, { status: 403 });
  }

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

    // Consume spin
    await spinsCol.updateOne(
      { _id: steamId } as any,
      { $inc: { spins: -1 }, $set: { updatedAt: now } } as any,
      { upsert: true }
    );

    // Grant credits reward
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
      meta: { reward, source: 'discord' },
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
}
