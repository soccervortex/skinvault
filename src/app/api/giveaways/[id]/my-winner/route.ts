import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = await getDatabase();
    const winnersCol = db.collection('giveaway_winners');

    const wdoc: any = await winnersCol.findOne({ _id: id } as any);
    const winners: any[] = Array.isArray(wdoc?.winners) ? wdoc.winners : [];

    const mine = winners.find((w) => String(w?.steamId || '') === steamId) || null;

    return NextResponse.json(
      {
        ok: true,
        giveawayId: id,
        steamId,
        isWinner: !!mine,
        claimStatus: mine ? String(mine?.claimStatus || '') : null,
        claimDeadlineAt: mine?.claimDeadlineAt ? new Date(mine.claimDeadlineAt).toISOString() : null,
        claimedAt: mine?.claimedAt ? new Date(mine.claimedAt).toISOString() : null,
        forfeitedAt: mine?.forfeitedAt ? new Date(mine.forfeitedAt).toISOString() : null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load winner status' }, { status: 500 });
  }
}
