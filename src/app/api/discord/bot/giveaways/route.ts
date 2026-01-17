import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { ObjectId } from 'mongodb';
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
};

type CreditsLedgerDoc = {
  steamId: string;
  delta: number;
  type: string;
  createdAt: Date;
  meta?: any;
};

export async function GET(request: Request) {
  if (!checkBotAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasMongoConfig()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') || '').trim().toLowerCase();

  const db = await getDatabase();
  const col = db.collection('giveaways');
  const now = new Date();

  const filter: any = { archivedAt: { $exists: false } };
  if (status === 'active') {
    filter.startAt = { $lte: now };
    filter.endAt = { $gt: now };
    filter.drawnAt = { $exists: false };
  } else if (status === 'past') {
    filter.$or = [{ endAt: { $lte: now } }, { drawnAt: { $exists: true } }];
  }

  const rows = await col.find(filter, { projection: { description: 0 } }).sort({ startAt: -1 }).limit(25).toArray();

  const out = rows.map((g: any) => {
    const startAt = g.startAt ? new Date(g.startAt) : null;
    const endAt = g.endAt ? new Date(g.endAt) : null;
    const isActive = !!(startAt && endAt && startAt <= now && endAt > now && !g.drawnAt);
    return {
      id: String(g._id),
      title: String(g.title || ''),
      prize: String(g.prize || ''),
      startAt: startAt ? startAt.toISOString() : null,
      endAt: endAt ? endAt.toISOString() : null,
      creditsPerEntry: Number(g.creditsPerEntry || 10),
      winnerCount: Number(g.winnerCount || 1),
      totalEntries: Number(g.totalEntries || 0),
      totalParticipants: Number(g.totalParticipants || 0),
      isActive,
      drawnAt: g.drawnAt ? new Date(g.drawnAt).toISOString() : null,
    };
  });

  return NextResponse.json({ ok: true, giveaways: out }, { status: 200 });
}

export async function POST(request: Request) {
  if (!checkBotAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const discordId = String(body?.discordId || '').trim();
  const giveawayIdStr = String(body?.giveawayId || '').trim();
  const entriesRequested = Math.floor(Number(body?.entries || 0));

  if (!discordId) return NextResponse.json({ error: 'Missing discordId' }, { status: 400 });
  if (!giveawayIdStr) return NextResponse.json({ error: 'Missing giveawayId' }, { status: 400 });
  if (!Number.isFinite(entriesRequested) || entriesRequested <= 0 || entriesRequested > 100000) {
    return NextResponse.json({ error: 'Invalid entries' }, { status: 400 });
  }

  const steamId = await steamIdFromDiscordId(discordId);
  if (!steamId) return NextResponse.json({ error: 'Discord account not connected' }, { status: 404 });

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

  let giveawayId: ObjectId;
  try {
    giveawayId = new ObjectId(giveawayIdStr);
  } catch {
    return NextResponse.json({ error: 'Invalid giveawayId' }, { status: 400 });
  }

  const db = await getDatabase();
  const giveawaysCol = db.collection('giveaways');
  const entriesCol = db.collection('giveaway_entries');
  const creditsCol = db.collection<UserCreditsDoc>('user_credits');
  const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

  const giveaway: any = await giveawaysCol.findOne({ _id: giveawayId } as any);
  if (!giveaway) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date();
  const startAt = giveaway.startAt ? new Date(giveaway.startAt) : null;
  const endAt = giveaway.endAt ? new Date(giveaway.endAt) : null;
  const isActive = !!(startAt && endAt && startAt <= now && endAt > now && !giveaway.drawnAt);
  if (!isActive) return NextResponse.json({ error: 'Giveaway is not active' }, { status: 400 });

  const creditsPerEntry = Math.max(1, Math.floor(Number(giveaway.creditsPerEntry || 10)));
  const cost = entriesRequested * creditsPerEntry;

  const current = await creditsCol.findOne({ _id: steamId } as any);
  const currentBalance = Number((current as any)?.balance || 0);
  const safeBalance = Number.isFinite(currentBalance) ? currentBalance : 0;
  if (safeBalance < cost) {
    return NextResponse.json({ error: 'Not enough credits', balance: safeBalance, cost }, { status: 400 });
  }

  const nextBalance = safeBalance - cost;
  await creditsCol.updateOne(
    { _id: steamId } as any,
    { $set: { balance: nextBalance, updatedAt: now } } as any,
    { upsert: true }
  );

  const entryId = `${giveawayIdStr}_${steamId}`;
  const prev = await entriesCol.findOne({ _id: entryId } as any);
  const isNewParticipant = !prev;

  await entriesCol.updateOne(
    { _id: entryId } as any,
    {
      $setOnInsert: { _id: entryId, giveawayId, steamId, createdAt: now },
      $inc: { entries: entriesRequested, creditsSpent: cost },
      $set: { updatedAt: now },
    } as any,
    { upsert: true }
  );

  await giveawaysCol.updateOne(
    { _id: giveawayId } as any,
    [
      {
        $set: {
          totalEntries: {
            $add: [
              { $convert: { input: '$totalEntries', to: 'int', onError: 0, onNull: 0 } },
              entriesRequested,
            ],
          },
          totalParticipants: {
            $add: [
              { $convert: { input: '$totalParticipants', to: 'int', onError: 0, onNull: 0 } },
              isNewParticipant ? 1 : 0,
            ],
          },
          updatedAt: now,
        },
      },
    ] as any
  );

  await ledgerCol.insertOne({
    steamId,
    delta: -cost,
    type: 'giveaway_entry',
    createdAt: now,
    meta: { giveawayId: giveawayIdStr, entries: entriesRequested, creditsPerEntry, source: 'discord' },
  });

  try {
    await createUserNotification(
      db,
      steamId,
      'giveaway_entered',
      'Giveaway Entered',
      `You entered a giveaway with ${entriesRequested} entries and spent ${cost} credits.`,
      { giveawayId: giveawayIdStr, entries: entriesRequested, cost, creditsPerEntry, balance: nextBalance }
    );
  } catch {
  }

  const newEntry = await entriesCol.findOne({ _id: entryId } as any);

  return NextResponse.json(
    {
      ok: true,
      steamId,
      giveawayId: giveawayIdStr,
      cost,
      balance: nextBalance,
      entry: {
        entries: Number((newEntry as any)?.entries || 0),
        creditsSpent: Number((newEntry as any)?.creditsSpent || 0),
      },
    },
    { status: 200 }
  );
}
