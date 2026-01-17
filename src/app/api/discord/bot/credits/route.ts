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
  const col = db.collection<UserCreditsDoc>('user_credits');
  const doc = await col.findOne({ _id: steamId } as any);
  const balance = Number((doc as any)?.balance || 0);
  const pro = await isProMongoOnly(steamId);
  const restriction = await getCreditsRestrictionStatus(steamId);

  return NextResponse.json({ ok: true, steamId, balance: Number.isFinite(balance) ? balance : 0, pro, restriction }, { status: 200 });
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

  if (action !== 'daily_claim') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const restriction = await getCreditsRestrictionStatus(steamId);
  if (restriction.banned) {
    return NextResponse.json({ error: 'Credits access is banned for this user' }, { status: 403 });
  }
  if (restriction.timeoutActive) {
    return NextResponse.json({ error: 'Credits access is temporarily restricted for this user', timeoutUntil: restriction.timeoutUntil }, { status: 403 });
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
    await claimsCol.insertOne({ _id: claimKey, steamId, day: today, createdAt: now, amount, pro } as any);
  } catch (e: any) {
    if (e?.code === 11000) {
      return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
    }
    throw e;
  }

  const upd = await creditsCol.findOneAndUpdate(
    { _id: steamId } as any,
    {
      $setOnInsert: { _id: steamId, steamId } as any,
      $inc: { balance: amount },
      $set: { updatedAt: now, lastDailyClaimAt: now, lastDailyClaimDay: today },
    } as any,
    { upsert: true, returnDocument: 'after' }
  );
  const updatedDoc = (upd as any)?.value ?? null;

  await ledgerCol.insertOne({ steamId, delta: amount, type: 'daily_claim', createdAt: now, meta: { day: today, pro, source: 'discord' } });

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
      ok: true,
      steamId,
      balance: Number(updatedDoc?.balance || 0),
      claimed: amount,
      pro,
      nextEligibleAt: nextMidnightUtc(now).toISOString(),
      serverNow: now.toISOString(),
    },
    { status: 200 }
  );
}
