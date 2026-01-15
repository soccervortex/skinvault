import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/app/utils/mongodb-client';
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
    const limit = Math.min(Math.max(1, Math.floor(Number(url.searchParams.get('limit') || 50))), 200);
    const reminderWindowMinutes = Math.min(
      Math.max(1, Math.floor(Number(url.searchParams.get('reminderWindowMinutes') || 60))),
      24 * 60
    );

    const db = await getDatabase();
    const winnersCol = db.collection('giveaway_winners');
    const giveawaysCol = db.collection('giveaways');
    const entriesCol = db.collection('giveaway_entries');
    const settingsCol = db.collection('user_settings');

    const now = new Date();

    const reminderCutoff = new Date(now.getTime() + reminderWindowMinutes * 60 * 1000);

    const docs: any[] = await winnersCol
      .find({ winners: { $elemMatch: { claimStatus: 'pending', claimDeadlineAt: { $lte: reminderCutoff } } } } as any)
      .sort({ pickedAt: 1 })
      .limit(limit)
      .toArray();

    let forfeitedCount = 0;
    let rerolledCount = 0;
    let archivedCount = 0;
    let reminderCount = 0;

    for (const d of docs) {
      const giveawayId = String(d?._id || '').trim();
      const winners: any[] = Array.isArray(d?.winners) ? d.winners : [];
      let changed = false;

      const activeSteamIds = new Set<string>();
      for (const w of winners) {
        const sid = String(w?.steamId || '').trim();
        if (!/^\d{17}$/.test(sid)) continue;
        const st = String(w?.claimStatus || '');
        if (st !== 'forfeited') activeSteamIds.add(sid);
      }

      for (const w of winners) {
        const st = String(w?.claimStatus || '');
        const deadlineMs = w?.claimDeadlineAt ? new Date(w.claimDeadlineAt).getTime() : NaN;

        if (
          st === 'pending' &&
          Number.isFinite(deadlineMs) &&
          deadlineMs > now.getTime() &&
          deadlineMs <= reminderCutoff.getTime() &&
          !w?.reminderSentAt
        ) {
          const sid = String(w?.steamId || '').trim();
          if (/^\d{17}$/.test(sid)) {
            try {
              await createUserNotification(
                db,
                sid,
                'giveaway_claim_reminder',
                'Claim Your Prize',
                'Reminder: your giveaway prize claim window is ending soon. Claim your prize in the Giveaways page before it expires.',
                { giveawayId, claimDeadlineAt: w?.claimDeadlineAt ? new Date(w.claimDeadlineAt).toISOString() : null }
              );
            } catch {
            }
          }
          w.reminderSentAt = now;
          changed = true;
          reminderCount++;
          continue;
        }

        if (st === 'pending' && Number.isFinite(deadlineMs) && deadlineMs <= now.getTime()) {
          const forfeitedSteamId = String(w?.steamId || '').trim();
          w.claimStatus = 'forfeited';
          w.forfeitedAt = now;
          delete w.reminderSentAt;
          changed = true;
          forfeitedCount++;

          try {
            await createUserNotification(
              db,
              forfeitedSteamId,
              'giveaway_forfeited',
              'Prize Forfeited',
              'You did not claim your giveaway prize within the 24 hour window, so the prize was forfeited.',
              { giveawayId }
            );
          } catch {
          }

          activeSteamIds.delete(forfeitedSteamId);

          let oid: ObjectId | null = null;
          try {
            oid = new ObjectId(giveawayId);
          } catch {
            oid = null;
          }

          if (oid) {
            const rows = await entriesCol
              .find({ giveawayId: oid } as any, { projection: { steamId: 1, entries: 1 } })
              .toArray();
            const normalized: EntryRow[] = rows.map((r: any) => ({
              steamId: String(r?.steamId || ''),
              entries: Number(r?.entries || 0),
            }));

            const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            let replacement: EntryRow | null = null;
            for (let tries = 0; tries < 50; tries++) {
              const pool = normalized.filter((e) => !activeSteamIds.has(String(e.steamId || '')));
              if (pool.length === 0) break;
              const one = pickOneWeighted(pool);
              if (!one) break;

              const settings: any = await settingsCol.findOne(
                { _id: one.steamId } as any,
                { projection: { tradeUrl: 1 } }
              );
              const tradeUrl = String(settings?.tradeUrl || '').trim();
              if (!isValidTradeUrl(tradeUrl)) {
                try {
                  await createUserNotification(
                    db,
                    one.steamId,
                    'giveaway_missing_trade_url',
                    'Trade URL Required',
                    'You were selected as a giveaway winner, but you do not have a valid Steam trade URL set. Add your trade URL to claim prizes.',
                    { giveawayId }
                  );
                } catch {
                }
                activeSteamIds.add(one.steamId);
                continue;
              }

              replacement = one;
              break;
            }

            if (replacement) {
              w.steamId = replacement.steamId;
              w.entries = replacement.entries;
              w.claimStatus = 'pending';
              w.claimDeadlineAt = deadline;
              delete w.reminderSentAt;
              delete w.forfeitedAt;
              delete w.claimedAt;

              activeSteamIds.add(replacement.steamId);
              changed = true;
              rerolledCount++;

              try {
                await createUserNotification(
                  db,
                  replacement.steamId,
                  'giveaway_won',
                  'You Won a Giveaway!',
                  'A giveaway prize was rerolled and you are now a winner. Claim your prize within 24 hours in the Giveaways page.',
                  { giveawayId, claimDeadlineAt: deadline.toISOString() }
                );
              } catch {
              }
            }
          }
        }
      }

      if (!changed) continue;

      await winnersCol.updateOne(
        { _id: giveawayId } as any,
        { $set: { winners, updatedAt: now } } as any,
        { upsert: false }
      );

      const anyPending = winners.some((w) => String(w?.claimStatus || '') === 'pending');
      if (!anyPending) {
        let oid: ObjectId | null = null;
        try {
          oid = new ObjectId(giveawayId);
        } catch {
          oid = null;
        }
        if (oid) {
          await giveawaysCol.updateOne({ _id: oid } as any, { $set: { archivedAt: now, updatedAt: now } } as any);
          archivedCount++;
        }
      }
    }

    return NextResponse.json(
      { ok: true, processed: docs.length, forfeitedCount, rerolledCount, archivedCount, reminderCount },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
