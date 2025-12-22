import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

// Consumable prices (in cents)
const CONSUMABLE_PRICES: Record<string, number> = {
  'price_tracker_slot': 299, // €2.99 per slot
  'wishlist_slot': 199, // €1.99 per slot
};

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in environment variables.' },
      { status: 500 }
    );
  }

  try {
    const { type, quantity, steamId } = await request.json();

    if (!type || !CONSUMABLE_PRICES[type]) {
      return NextResponse.json({ error: 'Invalid consumable type' }, { status: 400 });
    }

    if (!quantity || quantity < 1 || quantity > 100) {
      return NextResponse.json({ error: 'Invalid quantity. Must be between 1 and 100' }, { status: 400 });
    }

    // Require Steam sign-in - SteamID must be provided and valid
    if (!steamId || typeof steamId !== 'string' || !/^\d{17}$/.test(steamId)) {
      return NextResponse.json(
        { error: 'You must be signed in with Steam to purchase consumables. Please sign in and try again.' },
        { status: 401 }
      );
    }

    const unitPrice = CONSUMABLE_PRICES[type];
    const totalAmount = unitPrice * quantity;

    const consumableNames: Record<string, string> = {
      'price_tracker_slot': 'Price Tracker Slot',
      'wishlist_slot': 'Wishlist Slot',
    };

    const origin = request.headers.get('origin') || 'https://skinvaults.online';

    // Set expiration to 30 minutes from now
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 60);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${consumableNames[type]}${quantity > 1 ? ` (x${quantity})` : ''}`,
              description: `Add ${quantity} ${consumableNames[type]}${quantity > 1 ? 's' : ''} to your account. Slots are permanent and never expire.`,
            },
            unit_amount: unitPrice,
          },
          quantity: quantity,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&steamId=${steamId}&type=consumable&consumableType=${type}&quantity=${quantity}`,
      cancel_url: `${origin}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
      expires_at: expiresAt,
      metadata: {
        steamId,
        type: 'consumable',
        consumableType: type,
        quantity: quantity.toString(),
        unitPrice: unitPrice.toString(),
        totalAmount: totalAmount.toString(),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Consumable checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}

