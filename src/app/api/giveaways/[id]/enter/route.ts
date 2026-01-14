import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';

export const runtime = 'nodejs';

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
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

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const entriesRequested = Math.floor(Number(body?.entries || 0));
    if (!Number.isFinite(entriesRequested) || entriesRequested <= 0 || entriesRequested > 100000) {
      return NextResponse.json({ error: 'Invalid entries' }, { status: 400 });
    }

    const db = await getDatabase();
    const giveawaysCol = db.collection('giveaways');
    const entriesCol = db.collection('giveaway_entries');
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

    let giveawayId: ObjectId;
    try {
      giveawayId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
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
      return NextResponse.json({ error: 'Not enough credits' }, { status: 400 });
    }

    const nextBalance = safeBalance - cost;
    await creditsCol.updateOne(
      { _id: steamId } as any,
      { $set: { balance: nextBalance, updatedAt: now } } as any,
      { upsert: true }
    );

    const entryId = `${id}_${steamId}`;
    const prevRes = await entriesCol.findOneAndUpdate(
      { _id: entryId } as any,
      {
        $setOnInsert: { _id: entryId, giveawayId, steamId, createdAt: now, creditsSpent: 0, entries: 0 },
        $inc: { entries: entriesRequested, creditsSpent: cost },
        $set: { updatedAt: now },
      } as any,
      { upsert: true, returnDocument: 'before' }
    );

    const prev = (prevRes as any)?.value ?? null;
    const isNewParticipant = !prev;

    await giveawaysCol.updateOne(
      { _id: giveawayId } as any,
      [
        {
          $set: {
            totalEntries: {
              $add: [
                {
                  $convert: {
                    input: '$totalEntries',
                    to: 'int',
                    onError: 0,
                    onNull: 0,
                  },
                },
                entriesRequested,
              ],
            },
            totalParticipants: {
              $add: [
                {
                  $convert: {
                    input: '$totalParticipants',
                    to: 'int',
                    onError: 0,
                    onNull: 0,
                  },
                },
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
      meta: { giveawayId: id, entries: entriesRequested, creditsPerEntry },
    });

    const newEntry = await entriesCol.findOne({ _id: entryId } as any);

    return NextResponse.json(
      {
        ok: true,
        steamId,
        giveawayId: id,
        cost,
        balance: nextBalance,
        entry: {
          entries: Number((newEntry as any)?.entries || 0),
          creditsSpent: Number((newEntry as any)?.creditsSpent || 0),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('POST /api/giveaways/[id]/enter failed', { name: e?.name, code: e?.code, message: e?.message });
    return NextResponse.json({ error: e?.message || 'Failed to enter' }, { status: 500 });
  }
}
