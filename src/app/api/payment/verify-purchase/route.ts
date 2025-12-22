import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Helper to get Stripe instance (checks for test mode)
async function getStripeInstance(): Promise<Stripe> {
  let testMode = false;
  try {
    const { kv } = await import('@vercel/kv');
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      testMode = (await kv.get<boolean>('stripe_test_mode')) === true;
    }
  } catch (error) {
    // If KV fails, use production keys
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

// Verify and fulfill a purchase if it wasn't already fulfilled
export async function POST(request: Request) {
  try {
    const { sessionId, steamId } = await request.json();

    if (!sessionId || !steamId) {
      return NextResponse.json({ error: 'Missing sessionId or steamId' }, { status: 400 });
    }

    const stripe = await getStripeInstance();
    
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ 
        error: 'Payment not completed',
        paymentStatus: session.payment_status 
      }, { status: 400 });
    }

    // Verify Steam ID matches
    if (session.metadata?.steamId !== steamId) {
      return NextResponse.json({ 
        error: 'Steam ID mismatch',
        expected: session.metadata?.steamId,
        provided: steamId
      }, { status: 403 });
    }

    const { kv } = await import('@vercel/kv');
    const purchasesKey = 'purchase_history';
    const existingPurchases = await kv.get<Array<any>>(purchasesKey) || [];
    
    // Check if this purchase was already fulfilled
    const alreadyFulfilled = existingPurchases.some(p => p.sessionId === sessionId);
    
    if (alreadyFulfilled) {
      return NextResponse.json({ 
        fulfilled: true,
        message: 'Purchase already fulfilled',
        sessionId 
      });
    }

    // Fulfill the purchase
    const months = Number(session.metadata?.months || 0);
    const type = session.metadata?.type;

    // Handle Pro subscription
    if (months > 0 && type !== 'consumable') {
      const { grantPro } = await import('@/app/utils/pro-storage');
      const proUntil = await grantPro(steamId, months);
      
      // Record purchase
      existingPurchases.push({
        steamId,
        type: 'pro',
        months,
        amount: session.amount_total ? (session.amount_total / 100) : 0,
        currency: session.currency || 'eur',
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        proUntil,
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'manual_verification',
      });
      
      await kv.set(purchasesKey, existingPurchases.slice(-1000));
      
      return NextResponse.json({ 
        fulfilled: true,
        type: 'pro',
        months,
        proUntil,
        message: `Granted ${months} months Pro to ${steamId}`
      });
    }

    // Handle consumables
    if (type === 'consumable') {
      const consumableType = session.metadata?.consumableType;
      const quantity = Number(session.metadata?.quantity || 0);

      if (consumableType && quantity > 0) {
        const rewardsKey = 'user_rewards';
        const existingRewards = await kv.get<Record<string, any[]>>(rewardsKey) || {};
        const userRewards = existingRewards[steamId] || [];

        // Add consumable rewards
        for (let i = 0; i < quantity; i++) {
          userRewards.push({
            type: consumableType,
            grantedAt: new Date().toISOString(),
            source: 'purchase',
            sessionId,
          });
        }

        existingRewards[steamId] = userRewards;
        await kv.set(rewardsKey, existingRewards);

        // Record purchase
        existingPurchases.push({
          steamId,
          type: 'consumable',
          consumableType,
          quantity,
          amount: session.amount_total ? (session.amount_total / 100) : 0,
          currency: session.currency || 'eur',
          sessionId: session.id,
          timestamp: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          verifiedBy: 'manual_verification',
        });
        
        await kv.set(purchasesKey, existingPurchases.slice(-1000));

        return NextResponse.json({ 
          fulfilled: true,
          type: 'consumable',
          consumableType,
          quantity,
          message: `Granted ${quantity} ${consumableType} to ${steamId}`
        });
      }
    }

    return NextResponse.json({ 
      error: 'Unknown purchase type',
      metadata: session.metadata 
    }, { status: 400 });

  } catch (error: any) {
    console.error('Purchase verification error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to verify purchase' 
    }, { status: 500 });
  }
}

// GET: Check if a purchase was fulfilled
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id') || url.searchParams.get('sessionId');
    const steamId = url.searchParams.get('steamId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id or sessionId' }, { status: 400 });
    }

    const { kv } = await import('@vercel/kv');
    const purchasesKey = 'purchase_history';
    const purchases = await kv.get<Array<any>>(purchasesKey) || [];
    
    const purchase = purchases.find(p => p.sessionId === sessionId);
    
    if (!purchase) {
      return NextResponse.json({ 
        fulfilled: false,
        message: 'Purchase not found in history'
      });
    }

    // Verify Steam ID if provided
    if (steamId && purchase.steamId !== steamId) {
      return NextResponse.json({ 
        fulfilled: false,
        error: 'Steam ID mismatch'
      }, { status: 403 });
    }

    return NextResponse.json({ 
      fulfilled: true,
      purchase: {
        type: purchase.type,
        steamId: purchase.steamId,
        timestamp: purchase.timestamp,
        amount: purchase.amount,
        currency: purchase.currency,
        ...(purchase.type === 'pro' && { months: purchase.months, proUntil: purchase.proUntil }),
        ...(purchase.type === 'consumable' && { consumableType: purchase.consumableType, quantity: purchase.quantity }),
      }
    });

  } catch (error: any) {
    console.error('Purchase check error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to check purchase' 
    }, { status: 500 });
  }
}

