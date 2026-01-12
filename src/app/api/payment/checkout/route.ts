import { NextResponse } from 'next/server';
import Stripe from 'stripe';

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

export async function POST(request: Request) {
  try {
    const stripe = await getStripeInstance();
    const { plan, steamId, promoCode } = await request.json();

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
      const { kv } = await import('@vercel/kv');
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        testMode = (await kv.get<boolean>('stripe_test_mode')) === true;
      }
    } catch (error) {
      // Ignore
    }

    // Set expiration to 30 minutes from now (minimum allowed by Stripe is 30 minutes)
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 60); // 30 minutes in seconds

    const productName = testMode 
      ? `[TEST] SkinVaults Pro - ${priceInfo.months} ${priceInfo.months === 1 ? 'Month' : 'Months'}`
      : `SkinVaults Pro - ${priceInfo.months} ${priceInfo.months === 1 ? 'Month' : 'Months'}`;
    
    const productDescription = testMode
      ? `[TEST MODE] Premium access to SkinVaults for ${priceInfo.months} ${priceInfo.months === 1 ? 'month' : 'months'}`
      : `Premium access to SkinVaults for ${priceInfo.months} ${priceInfo.months === 1 ? 'month' : 'months'}`;

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
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&steamId=${steamId}&months=${priceInfo.months}`,
      cancel_url: `${origin}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
      expires_at: expiresAt,
      metadata: {
        steamId,
        months: priceInfo.months.toString(),
        plan,
        promoCode: promoCode || '',
        originalAmount: priceInfo.amount.toString(),
        discountAmount: discountAmount.toString(),
        testMode: testMode ? 'true' : 'false',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
