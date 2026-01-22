import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';
import { sanitizeEmail } from '@/app/utils/sanitize';
import { isOwner } from '@/app/utils/owner-ids';
import { getOwnerFreeCouponId } from '@/app/utils/stripe-owner-discount';
import { dbGet } from '@/app/utils/database';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

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

type CreditPack = {
  credits: number;
  amount: number; // in cents
  label: string;
};

const CREDIT_PACKS: Record<string, CreditPack> = {
  starter: { credits: 500, amount: 199, label: 'Starter Pack' },
  value: { credits: 1500, amount: 499, label: 'Value Pack' },
  mega: { credits: 4000, amount: 999, label: 'Mega Pack' },
  giant: { credits: 10000, amount: 1999, label: 'Giant Pack' },
  whale: { credits: 30000, amount: 4999, label: 'Whale Pack' },
  titan: { credits: 50000, amount: 7499, label: 'Titan Pack' },
  legend: { credits: 75000, amount: 9999, label: 'Legend Pack' },
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
    const { pack, steamId, email } = await request.json();

    const customerEmail = sanitizeEmail(String(email || ''));
    if (!customerEmail) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!pack || !CREDIT_PACKS[String(pack)]) {
      return NextResponse.json({ error: 'Invalid credit pack' }, { status: 400 });
    }

    // Require Steam sign-in - SteamID must be provided and valid
    if (!steamId || typeof steamId !== 'string' || !/^\d{17}$/.test(steamId)) {
      return NextResponse.json(
        { error: 'You must be signed in with Steam to purchase credits. Please sign in and try again.' },
        { status: 401 }
      );
    }

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

    const packId = String(pack);
    const info = CREDIT_PACKS[packId];

    const origin = request.headers.get('origin') || 'https://skinvaults.online';

    // Check if test mode is enabled
    let testMode = false;
    try {
      testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
    } catch {
    }

    // Set expiration to 30 minutes from now
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

    const productName = testMode ? `[TEST] Credits - ${info.label}` : `Credits - ${info.label}`;
    const productDescription = testMode
      ? `[TEST MODE] Add ${info.credits} credits to your SkinVaults account.`
      : `Add ${info.credits} credits to your SkinVaults account.`;

    const sessionSteamId = getSteamIdFromRequest(request);
    const owner = isOwner(steamId) && sessionSteamId === steamId;
    let ownerDiscountApplied = false;
    let ownerCouponId: string | null = null;
    if (owner) {
      ownerCouponId = await getOwnerFreeCouponId(stripe, testMode);
      if (ownerCouponId) ownerDiscountApplied = true;
    }

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
      allow_promotion_codes: ownerDiscountApplied ? undefined : true,
      discounts: ownerDiscountApplied && ownerCouponId ? [{ coupon: ownerCouponId }] : undefined,
      payment_intent_data: {
        receipt_email: customerEmail,
        metadata: {
          steamId,
          type: 'credits',
          pack: packId,
          credits: info.credits.toString(),
          ownerDiscount: ownerDiscountApplied ? 'true' : 'false',
          testMode: testMode ? 'true' : 'false',
        },
      },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&steamId=${steamId}&type=credits&pack=${encodeURIComponent(packId)}&credits=${info.credits}`,
      cancel_url: `${origin}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
      expires_at: expiresAt,
      metadata: {
        steamId,
        type: 'credits',
        pack: packId,
        credits: info.credits.toString(),
        testMode: testMode ? 'true' : 'false',
      },
    }, Array.from(PAYMENT_METHOD_TYPES as any));

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Credits checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
