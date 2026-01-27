import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHash, randomBytes } from 'crypto';

import { isAdminRequest, getAdminSteamId } from '@/app/utils/admin-auth';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { resolveVoucherSku } from '@/app/utils/voucher-skus';

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
};

function normalizeVoucherCode(codeRaw: string): string {
  return String(codeRaw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function hashVoucherCode(normalizedCode: string): string {
  return createHash('sha256').update(normalizedCode).digest('hex');
}

function makeVoucherCode(): string {
  const hex = randomBytes(12).toString('hex').toUpperCase();
  return `SV-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 24)}`;
}

export async function POST(req: NextRequest) {
  if (!VOUCHERS_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const sku = resolveVoucherSku(body?.skuId);
    const rawQty = Number(body?.quantity ?? 0);
    const quantity = Math.min(2000, Math.max(1, Math.floor(Number.isFinite(rawQty) ? rawQty : 0)));

    const rawSource = String(body?.source || '').trim();
    const source = rawSource ? rawSource.slice(0, 64) : null;

    const rawExpiresAt = body?.expiresAt ? new Date(String(body.expiresAt)) : null;
    const expiresAt = rawExpiresAt && !Number.isNaN(rawExpiresAt.getTime()) ? rawExpiresAt : null;

    if (!sku) {
      return NextResponse.json({ error: 'Invalid skuId' }, { status: 400 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const codesCol = db.collection<VoucherCodeDoc>('voucher_codes');

    const now = new Date();
    const generatedBy = getAdminSteamId(req);

    const codes: string[] = [];
    const docs: VoucherCodeDoc[] = [];

    for (let i = 0; i < quantity; i += 1) {
      const plain = makeVoucherCode();
      const normalized = normalizeVoucherCode(plain);
      const id = hashVoucherCode(normalized);
      codes.push(plain);
      docs.push({
        _id: id,
        skuId: sku.id,
        credits: sku.credits,
        proMonths: sku.proMonths,
        status: 'active',
        createdAt: now,
        expiresAt,
        source,
        generatedBy,
        redeemedAt: null,
        redeemedBySteamId: null,
      });
    }

    try {
      await codesCol.insertMany(docs as any, { ordered: false });
    } catch {
      const inserted: string[] = [];
      for (let i = 0; i < codes.length; i += 1) {
        const normalized = normalizeVoucherCode(codes[i]);
        const id = hashVoucherCode(normalized);
        try {
          await codesCol.insertOne(docs[i] as any);
          inserted.push(codes[i]);
        } catch {
        }
      }
      return NextResponse.json(
        {
          ok: true,
          skuId: sku.id,
          requested: quantity,
          created: inserted.length,
          codes: inserted,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        skuId: sku.id,
        created: codes.length,
        codes,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to generate vouchers' }, { status: 500 });
  }
}
