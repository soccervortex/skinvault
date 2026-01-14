import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { createUserNotification } from '@/app/utils/user-notifications';

function isValidTradeUrl(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.hostname !== 'steamcommunity.com') return false;
    if (u.pathname !== '/tradeoffer/new/') return false;
    const partner = u.searchParams.get('partner');
    const token = u.searchParams.get('token');
    if (!partner || !/^\d+$/.test(partner)) return false;
    if (!token || !/^[A-Za-z0-9_-]{6,64}$/.test(token)) return false;
    return true;
  } catch {
    return false;
  }
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const winnersCol = db.collection('giveaway_winners');
    const giveawaysCol = db.collection('giveaways');
    const settingsCol = db.collection('user_settings');

    const now = new Date();

    const settings: any = await settingsCol.findOne({ _id: steamId } as any, { projection: { tradeUrl: 1 } });
    const tradeUrl = String(settings?.tradeUrl || '').trim();
    if (!isValidTradeUrl(tradeUrl)) {
      return NextResponse.json(
        {
          error:
            'Invalid trade URL. Set your Steam trade URL first: https://steamcommunity.com/tradeoffer/new/?partner=...&token=...',
        },
        { status: 400 }
      );
    }

    const wdoc: any = await winnersCol.findOne({ _id: id } as any);
    const winners: any[] = Array.isArray(wdoc?.winners) ? wdoc.winners : [];

    const mine = winners.find((w) => String(w?.steamId || '') === steamId);
    if (!mine) return NextResponse.json({ error: 'Not a winner' }, { status: 403 });

    const status = String(mine?.claimStatus || '');
    if (status === 'claimed') return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
    if (status === 'forfeited') return NextResponse.json({ error: 'Prize forfeited' }, { status: 400 });

    const deadlineMs = mine?.claimDeadlineAt ? new Date(mine.claimDeadlineAt).getTime() : NaN;
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
      return NextResponse.json({ error: 'Claim window expired' }, { status: 400 });
    }

    const res = await winnersCol.updateOne(
      { _id: id } as any,
      {
        $set: {
          'winners.$[w].claimStatus': 'claimed',
          'winners.$[w].claimedAt': now,
          updatedAt: now,
        },
      } as any,
      { arrayFilters: [{ 'w.steamId': steamId } as any] }
    );

    if (!res.matchedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const after: any = await winnersCol.findOne({ _id: id } as any);
    const afterWinners: any[] = Array.isArray(after?.winners) ? after.winners : [];
    const anyPending = afterWinners.some((w) => String(w?.claimStatus || '') === 'pending');

    if (!anyPending) {
      await giveawaysCol.updateOne({ _id: giveawayId } as any, { $set: { archivedAt: now, updatedAt: now } } as any);
    }

    await createUserNotification(
      db,
      steamId,
      'giveaway_claimed',
      'Prize Claimed',
      'You successfully claimed your giveaway prize. The staff will contact you or send the trade soon.',
      { giveawayId: id }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to claim' }, { status: 500 });
  }
}
