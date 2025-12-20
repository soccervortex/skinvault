import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

const PRICES: Record<string, { amount: number; months: number }> = {
  '1month': { amount: 999, months: 1 }, // €9.99 in cents
  '3months': { amount: 2499, months: 3 }, // €24.99 in cents
  '6months': { amount: 4499, months: 6 }, // €44.99 in cents
};

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in environment variables.' },
      { status: 500 }
    );
  }

  try {
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

    // Apply promo code discount (20% off - same as €2 on €10 = 20%)
    if (promoCode === 'CHRISTMAS2024') {
      discountAmount = Math.round(priceInfo.amount * 0.2); // 20% discount
      finalAmount = Math.max(0, priceInfo.amount - discountAmount);
    }

    const origin = request.headers.get('origin') || 'https://skinvaults.vercel.app';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `SkinVault Pro - ${priceInfo.months} ${priceInfo.months === 1 ? 'Month' : 'Months'}`,
              description: `Premium access to SkinVault for ${priceInfo.months} ${priceInfo.months === 1 ? 'month' : 'months'}`,
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&steamId=${steamId}&months=${priceInfo.months}`,
      cancel_url: `${origin}/payment/cancel`,
      metadata: {
        steamId,
        months: priceInfo.months.toString(),
        plan,
        promoCode: promoCode || '',
        originalAmount: priceInfo.amount.toString(),
        discountAmount: discountAmount.toString(),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
