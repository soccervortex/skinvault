import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

function safeDate(v: any): Date | null {
  const d = new Date(String(v || ''));
  return isNaN(d.getTime()) ? null : d;
}

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);

    const update: any = {};
    if (body?.title !== undefined) update.title = String(body.title || '').trim();
    if (body?.description !== undefined) update.description = String(body.description || '').trim();

    if (body?.prizeItem !== undefined) {
      const raw = body?.prizeItem;
      if (!raw) {
        update.prizeItem = undefined;
      } else {
        update.prizeItem = {
          id: String(raw?.id || '').trim(),
          name: String(raw?.name || '').trim(),
          market_hash_name: String(raw?.market_hash_name || raw?.marketHashName || '').trim(),
          image: raw?.image ? String(raw.image).trim() : null,
        };
      }
    }

    if (body?.prize !== undefined) update.prize = String(body.prize || '').trim();

    if (body?.startAt !== undefined) {
      const d = safeDate(body.startAt);
      if (!d) return NextResponse.json({ error: 'Invalid startAt' }, { status: 400 });
      update.startAt = d;
    }

    if (body?.endAt !== undefined) {
      const d = safeDate(body.endAt);
      if (!d) return NextResponse.json({ error: 'Invalid endAt' }, { status: 400 });
      update.endAt = d;
    }

    if (body?.creditsPerEntry !== undefined) {
      const c = Math.max(1, Math.floor(Number(body.creditsPerEntry || 0)));
      if (!Number.isFinite(c)) return NextResponse.json({ error: 'Invalid creditsPerEntry' }, { status: 400 });
      update.creditsPerEntry = c;
    }

    if (body?.winnerCount !== undefined) {
      const w = Math.max(1, Math.floor(Number(body.winnerCount || 0)));
      if (!Number.isFinite(w)) return NextResponse.json({ error: 'Invalid winnerCount' }, { status: 400 });
      update.winnerCount = w;
    }

    if (update.title !== undefined && !update.title) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    }

    const now = new Date();

    const db = await getDatabase();
    const col = db.collection('giveaways');

    const res = await col.updateOne({ _id: oid } as any, { $set: { ...update, updatedAt: now } } as any);
    if (!res.matchedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update giveaway' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let giveawayId: ObjectId;
    try {
      giveawayId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const db = await getDatabase();
    const giveawaysCol = db.collection('giveaways');
    const entriesCol = db.collection('giveaway_entries');
    const winnersCol = db.collection('giveaway_winners');

    const del = await giveawaysCol.deleteOne({ _id: giveawayId } as any);
    await entriesCol.deleteMany({ giveawayId } as any);
    await winnersCol.deleteOne({ _id: id } as any);

    if (!del.deletedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete giveaway' }, { status: 500 });
  }
}
