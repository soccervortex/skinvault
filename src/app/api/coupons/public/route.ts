import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';

export const runtime = 'nodejs';

const STORAGE_KEY = 'admin_stripe_coupons';

type StoredPromo = {
  code: string;
  name: string | null;
  kind: 'percent' | 'amount';
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  singleUsePerUser?: boolean;
  creatorSlug?: string | null;
  testMode: boolean;
  deletedAt: string | null;
};

function asMs(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export async function GET() {
  try {
    const testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
    const all = (await dbGet<StoredPromo[]>(STORAGE_KEY, false)) || [];

    const now = Date.now();

    const coupons = (Array.isArray(all) ? all : [])
      .filter((r) => !!r && !r.deletedAt)
      .filter((r) => r.testMode === testMode)
      .filter((r) => r.active === true)
      .filter((r) => !r.creatorSlug)
      .filter((r) => r.singleUsePerUser !== true)
      .filter((r) => {
        const startMs = asMs(r.startsAt);
        const endMs = asMs(r.expiresAt);
        if (startMs != null && now < startMs) return false;
        if (endMs != null && now >= endMs) return false;
        return true;
      })
      .map((r) => ({
        code: String(r.code || '').trim(),
        name: r.name ? String(r.name) : null,
        kind: r.kind,
        percentOff: r.percentOff ?? null,
        amountOff: r.amountOff ?? null,
        currency: r.currency ? String(r.currency) : null,
        startsAt: r.startsAt ? String(r.startsAt) : null,
        expiresAt: r.expiresAt ? String(r.expiresAt) : null,
      }))
      .filter((r) => !!r.code);

    const res = NextResponse.json({ coupons }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    console.error('GET /api/coupons/public failed', { name: e?.name, code: e?.code, message: e?.message });
    return NextResponse.json({ error: e?.message || 'Failed to load coupons' }, { status: 500 });
  }
}
