import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sanitizeEmail } from '@/app/utils/sanitize';
import { isOwner } from '@/app/utils/owner-ids';
import { getOwnerFreeCouponId } from '@/app/utils/stripe-owner-discount';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { dbGet } from '@/app/utils/database';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

async function getStripeInstance(): Promise<Stripe> {
  let testMode = false;
  try {
    const { dbGet } = await import('@/app/utils/database');
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

type SpinPack = {
  spins: number;
  amount: number;
  label: string;
};

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

const SPIN_PACKS: Record<string, SpinPack> = {
  starter: { spins: 5, amount: 199, label: 'Starter Pack' },
  value: { spins: 15, amount: 499, label: 'Value Pack' },
  mega: { spins: 40, amount: 999, label: 'Mega Pack' },
  giant: { spins: 100, amount: 1999, label: 'Giant Pack' },
  whale: { spins: 300, amount: 4999, label: 'Whale Pack' },
  titan: { spins: 500, amount: 7499, label: 'Titan Pack' },
  legend: { spins: 750, amount: 9999, label: 'Legend Pack' },
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

export async function POST(request: NextRequest) {
  try {
    const stripe = await getStripeInstance();
    const { pack, steamId, email, promoCode } = await request.json();

    const customerEmail = sanitizeEmail(String(email || ''));
    if (!customerEmail) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!pack || !SPIN_PACKS[String(pack)]) {
      return NextResponse.json({ error: 'Invalid spins pack' }, { status: 400 });
    }

    if (!steamId || typeof steamId !== 'string' || !/^\d{17}$/.test(steamId)) {
      return NextResponse.json(
        { error: 'You must be signed in with Steam to purchase spins. Please sign in and try again.' },
        { status: 401 }
      );
    }

    const packId = String(pack);
    const info = SPIN_PACKS[packId];

    const origin = request.headers.get('origin') || 'https://skinvaults.online';

    let testMode = false;
    try {
      testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
    } catch {
    }

    const promo = await resolveStoredPromo(promoCode, testMode);
    if (promoCode && String(promoCode).trim() && !promo) {
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

    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

    const productName = testMode ? `[TEST] Spins - ${info.label}` : `Spins - ${info.label}`;
    const productDescription = testMode
      ? `[TEST MODE] Add ${info.spins} bonus spins to your SkinVaults account.`
      : `Add ${info.spins} bonus spins to your SkinVaults account.`;

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

    const session = await createCheckoutSessionWithPaymentMethods(stripe, {
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: info.amount,
          },
          quantity: 1,
        },
      ],
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
          type: 'spins',
          pack: packId,
          spins: info.spins.toString(),
          promoCode: promo?.code ? String(promo.code) : '',
          promoCodeId: promo?.promoCodeId ? String(promo.promoCodeId) : '',
          couponId: promo?.couponId ? String(promo.couponId) : '',
          ownerDiscount: ownerDiscountApplied ? 'true' : 'false',
          testMode: testMode ? 'true' : 'false',
        },
      },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&steamId=${steamId}&type=spins&pack=${encodeURIComponent(packId)}&spins=${info.spins}`,
      cancel_url: `${origin}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
      expires_at: expiresAt,
      metadata: {
        steamId,
        type: 'spins',
        pack: packId,
        spins: info.spins.toString(),
        promoCode: promo?.code ? String(promo.code) : '',
        promoCodeId: promo?.promoCodeId ? String(promo.promoCodeId) : '',
        couponId: promo?.couponId ? String(promo.couponId) : '',
        testMode: testMode ? 'true' : 'false',
      },
    }, Array.from(PAYMENT_METHOD_TYPES as any));

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Spins checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
