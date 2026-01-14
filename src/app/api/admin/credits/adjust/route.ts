import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { createUserNotification } from '@/app/utils/user-notifications';

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

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const adminSteamId = getSteamIdFromRequest(req);
  if (!adminSteamId || !isOwner(adminSteamId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const steamId = sanitizeSteamId(body?.steamId) || null;
    const delta = Math.floor(Number(body?.delta || 0));
    const reason = String(body?.reason || '').trim();

    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1_000_000) {
      return NextResponse.json({ error: 'Invalid delta' }, { status: 400 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

    const now = new Date();

    const updated = await creditsCol.findOneAndUpdate(
      { _id: steamId } as any,
      {
        $setOnInsert: { _id: steamId, steamId },
        $inc: { balance: delta },
        $set: { updatedAt: now },
      } as any,
      { upsert: true, returnDocument: 'after' }
    );

    const doc = (updated as any)?.value ?? null;
    const balance = Number(doc?.balance || 0);

    await ledgerCol.insertOne({
      steamId,
      delta,
      type: 'admin_adjust',
      createdAt: now,
      meta: { adminSteamId, reason },
    });

    try {
      await createUserNotification(
        db,
        steamId,
        'credits_adjusted',
        'Credits Balance Updated',
        reason
          ? `Staff adjusted your credits by ${delta} (new balance: ${balance}). Reason: ${reason}`
          : `Staff adjusted your credits by ${delta} (new balance: ${balance}).`,
        { bySteamId: adminSteamId, delta, balance, reason: reason || null }
      );
    } catch {
    }

    return NextResponse.json({ ok: true, steamId, balance, delta }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to adjust credits' }, { status: 500 });
  }
}
