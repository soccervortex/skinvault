import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
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

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const adminSteamId = getSteamIdFromRequest(req);
  if (!adminSteamId || !isOwner(adminSteamId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const steamId = sanitizeSteamId(body?.steamId) || null;
    const entryIdRaw = String(body?.entryId || '').trim();
    const applyBalance = body?.applyBalance === false ? false : true;
    const reason = String(body?.reason || '').trim();

    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    if (!entryIdRaw) return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    let entryObjectId: ObjectId;
    try {
      entryObjectId = new ObjectId(entryIdRaw);
    } catch {
      return NextResponse.json({ error: 'Invalid entryId' }, { status: 400 });
    }

    const db = await getDatabase();
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

    const original: any = await ledgerCol.findOne({ _id: entryObjectId, steamId } as any);
    if (!original) {
      return NextResponse.json({ error: 'Ledger entry not found' }, { status: 404 });
    }

    const originalDelta = Math.floor(Number(original?.delta || 0));
    const originalType = String(original?.type || '').trim();

    if (originalType.startsWith('admin_rollback')) {
      return NextResponse.json({ error: 'Cannot rollback a rollback entry' }, { status: 400 });
    }

    const now = new Date();
    const delta = applyBalance ? -originalDelta : 0;

    let balance = 0;
    if (applyBalance) {
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
      balance = Number(doc?.balance || 0);
    } else {
      const doc = await creditsCol.findOne({ _id: steamId } as any);
      balance = Number((doc as any)?.balance || 0);
    }

    await ledgerCol.insertOne({
      steamId,
      delta,
      type: applyBalance ? 'admin_rollback' : 'admin_rollback_noop',
      createdAt: now,
      meta: {
        adminSteamId,
        reason,
        entryId: entryIdRaw,
        originalDelta,
        originalType,
        applyBalance,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        steamId,
        balance,
        rolledBackDelta: delta,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to rollback entry' }, { status: 500 });
  }
}
