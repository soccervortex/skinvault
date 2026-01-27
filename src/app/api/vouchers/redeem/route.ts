import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHash } from 'crypto';

import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { grantPro, getProUntil } from '@/app/utils/pro-storage';
import { createUserNotification } from '@/app/utils/user-notifications';

export const runtime = 'nodejs';

const VOUCHERS_ENABLED = process.env.ENABLE_VOUCHERS === 'true';

type VoucherCodeDoc = {
  _id: string;
  skuId: string;
  credits: number;
  proMonths: number;
  status: 'active' | 'redeemed' | 'disabled';
  createdAt: Date;
  expiresAt: Date | null;
  source: string | null;
  generatedBy: string | null;
  redeemedAt: Date | null;
  redeemedBySteamId: string | null;
  redemptionMeta?: any;
};

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

function normalizeVoucherCode(codeRaw: unknown): string {
  return String(codeRaw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function hashVoucherCode(normalizedCode: string): string {
  return createHash('sha256').update(normalizedCode).digest('hex');
}

export async function POST(req: NextRequest) {
  if (!VOUCHERS_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const steamId = getSteamIdFromRequest(req);
  if (!steamId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const code = normalizeVoucherCode(body?.code);

    if (!code || code.length < 12 || code.length > 80) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const codesCol = db.collection<VoucherCodeDoc>('voucher_codes');
    const creditsCol = db.collection<UserCreditsDoc>('user_credits');
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

    const now = new Date();
    const id = hashVoucherCode(code);

    const redeemed = await codesCol.findOneAndUpdate(
      {
        _id: id,
        status: 'active',
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      } as any,
      {
        $set: {
          status: 'redeemed',
          redeemedAt: now,
          redeemedBySteamId: steamId,
        },
      } as any,
      { returnDocument: 'before' }
    );

    const voucher = (redeemed as any)?.value ?? null;
    if (!voucher) {
      return NextResponse.json({ error: 'Code invalid or already redeemed' }, { status: 400 });
    }

    const credits = Math.floor(Number(voucher.credits || 0));
    const proMonths = Math.floor(Number(voucher.proMonths || 0));

    let grantedCredits = 0;
    let proUntil: string | null = null;

    if (credits > 0) {
      grantedCredits = credits;
      await creditsCol.updateOne(
        { _id: steamId } as any,
        { $setOnInsert: { _id: steamId, steamId }, $inc: { balance: credits }, $set: { updatedAt: now } } as any,
        { upsert: true } as any
      );

      await ledgerCol.insertOne({
        steamId,
        delta: credits,
        type: 'voucher_redeem',
        createdAt: now,
        meta: { voucherId: id, skuId: voucher.skuId },
      } as any);
    }

    if (proMonths > 0) {
      await grantPro(steamId, proMonths);
      proUntil = await getProUntil(steamId);
    }

    try {
      await createUserNotification(
        db,
        steamId,
        'voucher_redeemed',
        'Voucher Redeemed',
        `Your voucher was redeemed successfully. Added ${grantedCredits.toLocaleString('en-US')} credits and ${proMonths} month${proMonths === 1 ? '' : 's'} of Pro.`,
        { voucherId: id, skuId: voucher.skuId, credits: grantedCredits, proMonths, proUntil }
      );
    } catch {
    }

    return NextResponse.json(
      {
        ok: true,
        skuId: String(voucher.skuId || ''),
        creditsGranted: grantedCredits,
        proMonthsGranted: proMonths,
        proUntil,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Redeem failed' }, { status: 500 });
  }
}
