import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Helper to get Stripe instance (checks for test mode)
async function getStripeInstance(): Promise<Stripe> {
  // Check if test mode is enabled
  let testMode = false;
  try {
    const { kv } = await import('@vercel/kv');
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      testMode = (await kv.get<boolean>('stripe_test_mode')) === true;
    }
  } catch (error) {
    // If KV fails, use production keys
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

// Consumable prices (in cents)
const CONSUMABLE_PRICES: Record<string, number> = {
  'price_tracker_slot': 299, // €2.99 per slot (Pro only - not available for free users)
  'wishlist_slot': 199, // €1.99 per slot
  'inventory_export_boost': 149, // €1.49 - Export inventory data more times
  'price_scan_boost': 249, // €2.49 - Increase concurrent price scans for free users
  'cache_boost': 199, // €1.99 - Longer price cache duration for free users
};

export async function POST(request: Request) {
  try {
    const stripe = await getStripeInstance();
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
      'inventory_export_boost': 'Inventory Export Boost',
      'price_scan_boost': 'Price Scan Boost',
      'cache_boost': 'Price Cache Boost',
    };

    const consumableDescriptions: Record<string, string> = {
      'price_tracker_slot': 'Add extra price alerts (Pro feature)',
      'wishlist_slot': 'Add one additional item to your wishlist',
      'inventory_export_boost': 'Export your inventory data 10 more times',
      'price_scan_boost': 'Increase concurrent price scans from 3 to 5',
      'cache_boost': 'Extend price cache duration from 30min to 1 hour',
    };

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
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 60);

    const productName = testMode
      ? `[TEST] ${consumableNames[type]}${quantity > 1 ? ` (x${quantity})` : ''}`
      : `${consumableNames[type]}${quantity > 1 ? ` (x${quantity})` : ''}`;
    
    const productDescription = testMode
      ? `[TEST MODE] ${consumableDescriptions[type] || `Add ${quantity} ${consumableNames[type]}${quantity > 1 ? 's' : ''} to your account`}. Permanent and never expires.`
      : `${consumableDescriptions[type] || `Add ${quantity} ${consumableNames[type]}${quantity > 1 ? 's' : ''} to your account`}. Permanent and never expires.`;

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
        testMode: testMode ? 'true' : 'false',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Consumable checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}

