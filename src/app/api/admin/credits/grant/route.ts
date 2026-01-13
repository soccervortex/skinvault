import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';

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

export async function POST(req: NextRequest) {
  const adminSteamId = getSteamIdFromRequest(req);
  if (!adminSteamId || !isOwner(adminSteamId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const steamId = sanitizeSteamId(body?.steamId) || null;
    const amount = Math.floor(Number(body?.amount || 0));
    const reason = String(body?.reason || '').trim();

    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const db = await getDatabase();
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

    const now = new Date();
    const updated = await creditsCol.findOneAndUpdate(
      { _id: steamId } as any,
      {
        $setOnInsert: { _id: steamId, steamId, balance: 0, updatedAt: now },
        $inc: { balance: amount },
        $set: { updatedAt: now },
      } as any,
      { upsert: true, returnDocument: 'after' }
    );

    const doc = (updated as any)?.value ?? updated ?? null;
    const balance = Number(doc?.balance || 0);

    await ledgerCol.insertOne({
      steamId,
      delta: amount,
      type: 'admin_grant',
      createdAt: now,
      meta: { adminSteamId, reason },
    });

    return NextResponse.json({ ok: true, steamId, balance, granted: amount }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to grant credits' }, { status: 500 });
  }
}
