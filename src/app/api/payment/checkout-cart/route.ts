import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sanitizeEmail } from '@/app/utils/sanitize';
import { isOwner } from '@/app/utils/owner-ids';
import { getOwnerFreeCouponId } from '@/app/utils/stripe-owner-discount';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { dbGet, dbSet } from '@/app/utils/database';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';
import { upsertCartTrackingMessage } from '@/app/utils/discord-webhook';

async function getStripeInstance(): Promise<Stripe> {
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

  return new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
  });
}

type StoredPromo = {
  promoCodeId: string;
  couponId: string;
  code: string;
  testMode: boolean;
  deletedAt: string | null;
  singleUsePerUser?: boolean;
};

async function resolveStoredPromo(codeRaw: unknown, testMode: boolean): Promise<StoredPromo | null> {
  const code = String(codeRaw || '').trim();
  if (!code) return null;
  const rows = (await dbGet<StoredPromo[]>('admin_stripe_coupons', false)) || [];
  const list = Array.isArray(rows) ? rows : [];
  const found = list.find((r) => {
    if (!r || (r as any)?.deletedAt) return false;
    if ((r as any)?.testMode !== testMode) return false;
    return String((r as any)?.code || '').trim().toLowerCase() === code.toLowerCase();
  }) as any;
  return found || null;
}

const PRO_PLANS: Record<string, { amount: number; months: number; label: string }> = {
  '1month': { amount: 999, months: 1, label: '1 Month' },
  '3months': { amount: 2499, months: 3, label: '3 Months' },
  '6months': { amount: 4499, months: 6, label: '6 Months' },
};

const CREDIT_PACKS: Record<string, { credits: number; amount: number; label: string }> = {
  starter: { credits: 500, amount: 199, label: 'Starter Pack' },
  value: { credits: 1500, amount: 499, label: 'Value Pack' },
  mega: { credits: 4000, amount: 999, label: 'Mega Pack' },
  giant: { credits: 10000, amount: 1999, label: 'Giant Pack' },
  whale: { credits: 30000, amount: 4999, label: 'Whale Pack' },
  titan: { credits: 50000, amount: 7499, label: 'Titan Pack' },
  legend: { credits: 75000, amount: 9999, label: 'Legend Pack' },
};

const SPIN_PACKS: Record<string, { spins: number; amount: number; label: string }> = {
  starter: { spins: 5, amount: 199, label: 'Starter Pack' },
  value: { spins: 15, amount: 499, label: 'Value Pack' },
  mega: { spins: 40, amount: 999, label: 'Mega Pack' },
  giant: { spins: 100, amount: 1999, label: 'Giant Pack' },
  whale: { spins: 300, amount: 4999, label: 'Whale Pack' },
  titan: { spins: 500, amount: 7499, label: 'Titan Pack' },
  legend: { spins: 750, amount: 9999, label: 'Legend Pack' },
};

const CONSUMABLES: Record<string, { amount: number; label: string }> = {
  price_tracker_slot: { label: 'Price Tracker Slot', amount: 299 },
  wishlist_slot: { label: 'Wishlist Slot', amount: 199 },
  discord_access: { label: 'Discord Access', amount: 499 },
  price_scan_boost: { label: 'Price Scan Boost', amount: 249 },
  cache_boost: { label: 'Price Cache Boost', amount: 199 },
};

const PAYMENT_METHOD_TYPES = [
  'card',
  'link',
  'paypal',
  'klarna',
  'ideal',
  'bancontact',
  'sofort',
  'giropay',
  'eps',
  'p24',
] as const;

function parseInvalidPaymentMethodType(err: any): string | null {
  const msg = String(err?.message || '').toLowerCase();
  const m = msg.match(/payment method type provided:\s*([a-z0-9_]+)/i);
  if (m?.[1]) return String(m[1]).toLowerCase();
  return null;
}

async function createCheckoutSessionWithPaymentMethods(
  stripe: Stripe,
  params: any,
  paymentMethodTypes: string[]
) {
  let remaining = Array.from(new Set((paymentMethodTypes || []).map((t) => String(t).toLowerCase())));
  if (remaining.length === 0) remaining = ['card'];

  for (let i = 0; i < paymentMethodTypes.length + 1; i += 1) {
    try {
      return await stripe.checkout.sessions.create(
        {
          ...params,
          payment_method_types: remaining,
        } as any
      );
    } catch (e: any) {
      const bad = parseInvalidPaymentMethodType(e);
      if (!bad) throw e;
      const next = remaining.filter((t) => t !== bad);
      if (next.length === remaining.length) throw e;
      remaining = next;
      if (remaining.length === 0) throw e;
    }
  }

  return await stripe.checkout.sessions.create(
    {
      ...params,
      payment_method_types: ['card'],
    } as any
  );
}

function safeQty(raw: any, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function randomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const stripe = await getStripeInstance();
    const body = await request.json().catch(() => null);

    const steamId = String(body?.steamId || '').trim();
    const customerEmail = sanitizeEmail(String(body?.email || ''));
    const promoCodeRaw = String(body?.promoCode || '').trim();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!customerEmail) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!steamId || !/^\d{17}$/.test(steamId)) {
      return NextResponse.json(
        { error: 'You must be signed in with Steam to purchase. Please sign in and try again.' },
        { status: 401 }
      );
    }

    if (items.length < 1) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // If cart contains credits, enforce credits restriction checks.
    if (items.some((it: any) => String(it?.kind || '').trim() === 'credits')) {
      const restriction = await getCreditsRestrictionStatus(steamId);
      if (restriction.banned) {
        return NextResponse.json({ error: 'Credits access is banned for this user' }, { status: 403 });
      }
      if (restriction.timeoutActive) {
        return NextResponse.json(
          { error: 'Credits access is temporarily restricted for this user', timeoutUntil: restriction.timeoutUntil },
          { status: 403 }
        );
      }
    }

    let testMode = false;
    try {
      testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
    } catch {
    }

    const promo = await resolveStoredPromo(promoCodeRaw, testMode);
    if (promoCodeRaw && !promo) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
    }

    if (promo?.singleUsePerUser === true) {
      if (!hasMongoConfig()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }
      const db = await getDatabase();
      const col = db.collection('promo_single_use');
      const key = `${steamId}_${promo.promoCodeId}`;
      const existing = await col.findOne({ _id: key } as any);
      if (existing) {
        return NextResponse.json({ error: 'Promo code already used' }, { status: 400 });
      }
    }

    const sessionSteamId = getSteamIdFromRequest(request);
    const owner = isOwner(steamId) && sessionSteamId === steamId;
    let ownerDiscountApplied = false;
    let ownerCouponId: string | null = null;
    if (owner) {
      ownerCouponId = await getOwnerFreeCouponId(stripe, testMode);
      if (ownerCouponId) ownerDiscountApplied = true;
    }

    const promoDiscount = !ownerDiscountApplied && promo?.promoCodeId
      ? [{ promotion_code: promo.promoCodeId }]
      : undefined;

    const cartIdRaw = String(body?.cartId || '').trim();
    const cartId = /^[a-zA-Z0-9_-]{6,80}$/.test(cartIdRaw) ? cartIdRaw : randomId();

    const line_items: any[] = [];
    let totalMinor = 0;

    for (const it of items) {
      const kind = String(it?.kind || '').trim();
      if (kind === 'pro') {
        const plan = String(it?.plan || '').trim();
        const info = PRO_PLANS[plan];
        if (!info) continue;
        totalMinor += info.amount;
        line_items.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: testMode ? `[TEST] SkinVaults Pro - ${info.label}` : `SkinVaults Pro - ${info.label}`,
              description: testMode
                ? `[TEST MODE] Premium access to SkinVaults for ${info.months} month${info.months === 1 ? '' : 's'}`
                : `Premium access to SkinVaults for ${info.months} month${info.months === 1 ? '' : 's'}`,
            },
            unit_amount: info.amount,
          },
          quantity: 1,
        });
        continue;
      }

      if (kind === 'credits') {
        const pack = String(it?.pack || '').trim();
        const info = CREDIT_PACKS[pack];
        if (!info) continue;
        const qty = safeQty(it?.quantity, 1, 99);
        totalMinor += info.amount * qty;
        line_items.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: testMode ? `[TEST] Credits - ${info.label}` : `Credits - ${info.label}`,
              description: testMode
                ? `[TEST MODE] Add ${info.credits} credits to your SkinVaults account.`
                : `Add ${info.credits} credits to your SkinVaults account.`,
            },
            unit_amount: info.amount,
          },
          quantity: qty,
        });
        continue;
      }

      if (kind === 'spins') {
        const pack = String(it?.pack || '').trim();
        const info = SPIN_PACKS[pack];
        if (!info) continue;
        const qty = safeQty(it?.quantity, 1, 99);
        totalMinor += info.amount * qty;
        line_items.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: testMode ? `[TEST] Spins - ${info.label}` : `Spins - ${info.label}`,
              description: testMode
                ? `[TEST MODE] Add ${info.spins} bonus spins to your SkinVaults account.`
                : `Add ${info.spins} bonus spins to your SkinVaults account.`,
            },
            unit_amount: info.amount,
          },
          quantity: qty,
        });
        continue;
      }

      if (kind === 'consumable') {
        const consumableType = String(it?.consumableType || '').trim();
        const info = CONSUMABLES[consumableType];
        if (!info) continue;
        const qty = safeQty(it?.quantity, 1, 100);
        totalMinor += info.amount * qty;
        line_items.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: testMode ? `[TEST] ${info.label}` : info.label,
              description: testMode
                ? `[TEST MODE] ${info.label}. Permanent and never expires.`
                : `${info.label}. Permanent and never expires.`,
            },
            unit_amount: info.amount,
          },
          quantity: qty,
        });
        continue;
      }
    }

    if (line_items.length < 1) {
      return NextResponse.json({ error: 'No valid items in cart' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || 'https://skinvaults.online';
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

    await dbSet(`pending_cart_${cartId}`, {
      cartId,
      steamId,
      items,
      promoCode: promo?.code ? String(promo.code) : (promoCodeRaw || ''),
      promoCodeId: promo?.promoCodeId ? String(promo.promoCodeId) : '',
      couponId: promo?.couponId ? String(promo.couponId) : '',
      testMode,
      createdAt: new Date().toISOString(),
    });

    try {
      await upsertCartTrackingMessage({
        cartId,
        steamId,
        items,
        status: 'checkout_started',
        amount: totalMinor / 100,
        currency: 'eur',
      } as any);
    } catch {
    }

    const session = await createCheckoutSessionWithPaymentMethods(stripe, {
      line_items,
      mode: 'payment',
      customer_creation: 'always',
      customer_email: customerEmail,
      invoice_creation: { enabled: true },
      allow_promotion_codes: undefined,
      discounts: ownerDiscountApplied && ownerCouponId
        ? [{ coupon: ownerCouponId }]
        : promoDiscount,
      payment_intent_data: {
        receipt_email: customerEmail,
        metadata: {
          steamId,
          type: 'cart',
          cartId,
          promoCode: promo?.code ? String(promo.code) : '',
          promoCodeId: promo?.promoCodeId ? String(promo.promoCodeId) : '',
          couponId: promo?.couponId ? String(promo.couponId) : '',
          ownerDiscount: ownerDiscountApplied ? 'true' : 'false',
          testMode: testMode ? 'true' : 'false',
        },
      },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&steamId=${steamId}&type=cart&cartId=${encodeURIComponent(cartId)}`,
      cancel_url: `${origin}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
      expires_at: expiresAt,
      metadata: {
        steamId,
        type: 'cart',
        cartId,
        promoCode: promo?.code ? String(promo.code) : '',
        promoCodeId: promo?.promoCodeId ? String(promo.promoCodeId) : '',
        couponId: promo?.couponId ? String(promo.couponId) : '',
        testMode: testMode ? 'true' : 'false',
      },
    }, Array.from(PAYMENT_METHOD_TYPES as any));

    return NextResponse.json({ sessionId: session.id, url: session.url, cartId });
  } catch (error: any) {
    console.error('Cart checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
