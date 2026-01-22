import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sanitizeEmail } from '@/app/utils/sanitize';
import { isOwner } from '@/app/utils/owner-ids';
import { getOwnerFreeCouponId } from '@/app/utils/stripe-owner-discount';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { dbGet } from '@/app/utils/database';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

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

// Helper to get Stripe instance (checks for test mode)
async function getStripeInstance(): Promise<Stripe> {
  // Check if test mode is enabled
  let testMode = false;
  try {
    const { dbGet } = await import('@/app/utils/database');
    testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
  } catch (error) {
    // If database fails, use production keys
  }

  // Use test keys if test mode is enabled
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

const PRICES: Record<string, { amount: number; months: number }> = {
  '1month': { amount: 999, months: 1 }, // €9.99 in cents
  '3months': { amount: 2499, months: 3 }, // €24.99 in cents
  '6months': { amount: 4499, months: 6 }, // €44.99 in cents
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
    const { plan, steamId, promoCode, email } = await request.json();

    const customerEmail = sanitizeEmail(String(email || ''));
    if (!customerEmail) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!plan || !PRICES[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Require Steam sign-in - SteamID must be provided and valid
    if (!steamId || typeof steamId !== 'string' || !/^\d{17}$/.test(steamId)) {
      return NextResponse.json(
        { error: 'You must be signed in with Steam to purchase Pro. Please sign in and try again.' },
        { status: 401 }
      );
    }

    const priceInfo = PRICES[plan];
    let finalAmount = priceInfo.amount;
    let discountAmount = 0;

    // Apply promo code discount (20% off) - supports all theme promo codes
    const validPromoCodes = ['CHRISTMAS2025', 'HALLOWEEN2026', 'EASTER2026', 'SINTERKLAAS2026', 'NEWYEAR2026', 'OLDYEAR2025'];
    if (promoCode && validPromoCodes.includes(promoCode)) {
      discountAmount = Math.round(priceInfo.amount * 0.2); // 20% discount
      finalAmount = Math.max(0, priceInfo.amount - discountAmount);
    }

    const origin = request.headers.get('origin') || 'https://skinvaults.online';

    // Check if test mode is enabled
    let testMode = false;
    try {
      testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
    } catch (error) {
      // Ignore
    }

    const adminPromo = await resolveStoredPromo(promoCode, testMode);
    if (promoCode && String(promoCode).trim() && !adminPromo && !validPromoCodes.includes(String(promoCode).trim())) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
    }

    if (adminPromo?.singleUsePerUser === true) {
      if (!hasMongoConfig()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }
      const db = await getDatabase();
      const col = db.collection('promo_single_use');
      const key = `${steamId}_${adminPromo.promoCodeId}`;
      const existing = await col.findOne({ _id: key } as any);
      if (existing) {
        return NextResponse.json({ error: 'Promo code already used' }, { status: 400 });
      }
    }

    const sessionSteamId = getSteamIdFromRequest(request as any as NextRequest);
    const ownerDiscountEligible = isOwner(steamId) && sessionSteamId === steamId;
    let ownerDiscountApplied = false;
    let ownerCouponId: string | null = null;
    if (ownerDiscountEligible) {
      ownerCouponId = await getOwnerFreeCouponId(stripe, testMode);
      if (ownerCouponId) ownerDiscountApplied = true;
    }

    const promoDiscount = !ownerDiscountApplied && adminPromo?.promoCodeId
      ? [{ promotion_code: adminPromo.promoCodeId }]
      : undefined;

    // Set expiration to 30 minutes from now (minimum allowed by Stripe is 30 minutes)
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 60); // 30 minutes in seconds

    const productName = testMode 
      ? `[TEST] SkinVaults Pro - ${priceInfo.months} ${priceInfo.months === 1 ? 'Month' : 'Months'}`
      : `SkinVaults Pro - ${priceInfo.months} ${priceInfo.months === 1 ? 'Month' : 'Months'}`;
    
    const productDescription = testMode
      ? `[TEST MODE] Premium access to SkinVaults for ${priceInfo.months} ${priceInfo.months === 1 ? 'month' : 'months'}`
      : `Premium access to SkinVaults for ${priceInfo.months} ${priceInfo.months === 1 ? 'month' : 'months'}`;

    const session = await createCheckoutSessionWithPaymentMethods(stripe, {
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: finalAmount,
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
          type: 'pro',
          months: priceInfo.months.toString(),
          plan,
          promoCode: adminPromo?.code ? String(adminPromo.code) : (promoCode || ''),
          promoCodeId: adminPromo?.promoCodeId ? String(adminPromo.promoCodeId) : '',
          couponId: adminPromo?.couponId ? String(adminPromo.couponId) : '',
          originalAmount: priceInfo.amount.toString(),
          discountAmount: ownerDiscountApplied ? priceInfo.amount.toString() : discountAmount.toString(),
          ownerDiscount: ownerDiscountApplied ? 'true' : 'false',
          testMode: testMode ? 'true' : 'false',
        },
      },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&steamId=${steamId}&type=pro&months=${priceInfo.months}`,
      cancel_url: `${origin}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
      expires_at: expiresAt,
      metadata: {
        steamId,
        type: 'pro',
        months: priceInfo.months.toString(),
        plan,
        promoCode: adminPromo?.code ? String(adminPromo.code) : (promoCode || ''),
        promoCodeId: adminPromo?.promoCodeId ? String(adminPromo.promoCodeId) : '',
        couponId: adminPromo?.couponId ? String(adminPromo.couponId) : '',
        originalAmount: priceInfo.amount.toString(),
        discountAmount: ownerDiscountApplied ? priceInfo.amount.toString() : discountAmount.toString(),
        ownerDiscount: ownerDiscountApplied ? 'true' : 'false',
        testMode: testMode ? 'true' : 'false',
      },
    }, Array.from(PAYMENT_METHOD_TYPES as any));

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
