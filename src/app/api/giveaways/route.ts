import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';

type GiveawayDoc = {
  _id: any;
  title: string;
  description?: string;
  prize?: string;
  prizeItem?: { id?: string; name?: string; market_hash_name?: string; marketHashName?: string; image?: string | null };
  claimMode?: string;
  startAt: Date;
  endAt: Date;
  creditsPerEntry: number;
  winnerCount: number;
  totalEntries: number;
  totalParticipants: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  drawnAt?: Date;
  archivedAt?: Date;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = String(url.searchParams.get('status') || '').trim().toLowerCase();

    const db = await getDatabase();
    const col = db.collection<GiveawayDoc>('giveaways');

    const now = new Date();
    const filter: any = { archivedAt: { $exists: false } };

    if (status === 'active') {
      filter.startAt = { $lte: now };
      filter.endAt = { $gt: now };
      filter.drawnAt = { $exists: false };
    } else if (status === 'past') {
      filter.$or = [{ endAt: { $lte: now } }, { drawnAt: { $exists: true } }];
    }

    const rows = await col
      .find(filter, { projection: { description: 0 } })
      .sort({ startAt: -1 })
      .limit(100)
      .toArray();

    const out = rows.map((g: any) => {
      const startAt = g.startAt ? new Date(g.startAt) : null;
      const endAt = g.endAt ? new Date(g.endAt) : null;
      const isActive = !!(startAt && endAt && startAt <= now && endAt > now && !g.drawnAt);
      return {
        id: String(g._id),
        title: String(g.title || ''),
        prize: String(g.prize || ''),
        claimMode: String(g.claimMode || 'bot') === 'manual' ? 'manual' : 'bot',
        prizeItem: g.prizeItem
          ? {
              id: String(g.prizeItem?.id || ''),
              name: String(g.prizeItem?.name || ''),
              market_hash_name: String(g.prizeItem?.market_hash_name || g.prizeItem?.marketHashName || ''),
              image: g.prizeItem?.image ? String(g.prizeItem.image) : null,
            }
          : null,
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

    return NextResponse.json({ giveaways: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load giveaways' }, { status: 500 });
  }
}
