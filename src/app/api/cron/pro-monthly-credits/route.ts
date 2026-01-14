import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getAllProUsers } from '@/app/utils/pro-storage';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';

export const runtime = 'nodejs';

type UserCreditsDoc = {
  _id: string;
  steamId: string;
  balance: number;
  updatedAt: Date;
};

type CreditsLedgerDoc = {
  steamId: string;
  delta: number;
  type: string;
  createdAt: Date;
  meta?: any;
};

function monthKeyUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const url = new URL(req.url);
    const rawAmount = Number(url.searchParams.get('amount') || process.env.PRO_MONTHLY_CREDITS || 500);
    const amount = Math.min(100000, Math.max(1, Math.floor(Number.isFinite(rawAmount) ? rawAmount : 500)));
    const dryRun = String(url.searchParams.get('dryRun') || '').trim() === 'true';
    const rawLimit = Number(url.searchParams.get('limit') || 5000);
    const limit = Math.min(20000, Math.max(1, Math.floor(Number.isFinite(rawLimit) ? rawLimit : 5000)));

    const db = await getDatabase();
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');
    const stipendsCol = db.collection('credits_monthly_stipends');

    const now = new Date();
    const month = monthKeyUtc(now);

    const proUsers = await getAllProUsers();
    const entries = Object.entries(proUsers || {}).slice(0, limit);

    let scanned = 0;
    let eligible = 0;
    let skippedRestricted = 0;
    let alreadyGranted = 0;
    let granted = 0;
    let errors = 0;

    for (const [steamId, proUntilRaw] of entries) {
      scanned++;
      const sid = String(steamId || '').trim();
      if (!/^\d{17}$/.test(sid)) continue;

      const proUntil = new Date(String(proUntilRaw || ''));
      if (isNaN(proUntil.getTime()) || proUntil.getTime() <= now.getTime()) {
        continue;
      }

      eligible++;

      const restriction = await getCreditsRestrictionStatus(sid);
      if (restriction.banned || restriction.timeoutActive) {
        skippedRestricted++;
        continue;
      }

      const stipendKey = `${sid}_${month}`;

      const exists = await stipendsCol.findOne({ _id: stipendKey } as any, { projection: { _id: 1 } });
      if (exists) {
        alreadyGranted++;
        continue;
      }

      if (dryRun) {
        granted++;
        continue;
      }

      try {
        await stipendsCol.insertOne({
          _id: stipendKey,
          steamId: sid,
          month,
          amount,
          createdAt: now,
        } as any);
      } catch (e: any) {
        if (e?.code === 11000) {
          alreadyGranted++;
          continue;
        }
        errors++;
        continue;
      }

      try {
        await creditsCol.updateOne(
          { _id: sid } as any,
          {
            $setOnInsert: { _id: sid, steamId: sid, balance: 0 },
            $inc: { balance: amount },
            $set: { updatedAt: now },
          } as any,
          { upsert: true }
        );

        await ledgerCol.insertOne({
          steamId: sid,
          delta: amount,
          type: 'pro_monthly_stipend',
          createdAt: now,
          meta: { month, stipendKey },
        } as any);

        granted++;
      } catch (e) {
        errors++;
        try {
          await stipendsCol.deleteOne({ _id: stipendKey } as any);
        } catch {
          // ignore
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        month,
        amount,
        dryRun,
        scanned,
        eligible,
        skippedRestricted,
        alreadyGranted,
        granted,
        errors,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
