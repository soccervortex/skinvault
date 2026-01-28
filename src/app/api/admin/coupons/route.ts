import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { dbGet, dbSet } from '@/app/utils/database';
import { isOwnerRequest } from '@/app/utils/admin-auth';

const STORAGE_KEY = 'admin_stripe_coupons';

function parseBool(value: any): boolean {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function asIso(value: any): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function toUnixSeconds(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

async function getStripeInstance(): Promise<{ stripe: Stripe; testMode: boolean }> {
  let testMode = false;
  try {
    testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
  } catch {
  }

  const secretKey = testMode
    ? (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
    : process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Stripe secret key not configured');
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
  });

  return { stripe, testMode };
}

type StoredPromo = {
  promoCodeId: string;
  couponId: string;
  code: string;
  name: string | null;
  kind: 'percent' | 'amount';
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  maxRedemptions: number | null;
  startsAt: string | null;
  autoEnableAtStart: boolean;
  expiresAt: string | null;
  active: boolean;
  singleUsePerUser?: boolean;
  creatorSlug?: string | null;
  createdAt: string;
  updatedAt: string;
  testMode: boolean;
  deletedAt: string | null;
};

async function loadStored(): Promise<StoredPromo[]> {
  const rows = (await dbGet<StoredPromo[]>(STORAGE_KEY, false)) || [];
  return Array.isArray(rows) ? rows : [];
}

async function saveStored(rows: StoredPromo[]): Promise<void> {
  await dbSet(STORAGE_KEY, rows);
}

function normalizeCode(code: any): string {
  return String(code ?? '').trim();
}

async function listWithLiveData(stripe: Stripe, rows: StoredPromo[]) {
  const out: Array<any> = [];
  for (const r of rows) {
    let livePromo: any = null;
    let liveCoupon: any = null;

    try {
      livePromo = await (stripe.promotionCodes as any).retrieve(r.promoCodeId);
    } catch {
    }

    try {
      liveCoupon = await (stripe.coupons as any).retrieve(r.couponId);
    } catch {
    }

    out.push({
      ...r,
      live: {
        promo: livePromo
          ? {
              id: String(livePromo?.id || ''),
              active: livePromo?.active === true,
              expires_at: livePromo?.expires_at ?? null,
              max_redemptions: livePromo?.max_redemptions ?? null,
              times_redeemed: livePromo?.times_redeemed ?? null,
            }
          : null,
        coupon: liveCoupon
          ? {
              id: String(liveCoupon?.id || ''),
              valid: liveCoupon?.valid === true,
              percent_off: liveCoupon?.percent_off ?? null,
              amount_off: liveCoupon?.amount_off ?? null,
              currency: liveCoupon?.currency ?? null,
              redeem_by: liveCoupon?.redeem_by ?? null,
            }
          : null,
      },
    });
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const includeDeleted = parseBool(url.searchParams.get('includeDeleted'));
    const includeAllModes = parseBool(url.searchParams.get('includeAllModes'));
    const includeLive = parseBool(url.searchParams.get('includeLive'));

    const { stripe, testMode } = await getStripeInstance();

    const all = await loadStored();

    // Auto-enable scheduled promo codes (only for current mode unless includeAllModes=1)
    let mutated = false;
    const now = Date.now();
    const nextAll = all.map((r) => {
      if (!r || r.deletedAt) return r;
      if (!includeAllModes && r.testMode !== testMode) return r;

      const startsMs = r.startsAt ? new Date(r.startsAt).getTime() : NaN;
      const shouldAuto = r.autoEnableAtStart === true && Number.isFinite(startsMs) && now >= startsMs;
      if (!shouldAuto) return r;
      if (r.active === true) return { ...r, autoEnableAtStart: false, updatedAt: new Date().toISOString() };

      mutated = true;
      return r;
    });

    if (mutated) {
      for (let i = 0; i < nextAll.length; i += 1) {
        const r = nextAll[i];
        if (!r || r.deletedAt) continue;
        if (!includeAllModes && r.testMode !== testMode) continue;
        const startsMs = r.startsAt ? new Date(r.startsAt).getTime() : NaN;
        const shouldAuto = r.autoEnableAtStart === true && Number.isFinite(startsMs) && now >= startsMs;
        if (!shouldAuto) continue;
        try {
          await (stripe.promotionCodes as any).update(r.promoCodeId, { active: true });
          nextAll[i] = { ...r, active: true, autoEnableAtStart: false, updatedAt: new Date().toISOString() };
        } catch {
          // ignore
        }
      }
      await saveStored(nextAll);
    }

    const filtered = nextAll
      .filter((r) => (includeAllModes ? true : r.testMode === testMode))
      .filter((r) => (includeDeleted ? true : !r.deletedAt));

    const promos = includeLive ? await listWithLiveData(stripe, filtered) : filtered;

    const res = NextResponse.json({ testMode, promos });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error: any) {
    console.error('Failed to list coupons:', error);
    return NextResponse.json({ error: error?.message || 'Failed to list coupons' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const action = String(body?.action || '').trim();
    const { stripe, testMode } = await getStripeInstance();

    const nowIso = new Date().toISOString();

    if (action === 'create') {
      const code = normalizeCode(body?.code);
      const name = String(body?.name || '').trim() || null;

      const singleUsePerUser = body?.singleUsePerUser === true;
      const creatorSlug = String(body?.creatorSlug || '').trim().toLowerCase() || null;

      const kind = String(body?.kind || 'percent').trim() === 'amount' ? 'amount' : 'percent';
      const percentOffRaw = body?.percentOff;
      const amountOffRaw = body?.amountOff;
      const currency = String(body?.currency || 'eur').trim().toLowerCase() || 'eur';

      const maxRedemptionsRaw = body?.maxRedemptions;
      const maxRedemptions = maxRedemptionsRaw == null || String(maxRedemptionsRaw).trim() === ''
        ? null
        : Math.max(1, Math.floor(Number(maxRedemptionsRaw)));

      const startsAt = asIso(body?.startsAt);
      const expiresAt = asIso(body?.expiresAt);
      const activeRequested = body?.active === true;

      if (!code) {
        return NextResponse.json({ error: 'Code is required' }, { status: 400 });
      }

      let percentOff: number | null = null;
      let amountOff: number | null = null;

      if (kind === 'percent') {
        const p = Number(percentOffRaw);
        if (!Number.isFinite(p) || p <= 0 || p > 100) {
          return NextResponse.json({ error: 'Percent off must be between 1 and 100' }, { status: 400 });
        }
        percentOff = Math.round(p * 100) / 100;
      } else {
        const a = Number(amountOffRaw);
        if (!Number.isFinite(a) || a <= 0) {
          return NextResponse.json({ error: 'Amount off must be a positive number (in cents)' }, { status: 400 });
        }
        amountOff = Math.floor(a);
      }

      const expiresUnix = toUnixSeconds(expiresAt);

      const couponParams: any = {
        duration: 'once',
        name: name || undefined,
      };

      if (kind === 'percent') {
        couponParams.percent_off = percentOff;
      } else {
        couponParams.amount_off = amountOff;
        couponParams.currency = currency;
      }

      if (expiresUnix) {
        couponParams.redeem_by = expiresUnix;
      }

      const coupon = await (stripe.coupons as any).create(couponParams);

      const startsMs = startsAt ? new Date(startsAt).getTime() : null;
      const hasStarts = typeof startsMs === 'number' && Number.isFinite(startsMs);
      const shouldBeActive = hasStarts ? Date.now() >= startsMs : true;
      const promoActive = activeRequested ? shouldBeActive : false;
      const autoEnableAtStart = activeRequested && hasStarts && Date.now() < startsMs;

      const promoParams: any = {
        promotion: {
          type: 'coupon',
          coupon: coupon.id,
        },
        code,
        active: promoActive,
      };
      if (expiresUnix) promoParams.expires_at = expiresUnix;
      if (Number.isFinite(maxRedemptions as any) && maxRedemptions) promoParams.max_redemptions = maxRedemptions;

      const promo = await (stripe.promotionCodes as any).create(promoParams);

      const record: StoredPromo = {
        promoCodeId: String(promo.id),
        couponId: String(coupon.id),
        code,
        name,
        kind,
        percentOff,
        amountOff,
        currency: kind === 'amount' ? currency : null,
        maxRedemptions,
        startsAt,
        autoEnableAtStart,
        expiresAt,
        active: promoActive,
        singleUsePerUser,
        creatorSlug,
        createdAt: nowIso,
        updatedAt: nowIso,
        testMode,
        deletedAt: null,
      };

      const rows = await loadStored();
      rows.unshift(record);
      await saveStored(rows.slice(0, 500));

      return NextResponse.json({ success: true, promo: record });
    }

    if (action === 'set_active') {
      const promoCodeId = String(body?.promoCodeId || '').trim();
      const active = body?.active === true;
      if (!promoCodeId) {
        return NextResponse.json({ error: 'promoCodeId is required' }, { status: 400 });
      }

      const rows = await loadStored();
      const idx = rows.findIndex((r) => r.promoCodeId === promoCodeId);
      if (idx < 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      await (stripe.promotionCodes as any).update(promoCodeId, { active });

      rows[idx] = {
        ...rows[idx],
        active,
        updatedAt: nowIso,
      };
      await saveStored(rows);

      return NextResponse.json({ success: true, promo: rows[idx] });
    }

    if (action === 'update') {
      const promoCodeId = String(body?.promoCodeId || '').trim();
      if (!promoCodeId) {
        return NextResponse.json({ error: 'promoCodeId is required' }, { status: 400 });
      }

      const rows = await loadStored();
      const idx = rows.findIndex((r) => r.promoCodeId === promoCodeId);
      if (idx < 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const existing = rows[idx];
      if (existing.deletedAt) {
        return NextResponse.json({ error: 'Promo code is deleted' }, { status: 400 });
      }

      const name = typeof body?.name === 'string' ? body.name.trim() || null : existing.name;
      const maxRedemptionsRaw = body?.maxRedemptions;
      const maxRedemptions = maxRedemptionsRaw == null || String(maxRedemptionsRaw).trim() === ''
        ? null
        : Math.max(1, Math.floor(Number(maxRedemptionsRaw)));

      const expiresAt = asIso(body?.expiresAt);
      const expiresUnix = toUnixSeconds(expiresAt);

      const changingMaxRedemptions = typeof body?.maxRedemptions !== 'undefined'
        && Number(existing.maxRedemptions ?? null) !== Number(maxRedemptions ?? null);
      const changingExpiresAt = typeof body?.expiresAt !== 'undefined'
        && String(existing.expiresAt ?? '') !== String(expiresAt ?? '');

      if (changingMaxRedemptions || changingExpiresAt) {
        return NextResponse.json(
          {
            error: 'Stripe does not allow updating max redemptions or expiry for existing promo codes. Create a new promo code instead.',
          },
          { status: 400 }
        );
      }

      const activeRequested = body?.active === true;
      const startsAt = typeof body?.startsAt === 'undefined' ? existing.startsAt : asIso(body?.startsAt);
      const startsMs = startsAt ? new Date(startsAt).getTime() : null;
      const hasStarts = typeof startsMs === 'number' && Number.isFinite(startsMs);
      const shouldBeActive = hasStarts ? Date.now() >= startsMs : true;
      const promoActive = activeRequested ? shouldBeActive : false;
      const autoEnableAtStart = body?.autoEnableAtStart === true && activeRequested && hasStarts && Date.now() < startsMs;

      const singleUsePerUser = body?.singleUsePerUser === true;
      const creatorSlug = String(body?.creatorSlug || '').trim().toLowerCase() || null;

      const promoParams: any = {
        active: promoActive,
      };

      await (stripe.promotionCodes as any).update(promoCodeId, promoParams);

      try {
        const couponParams: any = {
          name: name || undefined,
        };
        await (stripe.coupons as any).update(existing.couponId, couponParams);
      } catch {
      }

      rows[idx] = {
        ...existing,
        name,
        maxRedemptions,
        startsAt,
        expiresAt,
        active: promoActive,
        autoEnableAtStart,
        singleUsePerUser,
        creatorSlug,
        updatedAt: nowIso,
      };
      await saveStored(rows);

      return NextResponse.json({ success: true, promo: rows[idx] });
    }

    if (action === 'delete') {
      const promoCodeId = String(body?.promoCodeId || '').trim();
      if (!promoCodeId) {
        return NextResponse.json({ error: 'promoCodeId is required' }, { status: 400 });
      }

      const rows = await loadStored();
      const idx = rows.findIndex((r) => r.promoCodeId === promoCodeId);
      if (idx < 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const row = rows[idx];

      try {
        await (stripe.promotionCodes as any).del(promoCodeId);
      } catch {
        try {
          await (stripe.promotionCodes as any).update(promoCodeId, { active: false });
        } catch {
        }
      }

      try {
        await (stripe.coupons as any).del(row.couponId);
      } catch {
      }

      rows[idx] = {
        ...row,
        active: false,
        deletedAt: nowIso,
        updatedAt: nowIso,
      };
      await saveStored(rows);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Coupons admin error:', error);
    return NextResponse.json({ error: error?.message || 'Request failed' }, { status: 500 });
  }
}
