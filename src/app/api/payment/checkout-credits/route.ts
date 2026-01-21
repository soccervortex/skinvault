import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';
import { sanitizeEmail } from '@/app/utils/sanitize';
import { isOwner } from '@/app/utils/owner-ids';
import { getOwnerFreeCouponId } from '@/app/utils/stripe-owner-discount';
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
};

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
      const { kv } = await import('@vercel/kv');
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        testMode = (await kv.get<boolean>('stripe_test_mode')) === true;
      }
    } catch (error) {
      // Ignore
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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
      payment_method_collection: 'if_required',
      customer_creation: 'always',
      customer_email: customerEmail,
      invoice_creation: { enabled: true },
      allow_promotion_codes: true,
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
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Credits checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
