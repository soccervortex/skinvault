import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

export const runtime = 'nodejs';

const STORAGE_KEY = 'admin_stripe_coupons';

type StoredPromo = {
  promoCodeId?: string;
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

function normalizeLabel(s: any): string {
  return String(s ?? '').trim().toLowerCase();
}

async function getExcludedNameLabels(): Promise<Set<string>> {
  const defaults = ['partner code', 'futher partner code', 'future partner code', 'further partner code'];

  // 1) Optional env override
  const envRaw = String(process.env.PUBLIC_COUPON_EXCLUDED_NAMES || '').trim();
  if (envRaw) {
    const list = envRaw.split(',').map((v) => normalizeLabel(v)).filter(Boolean);
    return new Set(list.length > 0 ? list : defaults);
  }

  // 2) Database-backed config (MongoDB/KV via dbGet)
  // Store either a comma-separated string OR a JSON array of strings.
  const dbRaw = String((await dbGet<string>('public_coupon_excluded_names', false)) || '').trim();
  if (dbRaw) {
    try {
      const parsed = JSON.parse(dbRaw);
      if (Array.isArray(parsed)) {
        const list = parsed.map((v) => normalizeLabel(v)).filter(Boolean);
        return new Set(list.length > 0 ? list : defaults);
      }
    } catch {
    }

    const list = dbRaw.split(',').map((v) => normalizeLabel(v)).filter(Boolean);
    return new Set(list.length > 0 ? list : defaults);
  }

  // 3) Fallback
  return new Set(defaults);
}

function asMs(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = String(url.searchParams.get('steamId') || '').trim();

    const testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
    const all = (await dbGet<StoredPromo[]>(STORAGE_KEY, false)) || [];

    const now = Date.now();
    const excludedLabels = await getExcludedNameLabels();

    let coupons = (Array.isArray(all) ? all : [])
      .filter((r) => !!r && !r.deletedAt)
      .filter((r) => r.testMode === testMode)
      .filter((r) => r.active === true)
      .filter((r) => !r.creatorSlug)
      .filter((r) => {
        const label = normalizeLabel(r.name);
        if (!label) return true;
        return !excludedLabels.has(label);
      })
      .filter((r) => {
        const startMs = asMs(r.startsAt);
        const endMs = asMs(r.expiresAt);
        if (startMs != null && now < startMs) return false;
        if (endMs != null && now >= endMs) return false;
        return true;
      })
      .filter((r) => !!String(r.code || '').trim());

    const canFilterUsedSingleUse = /^\d{17}$/.test(steamId) && hasMongoConfig();
    if (canFilterUsedSingleUse) {
      try {
        const keys = coupons
          .filter((r) => r.singleUsePerUser === true && String((r as any)?.promoCodeId || '').trim())
          .map((r) => `${steamId}_${String((r as any)?.promoCodeId || '').trim()}`);

        if (keys.length > 0) {
          const db = await getDatabase();
          const col = db.collection('promo_single_use');
          const used = await col
            .find({ _id: { $in: keys } } as any, { projection: { _id: 1 } } as any)
            .toArray();
          const usedSet = new Set((used || []).map((d: any) => String(d?._id || '').trim()).filter(Boolean));
          coupons = coupons.filter((r) => {
            if (r.singleUsePerUser !== true) return true;
            const promoCodeId = String((r as any)?.promoCodeId || '').trim();
            if (!promoCodeId) return true;
            return !usedSet.has(`${steamId}_${promoCodeId}`);
          });
        }
      } catch {
      }
    }

    const out = coupons
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

    const res = NextResponse.json({ coupons: out }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    console.error('GET /api/coupons/public failed', { name: e?.name, code: e?.code, message: e?.message });
    return NextResponse.json({ error: e?.message || 'Failed to load coupons' }, { status: 500 });
  }
}
