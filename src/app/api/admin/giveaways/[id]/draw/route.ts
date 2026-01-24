import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { createUserNotification } from '@/app/utils/user-notifications';

type EntryRow = { steamId: string; entries: number };

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = await getDatabase();
    const giveawaysCol = db.collection('giveaways');
    const entriesCol = db.collection('giveaway_entries');
    const winnersCol = db.collection('giveaway_winners');
    const settingsCol = db.collection('user_settings');

    const giveawayId = new ObjectId(id);
    const giveaway: any = await giveawaysCol.findOne({ _id: giveawayId } as any);
    if (!giveaway) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const claimModeRaw = String(giveaway?.claimMode || 'bot')
      .trim()
      .toLowerCase();
    const claimMode = claimModeRaw === 'manual' ? 'manual' : 'bot';

    const existing = await winnersCol.findOne({ _id: id } as any);
    if (Array.isArray(existing?.winners) && existing.winners.length > 0) {
      return NextResponse.json({ ok: true, winners: existing.winners, alreadyDrawn: true }, { status: 200 });
    }

    const rows = await entriesCol.find({ giveawayId } as any, { projection: { steamId: 1, entries: 1 } }).toArray();
    const normalized: EntryRow[] = rows.map((r: any) => ({ steamId: String(r.steamId || ''), entries: Number(r.entries || 0) }));

    const winnerCount = Math.max(1, Math.floor(Number(giveaway.winnerCount || 1)));
    const pool = normalized
      .map((e) => ({ steamId: String(e.steamId || ''), entries: Math.max(0, Math.floor(Number(e.entries || 0))) }))
      .filter((e) => /^\d{17}$/.test(e.steamId) && e.entries > 0);

    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const winners: any[] = [];

    while (winners.length < winnerCount) {
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

      if (claimMode !== 'manual') {
        const settings: any = await settingsCol.findOne({ _id: picked.steamId } as any, { projection: { tradeUrl: 1 } });
        const tradeUrl = String(settings?.tradeUrl || '').trim();
        if (!isValidTradeUrl(tradeUrl)) {
          await createUserNotification(
            db,
            picked.steamId,
            'giveaway_missing_trade_url',
            'Trade URL Required',
            'You were selected as a giveaway winner, but you do not have a valid Steam trade URL set. Add your trade URL to claim prizes.',
            { giveawayId: id }
          );
          continue;
        }
      }

      winners.push({
        steamId: picked.steamId,
        entries: picked.entries,
        claimStatus: 'pending',
        claimDeadlineAt: deadline,
      });
    }

    await winnersCol.updateOne(
      { _id: id } as any,
      {
        $set: {
          _id: id,
          giveawayId,
          winners,
          pickedAt: now,
          pickedBy: steamId,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    await giveawaysCol.updateOne(
      { _id: giveawayId } as any,
      { $set: { drawnAt: now, updatedAt: now } } as any
    );

    for (const w of winners) {
      const sid = String((w as any)?.steamId || '').trim();
      if (!/^\d{17}$/.test(sid)) continue;
      await createUserNotification(
        db,
        sid,
        'giveaway_won',
        'You Won a Giveaway!',
        'You were selected as a giveaway winner. Claim your prize within 24 hours in the Giveaways page.',
        { giveawayId: id, claimDeadlineAt: (w as any)?.claimDeadlineAt ? new Date((w as any).claimDeadlineAt).toISOString() : null }
      );
    }

    return NextResponse.json({ ok: true, winners }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to draw' }, { status: 500 });
  }
}
