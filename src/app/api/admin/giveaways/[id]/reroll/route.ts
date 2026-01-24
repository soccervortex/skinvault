import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { createUserNotification } from '@/app/utils/user-notifications';

type EntryRow = { steamId: string; entries: number };

type WinnerRow = {
  steamId: string;
  entries: number;
  claimStatus?: string;
  claimDeadlineAt?: Date;
  claimedAt?: Date;
  forfeitedAt?: Date;
  meta?: any;
};

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

function pickOneWeighted(pool: EntryRow[]): EntryRow | null {
  const normalized = pool
    .map((e) => ({ steamId: String(e.steamId || ''), entries: Math.max(0, Math.floor(Number(e.entries || 0))) }))
    .filter((e) => /^\d{17}$/.test(e.steamId) && e.entries > 0);

  const total = normalized.reduce((sum, e) => sum + e.entries, 0);
  if (total <= 0) return null;

  let r = Math.floor(Math.random() * total);
  for (let j = 0; j < normalized.length; j++) {
    r -= normalized[j].entries;
    if (r < 0) return normalized[j];
  }

  return normalized[0] || null;
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const adminSteamId = getSteamIdFromRequest(req);
  if (!adminSteamId || !isOwner(adminSteamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json().catch(() => null);
    const mode = String(body?.mode || 'all').trim();
    const replaceSteamId = String(body?.replaceSteamId || '').trim();

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
    const settingsCol = db.collection('user_settings');

    const giveaway: any = await giveawaysCol.findOne({ _id: giveawayId } as any);
    if (!giveaway) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const claimModeRaw = String(giveaway?.claimMode || 'bot')
      .trim()
      .toLowerCase();
    const claimMode = claimModeRaw === 'manual' ? 'manual' : 'bot';

    const existing: any = await winnersCol.findOne({ _id: id } as any);
    if (!existing?.winners || !Array.isArray(existing.winners)) {
      return NextResponse.json({ error: 'No winners to reroll' }, { status: 400 });
    }

    const beforeWinnerIds = new Set<string>();
    for (const w of existing.winners as any[]) {
      const sid = String(w?.steamId || '').trim();
      if (/^\d{17}$/.test(sid)) beforeWinnerIds.add(sid);
    }

    const winnerCount = Math.max(1, Math.floor(Number(giveaway.winnerCount || 1)));

    const keep: WinnerRow[] = [];
    const toReplace: WinnerRow[] = [];

    for (const w of existing.winners as any[]) {
      const row: WinnerRow = {
        steamId: String(w?.steamId || ''),
        entries: Number(w?.entries || 0),
        claimStatus: w?.claimStatus ? String(w.claimStatus) : undefined,
      };

      if (mode === 'replace' && replaceSteamId && row.steamId === replaceSteamId) {
        toReplace.push(row);
      } else if (mode === 'all') {
        toReplace.push(row);
      } else {
        keep.push(row);
      }
    }

    const rows = await entriesCol.find({ giveawayId } as any, { projection: { steamId: 1, entries: 1 } }).toArray();
    const normalized: EntryRow[] = rows.map((r: any) => ({ steamId: String(r?.steamId || ''), entries: Number(r?.entries || 0) }));

    const excluded = new Set<string>(keep.map((w) => w.steamId));

    const existingWinnerCount = Array.isArray(existing?.winners) ? existing.winners.length : 0;
    const fallbackModeAll = existingWinnerCount === 0;
    const targetCount = fallbackModeAll ? winnerCount : Math.min(winnerCount, keep.length + toReplace.length);
    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const picked: any[] = fallbackModeAll ? [] : [...keep].slice(0, targetCount);

    while (picked.length < targetCount) {
      const pool = normalized.filter((e) => !excluded.has(String(e.steamId || '')));
      if (pool.length === 0) break;

      const one = pickOneWeighted(pool);
      if (!one) break;

      excluded.add(one.steamId);

      const settings: any = await settingsCol.findOne({ _id: one.steamId } as any, { projection: { tradeUrl: 1 } });
      const tradeUrl = String(settings?.tradeUrl || '').trim();

      if (claimMode !== 'manual' && !isValidTradeUrl(tradeUrl)) {
        await createUserNotification(
          db,
          one.steamId,
          'giveaway_missing_trade_url',
          'Trade URL Required',
          'You were selected as a giveaway winner, but you do not have a valid Steam trade URL set. Add your trade URL to claim prizes.',
          { giveawayId: id }
        );
        continue;
      }

      picked.push({
        steamId: one.steamId,
        entries: one.entries,
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
          winners: picked,
          pickedAt: existing?.pickedAt ? new Date(existing.pickedAt) : now,
          pickedBy: existing?.pickedBy ? String(existing.pickedBy) : adminSteamId,
          rerolledAt: now,
          rerolledBy: adminSteamId,
        },
      } as any,
      { upsert: true }
    );

    const afterWinnerIds = new Set<string>();
    for (const w of picked as any[]) {
      const sid = String(w?.steamId || '').trim();
      if (/^\d{17}$/.test(sid)) afterWinnerIds.add(sid);
    }

    const newlySelected: string[] = [];
    for (const sid of afterWinnerIds) {
      if (!beforeWinnerIds.has(sid)) newlySelected.push(sid);
    }

    for (const sid of newlySelected) {
      const row = (picked as any[]).find((x) => String(x?.steamId || '').trim() === sid);
      const claimDeadlineAt = row?.claimDeadlineAt ? new Date(row.claimDeadlineAt).toISOString() : null;
      await createUserNotification(
        db,
        sid,
        'giveaway_won',
        'You Won a Giveaway!',
        'A giveaway prize was rerolled and you are now a winner. Claim your prize within 24 hours in the Giveaways page.',
        { giveawayId: id, claimDeadlineAt }
      );
    }

    if (mode === 'replace' && replaceSteamId && /^\d{17}$/.test(replaceSteamId) && beforeWinnerIds.has(replaceSteamId) && !afterWinnerIds.has(replaceSteamId)) {
      await createUserNotification(
        db,
        replaceSteamId,
        'giveaway_rerolled',
        'Winner Rerolled',
        'A giveaway winner was rerolled by staff and you are no longer selected as a winner for this giveaway.',
        { giveawayId: id }
      );
    }

    await giveawaysCol.updateOne({ _id: giveawayId } as any, { $set: { updatedAt: now } } as any);

    return NextResponse.json({ ok: true, winners: picked }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to reroll' }, { status: 500 });
  }
}
