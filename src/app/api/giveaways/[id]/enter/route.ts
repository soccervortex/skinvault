import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

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
    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

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

    const giveawayId = new ObjectId(id);
    const giveaway: any = await giveawaysCol.findOne({ _id: giveawayId } as any);
    if (!giveaway) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const now = new Date();
    const startAt = giveaway.startAt ? new Date(giveaway.startAt) : null;
    const endAt = giveaway.endAt ? new Date(giveaway.endAt) : null;
    const isActive = !!(startAt && endAt && startAt <= now && endAt > now && !giveaway.drawnAt);
    if (!isActive) return NextResponse.json({ error: 'Giveaway is not active' }, { status: 400 });

    const creditsPerEntry = Math.max(1, Math.floor(Number(giveaway.creditsPerEntry || 10)));
    const cost = entriesRequested * creditsPerEntry;

    const creditUpdate = await creditsCol.findOneAndUpdate(
      { _id: steamId, balance: { $gte: cost } } as any,
      { $inc: { balance: -cost }, $set: { updatedAt: now } } as any,
      { returnDocument: 'after' }
    );

    const creditDoc = creditUpdate?.value as any;
    if (!creditDoc) {
      return NextResponse.json({ error: 'Not enough credits' }, { status: 400 });
    }

    const entryId = `${id}_${steamId}`;
    const prev = await entriesCol.findOneAndUpdate(
      { _id: entryId } as any,
      {
        $setOnInsert: { _id: entryId, giveawayId, steamId, createdAt: now, creditsSpent: 0, entries: 0 },
        $inc: { entries: entriesRequested, creditsSpent: cost },
        $set: { updatedAt: now },
      } as any,
      { upsert: true, returnDocument: 'before' }
    );

    const isNewParticipant = !prev?.value;

    await giveawaysCol.updateOne(
      { _id: giveawayId } as any,
      {
        $inc: {
          totalEntries: entriesRequested,
          totalParticipants: isNewParticipant ? 1 : 0,
        },
        $set: { updatedAt: now },
      } as any
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
        balance: Number(creditDoc.balance || 0),
        entry: {
          entries: Number((newEntry as any)?.entries || 0),
          creditsSpent: Number((newEntry as any)?.creditsSpent || 0),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to enter' }, { status: 500 });
  }
}
