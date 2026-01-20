import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';

const ADMIN_HEADER = 'x-admin-key';

function dayKeyUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const runtime = 'nodejs';

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
    const steamId = sanitizeSteamId(body?.steamId);
    const amountRaw = Number(body?.amount);
    const amount = Number.isFinite(amountRaw) ? Math.floor(amountRaw) : NaN;
    const reason = String(body?.reason || '').trim().slice(0, 200);

    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const now = new Date();
    const day = dayKeyUtc(now);
    const key = `${steamId}_${day}`;

    const db = await getDatabase();
    const bonusCol = db.collection('bonus_spins');
    const adminActionsCol = db.collection('admin_actions');

    await bonusCol.updateOne(
      { _id: key } as any,
      {
        $setOnInsert: { _id: key, steamId, day, createdAt: now },
        $inc: { count: amount },
        $set: { updatedAt: now, updatedBy: requesterSteamId },
      } as any,
      { upsert: true }
    );

    const doc = await bonusCol.findOne({ _id: key } as any);
    const count = Number((doc as any)?.count);

    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = String(forwardedFor || request.headers.get('x-real-ip') || '').split(',')[0]?.trim();
    try {
      await adminActionsCol.insertOne({
        type: 'spin_grant',
        createdAt: now,
        bySteamId: requesterSteamId,
        targetSteamId: steamId,
        day,
        amount,
        reason: reason || null,
        ip: ip || null,
      } as any);
    } catch {
      // ignore audit failures
    }

    return NextResponse.json({ ok: true, steamId, day, added: amount, bonusSpins: Number.isFinite(count) ? count : null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to grant spins' }, { status: 500 });
  }
}
