import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

const ADMIN_HEADER = 'x-admin-key';

export const runtime = 'nodejs';

function usedCountFromDoc(doc: any): number {
  if (!doc) return 0;
  const n = Number(doc?.count);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  return 1;
}

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;
    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requesterSteamId = getSteamIdFromRequest(request);
    if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwner(requesterSteamId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
    const key = `${targetSteamId}_${day}`;

    const bonusDoc = await bonusCol.findOne({ _id: key } as any);
    const current = usedCountFromDoc(bonusDoc);
    const next = Math.max(0, current - amount);

    await bonusCol.updateOne(
      { _id: key } as any,
      {
        $setOnInsert: { _id: key, steamId: targetSteamId, day, createdAt: now },
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
