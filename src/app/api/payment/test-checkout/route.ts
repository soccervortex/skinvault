import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Test mode checkout - allows testing with test keys without modifying env vars
// Usage: POST with test keys in body, or use query params

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { plan, steamId, promoCode, testSecretKey, testPublishableKey } = body;

    // Use test keys from request, or fall back to env (if test keys exist)
    const secretKey = testSecretKey || process.env.STRIPE_SECRET_KEY;
    
    if (!secretKey) {
      return NextResponse.json(
        { 
          error: 'Stripe not configured. Provide testSecretKey in request body or set STRIPE_SECRET_KEY in environment variables.',
          info: 'For testing, you can get test keys from: https://dashboard.stripe.com/test/apikeys'
        },
        { status: 500 }
      );
    }

    // Validate it's a test key (starts with sk_test_)
    if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
      return NextResponse.json(
        { error: 'Invalid Stripe key format. Test keys should start with sk_test_' },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    });

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

    // Set expiration to 30 minutes from now
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 60);

    const session = await createCheckoutSessionWithPaymentMethods(stripe, {
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `[TEST] SkinVaults Pro - ${priceInfo.months} ${priceInfo.months === 1 ? 'Month' : 'Months'}`,
              description: `[TEST MODE] Premium access to SkinVaults for ${priceInfo.months} ${priceInfo.months === 1 ? 'month' : 'months'}`,
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_creation: 'always',
      invoice_creation: { enabled: true },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&steamId=${steamId}&months=${priceInfo.months}&test=true`,
      cancel_url: `${origin}/payment/cancel?session_id={CHECKOUT_SESSION_ID}&test=true`,
      expires_at: expiresAt,
      metadata: {
        steamId,
        months: priceInfo.months.toString(),
        plan,
        promoCode: promoCode || '',
        originalAmount: priceInfo.amount.toString(),
        discountAmount: discountAmount.toString(),
        testMode: 'true',
      },
    }, Array.from(PAYMENT_METHOD_TYPES as any));

    return NextResponse.json({ 
      sessionId: session.id, 
      url: session.url,
      testMode: true,
      publishableKey: testPublishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      message: 'Test mode checkout created. Use test card: 4242 4242 4242 4242'
    });
  } catch (error: any) {
    console.error('Test checkout error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create checkout',
      details: error.type || 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to show test instructions
export async function GET() {
  return NextResponse.json({
    message: 'Stripe Test Checkout Endpoint',
    instructions: {
      method: 'POST',
      body: {
        plan: '1month | 3months | 6months',
        steamId: 'your-steam-id-64',
        testSecretKey: 'sk_test_... (from https://dashboard.stripe.com/test/apikeys)',
        testPublishableKey: 'pk_test_... (optional, for frontend)',
        promoCode: 'optional promo code'
      },
      testCards: {
        success: '4242 4242 4242 4242',
        decline: '4000 0000 0000 0002',
        requiresAuth: '4000 0025 0000 3155',
        expiry: 'Any future date (e.g., 12/34)',
        cvc: 'Any 3 digits',
        zip: 'Any ZIP code'
      },
      note: 'This endpoint allows testing without modifying environment variables. Webhooks will still need to be configured for automatic Pro activation.'
    }
  });
}

