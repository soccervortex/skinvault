import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';

export const runtime = 'nodejs';

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

type EntryRow = { steamId: string; entries: number };

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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const authHeader = req.headers.get('authorization');
  const secret = url.searchParams.get('secret');
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}` && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const limit = Math.min(Math.max(1, Math.floor(Number(url.searchParams.get('limit') || 25))), 200);

    const db = await getDatabase();
    const giveawaysCol = db.collection('giveaways');
    const entriesCol = db.collection('giveaway_entries');
    const winnersCol = db.collection('giveaway_winners');
    const settingsCol = db.collection('user_settings');
    const locksCol = db.collection('giveaway_draw_locks');

    const now = new Date();
    const lockTtlMs = 10 * 60 * 1000;

    const ended: any[] = await giveawaysCol
      .find(
        {
          archivedAt: { $exists: false },
          endAt: { $lte: now },
          drawnAt: { $exists: false },
        } as any,
        { projection: { _id: 1, endAt: 1, winnerCount: 1, claimMode: 1 } } as any
      )
      .sort({ endAt: 1 })
      .limit(limit)
      .toArray();

    let drawnCount = 0;
    let skippedLockedCount = 0;
    let skippedAlreadyDrawnCount = 0;
    let errorCount = 0;

    for (const g of ended) {
      const id = String(g?._id || '').trim();
      if (!id) continue;

      let oid: ObjectId | null = null;
      try {
        oid = new ObjectId(id);
      } catch {
        oid = null;
      }
      if (!oid) continue;

      const lockExpiresAt = new Date(now.getTime() + lockTtlMs);
      try {
        const lockRes = await locksCol.findOneAndUpdate(
          {
            _id: id,
            $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
          } as any,
          {
            $set: { expiresAt: lockExpiresAt, updatedAt: now },
            $setOnInsert: { _id: id, createdAt: now },
          } as any,
          { upsert: true, returnDocument: 'before' } as any
        );

        const previous = (lockRes as any)?.value;
        if (previous?.expiresAt && new Date(previous.expiresAt).getTime() > now.getTime()) {
          skippedLockedCount++;
          continue;
        }
      } catch {
        skippedLockedCount++;
        continue;
      }

      try {
        const claimModeRaw = String(g?.claimMode || 'bot')
          .trim()
          .toLowerCase();
        const claimMode = claimModeRaw === 'manual' ? 'manual' : 'bot';
        const existing = await winnersCol.findOne({ _id: id } as any, { projection: { winners: 1 } } as any);
        if (Array.isArray((existing as any)?.winners) && (existing as any).winners.length > 0) {
          skippedAlreadyDrawnCount++;
          try {
            await giveawaysCol.updateOne({ _id: oid } as any, { $set: { drawnAt: now, updatedAt: now } } as any);
          } catch {
          }
          continue;
        }

        const rows = await entriesCol.find({ giveawayId: oid } as any, { projection: { steamId: 1, entries: 1 } } as any).toArray();
        const normalized: EntryRow[] = rows.map((r: any) => ({ steamId: String(r?.steamId || ''), entries: Number(r?.entries || 0) }));
        const pool = normalized
          .map((e) => ({ steamId: String(e.steamId || ''), entries: Math.max(0, Math.floor(Number(e.entries || 0))) }))
          .filter((e) => /^\d{17}$/.test(e.steamId) && e.entries > 0);

        const winnerCount = Math.max(1, Math.floor(Number(g?.winnerCount || 1)));
        const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const winners: any[] = [];

        while (winners.length < winnerCount) {
          const one = pickOneWeighted(pool);
          if (!one) break;

          const idx = pool.findIndex((p) => p.steamId === one.steamId);
          if (idx >= 0) pool.splice(idx, 1);

          if (claimMode !== 'manual') {
            const settings: any = await settingsCol.findOne({ _id: one.steamId } as any, { projection: { tradeUrl: 1 } } as any);
            const tradeUrl = String(settings?.tradeUrl || '').trim();
            if (!isValidTradeUrl(tradeUrl)) {
              try {
                await createUserNotification(
                  db,
                  one.steamId,
                  'giveaway_missing_trade_url',
                  'Trade URL Required',
                  'You were selected as a giveaway winner, but you do not have a valid Steam trade URL set. Add your trade URL to claim prizes.',
                  { giveawayId: id }
                );
              } catch {
              }
              continue;
            }
          }

          winners.push({
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
              giveawayId: oid,
              winners,
              pickedAt: now,
              pickedBy: 'cron',
              updatedAt: now,
            },
          } as any,
          { upsert: true } as any
        );

        await giveawaysCol.updateOne({ _id: oid } as any, { $set: { drawnAt: now, updatedAt: now } } as any);

        for (const w of winners) {
          const sid = String(w?.steamId || '').trim();
          if (!/^\d{17}$/.test(sid)) continue;
          try {
            await createUserNotification(
              db,
              sid,
              'giveaway_won',
              'You Won a Giveaway!',
              'You were selected as a giveaway winner. Claim your prize within 24 hours in the Giveaways page.',
              { giveawayId: id, claimDeadlineAt: deadline.toISOString() }
            );
          } catch {
          }
        }

        drawnCount++;
      } catch (e: any) {
        errorCount++;
      } finally {
        try {
          await locksCol.deleteOne({ _id: id } as any);
        } catch {
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        scanned: ended.length,
        drawnCount,
        skippedLockedCount,
        skippedAlreadyDrawnCount,
        errorCount,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
