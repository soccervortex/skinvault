import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

type EntryRow = { steamId: string; entries: number };

function pickWinnersWeighted(entries: EntryRow[], count: number): Array<{ steamId: string; entries: number }> {
  const pool = entries
    .map((e) => ({ steamId: String(e.steamId), entries: Math.max(0, Math.floor(Number(e.entries || 0))) }))
    .filter((e) => /^\d{17}$/.test(e.steamId) && e.entries > 0);

  const winners: Array<{ steamId: string; entries: number }> = [];

  for (let i = 0; i < count; i++) {
    const total = pool.reduce((sum, e) => sum + e.entries, 0);
    if (total <= 0) break;

    let r = Math.floor(Math.random() * total);
    let pickedIndex = -1;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].entries;
      if (r < 0) {
        pickedIndex = j;
        break;
      }
    }
    if (pickedIndex < 0) break;

    const picked = pool.splice(pickedIndex, 1)[0];
    winners.push({ steamId: picked.steamId, entries: picked.entries });
  }

  return winners;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = await getDatabase();
    const giveawaysCol = db.collection('giveaways');
    const entriesCol = db.collection('giveaway_entries');
    const winnersCol = db.collection('giveaway_winners');

    const giveawayId = new ObjectId(id);
    const giveaway: any = await giveawaysCol.findOne({ _id: giveawayId } as any);
    if (!giveaway) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existing = await winnersCol.findOne({ _id: id } as any);
    if (existing?.winners) {
      return NextResponse.json({ ok: true, winners: existing.winners, alreadyDrawn: true }, { status: 200 });
    }

    const rows = await entriesCol.find({ giveawayId } as any, { projection: { steamId: 1, entries: 1 } }).toArray();
    const normalized: EntryRow[] = rows.map((r: any) => ({ steamId: String(r.steamId || ''), entries: Number(r.entries || 0) }));

    const winnerCount = Math.max(1, Math.floor(Number(giveaway.winnerCount || 1)));
    const winners = pickWinnersWeighted(normalized, winnerCount);

    const now = new Date();
    await winnersCol.updateOne(
      { _id: id } as any,
      {
        $set: {
          _id: id,
          giveawayId,
          winners,
          pickedAt: now,
          pickedBy: steamId,
        },
      },
      { upsert: true }
    );

    await giveawaysCol.updateOne(
      { _id: giveawayId } as any,
      { $set: { drawnAt: now, updatedAt: now } } as any
    );

    return NextResponse.json({ ok: true, winners }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to draw' }, { status: 500 });
  }
}
