import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sanitizeEmail } from '@/app/utils/sanitize';
import { isOwner } from '@/app/utils/owner-ids';
import { getOwnerFreeCouponId } from '@/app/utils/stripe-owner-discount';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

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

const SPIN_PACKS: Record<string, SpinPack> = {
  starter: { spins: 5, amount: 199, label: 'Starter Pack' },
  value: { spins: 15, amount: 499, label: 'Value Pack' },
  mega: { spins: 40, amount: 999, label: 'Mega Pack' },
  giant: { spins: 100, amount: 1999, label: 'Giant Pack' },
  whale: { spins: 300, amount: 4999, label: 'Whale Pack' },
};

export async function POST(request: NextRequest) {
  try {
    const stripe = await getStripeInstance();
    const { pack, steamId, email } = await request.json();

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
      const { kv } = await import('@vercel/kv');
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        testMode = (await kv.get<boolean>('stripe_test_mode')) === true;
      }
    } catch {
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
      customer_creation: 'always',
      customer_email: customerEmail,
      invoice_creation: { enabled: true },
      allow_promotion_codes: ownerDiscountApplied ? undefined : true,
      discounts: ownerDiscountApplied && ownerCouponId ? [{ coupon: ownerCouponId }] : undefined,
      payment_intent_data: {
        receipt_email: customerEmail,
        metadata: {
          steamId,
          type: 'spins',
          pack: packId,
          spins: info.spins.toString(),
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
        testMode: testMode ? 'true' : 'false',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Spins checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
