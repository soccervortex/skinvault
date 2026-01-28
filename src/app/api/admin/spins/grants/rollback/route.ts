import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';

export const runtime = 'nodejs';

function usedCountFromDoc(doc: any): number {
  if (!doc) return 0;
  const n = Number(doc?.count);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  return 1;
}

function bonusBalanceFromDoc(doc: any): number {
  if (!doc) return 0;
  const n = Number(doc?.count);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  return 0;
}

async function getOrMigrateBonusBalance(db: any, steamId: string): Promise<number> {
  const bonusCol = db.collection('bonus_spins');
  const balanceDoc = await bonusCol.findOne({ _id: steamId } as any);
  if (balanceDoc) return bonusBalanceFromDoc(balanceDoc);

  const legacyDocs = await bonusCol.find({ steamId, day: { $exists: true } } as any).toArray();
  const legacyTotal = (legacyDocs || []).reduce((sum: number, d: any) => sum + usedCountFromDoc(d), 0);
  const now = new Date();

  try {
    await bonusCol.updateOne(
      { _id: steamId } as any,
      {
        $setOnInsert: { _id: steamId, steamId, createdAt: now } as any,
        $set: { count: legacyTotal, updatedAt: now, migratedAt: now } as any,
      } as any,
      { upsert: true }
    );
  } catch {
  }

  return legacyTotal;
}

export async function POST(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!access.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasAdminPermission(access, 'spins')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const requesterSteamId = access.steamId;
    if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const grantIdRaw = String(body?.grantId || '').trim();
    const reason = String(body?.reason || '').trim().slice(0, 200);

    if (!grantIdRaw) return NextResponse.json({ error: 'Missing grantId' }, { status: 400 });

    let grantId: ObjectId;
    try {
      grantId = new ObjectId(grantIdRaw);
    } catch {
      return NextResponse.json({ error: 'Invalid grantId' }, { status: 400 });
    }

    const db = await getDatabase();
    const adminActionsCol = db.collection('admin_actions');
    const bonusCol = db.collection('bonus_spins');

    const grant: any = await adminActionsCol.findOne({ _id: grantId, type: 'spin_grant' } as any);
    if (!grant) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    if (grant?.rolledBackAt) {
      return NextResponse.json({ error: 'Grant already rolled back' }, { status: 400 });
    }

    const targetSteamId = String(grant?.targetSteamId || '').trim();
    const day = String(grant?.day || '').trim();
    const amount = Math.max(0, Math.floor(Number(grant?.amount || 0)));

    if (!/^\d{17}$/.test(targetSteamId)) return NextResponse.json({ error: 'Invalid targetSteamId on grant' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ error: 'Invalid day on grant' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid amount on grant' }, { status: 400 });

    const now = new Date();

    await getOrMigrateBonusBalance(db as any, targetSteamId);
    const bonusDoc = await bonusCol.findOne({ _id: targetSteamId } as any);
    const current = bonusBalanceFromDoc(bonusDoc);
    const next = Math.max(0, current - amount);

    await bonusCol.updateOne(
      { _id: targetSteamId } as any,
      {
        $setOnInsert: { _id: targetSteamId, steamId: targetSteamId, createdAt: now },
        $set: { count: next, updatedAt: now, updatedBy: requesterSteamId },
      } as any,
      { upsert: true }
    );

    await adminActionsCol.updateOne(
      { _id: grantId } as any,
      {
        $set: {
          rolledBackAt: now,
          rolledBackBy: requesterSteamId,
          rolledBackReason: reason || null,
        },
      } as any
    );

    try {
      await adminActionsCol.insertOne({
        type: 'spin_grant_rollback',
        createdAt: now,
        bySteamId: requesterSteamId,
        targetSteamId,
        day,
        amount: -amount,
        reason: reason || null,
        grantId: grantIdRaw,
      } as any);
    } catch {
    }

    return NextResponse.json({ ok: true, grantId: grantIdRaw, targetSteamId, day, rolledBackAmount: amount, bonusSpinsNow: next });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to rollback grant' }, { status: 500 });
  }
}
