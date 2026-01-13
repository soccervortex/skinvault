import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = await getDatabase();
    const entriesCol = db.collection('giveaway_entries');

    const entryId = `${id}_${steamId}`;
    const entry: any = await entriesCol.findOne({ _id: entryId } as any, { projection: { _id: 0, entries: 1, creditsSpent: 1 } });

    return NextResponse.json(
      {
        ok: true,
        steamId,
        giveawayId: id,
        entries: Number(entry?.entries || 0),
        creditsSpent: Number(entry?.creditsSpent || 0),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load entry' }, { status: 500 });
  }
}
