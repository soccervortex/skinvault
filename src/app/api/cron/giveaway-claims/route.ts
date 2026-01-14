import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(1, Math.floor(Number(searchParams.get('limit') || 50))), 200);

    const db = await getDatabase();
    const winnersCol = db.collection('giveaway_winners');
    const giveawaysCol = db.collection('giveaways');

    const now = new Date();

    const docs: any[] = await winnersCol
      .find({ winners: { $elemMatch: { claimStatus: 'pending', claimDeadlineAt: { $lte: now } } } } as any)
      .sort({ pickedAt: 1 })
      .limit(limit)
      .toArray();

    let forfeitedCount = 0;
    let archivedCount = 0;

    for (const d of docs) {
      const giveawayId = String(d?._id || '').trim();
      const winners: any[] = Array.isArray(d?.winners) ? d.winners : [];
      let changed = false;

      for (const w of winners) {
        const st = String(w?.claimStatus || '');
        const deadlineMs = w?.claimDeadlineAt ? new Date(w.claimDeadlineAt).getTime() : NaN;
        if (st === 'pending' && Number.isFinite(deadlineMs) && deadlineMs <= now.getTime()) {
          w.claimStatus = 'forfeited';
          w.forfeitedAt = now;
          changed = true;
          forfeitedCount++;

          await createUserNotification(
            db,
            String(w?.steamId || ''),
            'giveaway_forfeited',
            'Prize Forfeited',
            'You did not claim your giveaway prize within the 24 hour window, so the prize was forfeited.',
            { giveawayId }
          );
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

    return NextResponse.json({ ok: true, processed: docs.length, forfeitedCount, archivedCount }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
