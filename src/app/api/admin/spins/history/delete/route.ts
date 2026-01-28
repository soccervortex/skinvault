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

type SpinHistoryDoc = {
  _id: ObjectId;
  steamId: string;
  reward: number;
  createdAt: Date;
  day: string;
  role: string;
  usedBonus?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deletedReason?: string;
};

type UserCreditsDoc = {
  _id: string; // steamId
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
    const spinIdRaw = String(body?.spinId || '').trim();
    const reason = String(body?.reason || '').trim().slice(0, 200);

    if (!spinIdRaw) return NextResponse.json({ error: 'Missing spinId' }, { status: 400 });

    let spinId: ObjectId;
    try {
      spinId = new ObjectId(spinIdRaw);
    } catch {
      return NextResponse.json({ error: 'Invalid spinId' }, { status: 400 });
    }

    const db = await getDatabase();
    const historyCol = db.collection<SpinHistoryDoc>('spin_history');
    const spinsCol = db.collection('daily_spins');
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');
    const adminActionsCol = db.collection('admin_actions');

    const spin = await historyCol.findOne({ _id: spinId } as any);
    if (!spin) return NextResponse.json({ error: 'Spin not found' }, { status: 404 });
    if ((spin as any)?.deletedAt) return NextResponse.json({ error: 'Spin already deleted' }, { status: 400 });

    const steamId = String((spin as any)?.steamId || '').trim();
    const day = String((spin as any)?.day || '').trim();
    const reward = Math.floor(Number((spin as any)?.reward || 0));
    const usedBonus = Boolean((spin as any)?.usedBonus);

    if (!/^\d{17}$/.test(steamId)) return NextResponse.json({ error: 'Invalid steamId on spin' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ error: 'Invalid day on spin' }, { status: 400 });
    if (!Number.isFinite(reward) || reward < 0) return NextResponse.json({ error: 'Invalid reward on spin' }, { status: 400 });

    const now = new Date();

    // 1) Soft-delete spin_history row (keeps auditability)
    await historyCol.updateOne(
      { _id: spinId } as any,
      { $set: { deletedAt: now, deletedBy: requesterSteamId, deletedReason: reason || null } } as any
    );

    // 2) Reverse credits
    if (reward > 0) {
      await creditsCol.updateOne(
        { _id: steamId } as any,
        {
          $setOnInsert: { _id: steamId, steamId },
          $inc: { balance: -reward },
          $set: { updatedAt: now },
        } as any,
        { upsert: true }
      );

      await ledgerCol.insertOne({
        steamId,
        delta: -reward,
        type: 'spin_delete',
        createdAt: now,
        meta: { spinId: spinIdRaw, day, bySteamId: requesterSteamId, reason: reason || null },
      });
    }

    // 3) Decrement daily spin count for that UTC day
    const key = `${steamId}_${day}`;
    const dailyDoc = await spinsCol.findOne({ _id: key } as any);
    if (dailyDoc) {
      const current = usedCountFromDoc(dailyDoc);
      const next = Math.max(0, current - 1);
      await spinsCol.updateOne(
        { _id: key } as any,
        { $set: { count: next, updatedAt: now } } as any
      );
    }

    // 3b) If the deleted spin consumed a bonus spin, refund it to the persistent balance
    if (usedBonus) {
      const bonusCol = db.collection('bonus_spins');
      await getOrMigrateBonusBalance(db as any, steamId);
      await bonusCol.updateOne(
        { _id: steamId } as any,
        { $inc: { count: 1 }, $set: { updatedAt: now, updatedBy: requesterSteamId } } as any,
        { upsert: true }
      );
    }

    // 4) Audit trail
    try {
      await adminActionsCol.insertOne({
        type: 'spin_delete',
        createdAt: now,
        bySteamId: requesterSteamId,
        targetSteamId: steamId,
        day,
        amount: -reward,
        reason: reason || null,
        spinId: spinIdRaw,
      } as any);
    } catch {
    }

    return NextResponse.json({ ok: true, spinId: spinIdRaw, steamId, day, reversedCredits: reward });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete spin' }, { status: 500 });
  }
}
