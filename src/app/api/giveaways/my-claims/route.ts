import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

export const runtime = 'nodejs';

type GiveawayDoc = {
  _id: ObjectId;
  title?: string;
  prize?: string;
  prizeItem?: { id?: string; name?: string; market_hash_name?: string; marketHashName?: string; image?: string | null };
  claimMode?: string;
  archivedAt?: Date;
};

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const winnersCol = db.collection('giveaway_winners');
    const giveawaysCol = db.collection<GiveawayDoc>('giveaways');
    const claimsCol = db.collection('giveaway_claims');

    const now = new Date();

    const tradeClaims: any[] = await claimsCol
      .find(
        {
          steamId,
          tradeStatus: { $in: ['PENDING', 'SENT'] },
        } as any,
        { projection: { _id: 1, giveawayId: 1, tradeStatus: 1, createdAt: 1, updatedAt: 1 } }
      )
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();

    const winnerDocs: any[] = await winnersCol
      .find(
        {
          winners: {
            $elemMatch: {
              steamId,
              claimStatus: { $in: ['pending', 'pending_trade', 'manual_pending', 'manual_contacted', 'manual_awaiting_user', 'manual_sent'] },
              claimDeadlineAt: { $gt: now },
            },
          },
        } as any,
        { projection: { _id: 1, winners: 1 } }
      )
      .sort({ pickedAt: -1 })
      .limit(100)
      .toArray();

    const mineByGiveawayId = new Map<
      string,
      { entries: number; claimStatus: string; claimDeadlineAt: string | null }
    >();

    const giveawayIdStrings = new Set<string>();

    for (const d of winnerDocs) {
      const id = String(d?._id || '').trim();
      if (!id) continue;
      giveawayIdStrings.add(id);

      const winners: any[] = Array.isArray(d?.winners) ? d.winners : [];
      const mine = winners.find((w) => String(w?.steamId || '') === steamId) || null;
      if (!mine) continue;

      const claimDeadlineAt = mine?.claimDeadlineAt ? new Date(mine.claimDeadlineAt).toISOString() : null;
      const deadlineMs = claimDeadlineAt ? Date.parse(claimDeadlineAt) : NaN;
      if (Number.isFinite(deadlineMs) && deadlineMs <= Date.now()) continue;

      mineByGiveawayId.set(id, {
        entries: Number(mine?.entries || 0),
        claimStatus: String(mine?.claimStatus || ''),
        claimDeadlineAt,
      });
    }

    for (const c of tradeClaims) {
      const gid = String(c?.giveawayId || '').trim();
      if (gid) giveawayIdStrings.add(gid);
    }

    const giveawayIds: ObjectId[] = [];
    for (const id of giveawayIdStrings) {
      try {
        giveawayIds.push(new ObjectId(id));
      } catch {
        // ignore
      }
    }

    const giveaways = giveawayIds.length
      ? await giveawaysCol
          .find({ _id: { $in: giveawayIds }, archivedAt: { $exists: false } } as any, {
            projection: { _id: 1, title: 1, prize: 1, prizeItem: 1, claimMode: 1, archivedAt: 1 },
          })
          .toArray()
      : [];

    const byId = new Map<string, GiveawayDoc>();
    for (const g of giveaways as any[]) {
      byId.set(String(g?._id || ''), g as GiveawayDoc);
    }

    const missingMineIds = Array.from(giveawayIdStrings).filter((id) => !mineByGiveawayId.has(id));
    if (missingMineIds.length) {
      const missingDocs: any[] = await winnersCol
        .find({ _id: { $in: missingMineIds } } as any, { projection: { _id: 1, winners: 1 } })
        .limit(200)
        .toArray();

      for (const d of missingDocs) {
        const id = String(d?._id || '').trim();
        if (!id) continue;
        const winners: any[] = Array.isArray(d?.winners) ? d.winners : [];
        const mine = winners.find((w) => String(w?.steamId || '') === steamId) || null;
        if (!mine) continue;

        const claimDeadlineAt = mine?.claimDeadlineAt ? new Date(mine.claimDeadlineAt).toISOString() : null;
        const deadlineMs = claimDeadlineAt ? Date.parse(claimDeadlineAt) : NaN;
        if (Number.isFinite(deadlineMs) && deadlineMs <= Date.now()) continue;

        mineByGiveawayId.set(id, {
          entries: Number(mine?.entries || 0),
          claimStatus: String(mine?.claimStatus || ''),
          claimDeadlineAt,
        });
      }
    }

    const out = Array.from(giveawayIdStrings)
      .map((id) => {
        const g: any = byId.get(id);
        if (!g) return null;
        const mine = mineByGiveawayId.get(id);
        if (!mine) return null;

        return {
          giveawayId: id,
          title: String(g?.title || ''),
          prize: String(g?.prize || ''),
          claimMode: String((g as any)?.claimMode || 'bot') === 'manual' ? 'manual' : 'bot',
          prizeItem: g?.prizeItem
            ? {
                id: String(g.prizeItem?.id || ''),
                name: String(g.prizeItem?.name || ''),
                market_hash_name: String(g.prizeItem?.market_hash_name || g.prizeItem?.marketHashName || ''),
                image: g?.prizeItem?.image ? String(g.prizeItem.image) : null,
              }
            : null,
          entries: Number(mine.entries || 0),
          claimStatus: String(mine.claimStatus || ''),
          claimDeadlineAt: mine.claimDeadlineAt,
        };
      })
      .filter(Boolean);

    const filtered = out
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const am = a?.claimDeadlineAt ? Date.parse(String(a.claimDeadlineAt)) : 0;
        const bm = b?.claimDeadlineAt ? Date.parse(String(b.claimDeadlineAt)) : 0;
        return am - bm;
      });

    const res = NextResponse.json({ ok: true, steamId, claims: filtered }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load claims' }, { status: 500 });
  }
}
