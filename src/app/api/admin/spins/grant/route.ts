import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';

function dayKeyUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDailyResetOffsetMinutes(): number {
  const raw = Number(process.env.DAILY_RESET_TZ_OFFSET_MINUTES || 0);
  if (!Number.isFinite(raw)) return 0;
  const n = Math.trunc(raw);
  return Math.max(-14 * 60, Math.min(14 * 60, n));
}

function dayKeyWithOffset(now: Date, offsetMinutes: number): string {
  const shifted = new Date(now.getTime() + offsetMinutes * 60 * 1000);
  return dayKeyUtc(shifted);
}

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

export const runtime = 'nodejs';

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
    const steamId = sanitizeSteamId(body?.steamId);
    const amountRaw = Number(body?.amount);
    const amount = Number.isFinite(amountRaw) ? Math.floor(amountRaw) : NaN;
    const reason = String(body?.reason || '').trim().slice(0, 200);

    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const now = new Date();
    const resetOffsetMinutes = getDailyResetOffsetMinutes();
    const day = dayKeyWithOffset(now, resetOffsetMinutes);

    const db = await getDatabase();
    const bonusCol = db.collection('bonus_spins');
    const adminActionsCol = db.collection('admin_actions');

    await getOrMigrateBonusBalance(db as any, steamId);

    await bonusCol.updateOne(
      { _id: steamId } as any,
      {
        $setOnInsert: { _id: steamId, steamId, createdAt: now } as any,
        $inc: { count: amount },
        $set: { updatedAt: now, updatedBy: requesterSteamId },
      } as any,
      { upsert: true }
    );

    const doc = await bonusCol.findOne({ _id: steamId } as any);
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
