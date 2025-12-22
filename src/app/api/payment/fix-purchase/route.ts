import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Stripe from 'stripe';

// Helper to get Stripe instance (checks for test mode)
async function getStripeInstance(): Promise<Stripe> {
  let testMode = false;
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      testMode = (await kv.get<boolean>('stripe_test_mode')) === true;
    }
  } catch (error) { /* ignore */ }

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

// POST: Manually fulfill a purchase that wasn't fulfilled
export async function POST(request: Request) {
  try {
    const { sessionId, steamId } = await request.json();

    if (!sessionId || !steamId) {
      return NextResponse.json({ error: 'Missing sessionId or steamId' }, { status: 400 });
    }

    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ 
        error: 'Payment not completed',
        paymentStatus: session.payment_status 
      }, { status: 400 });
    }

    if (session.metadata?.steamId !== steamId) {
      return NextResponse.json({ 
        error: 'Steam ID mismatch',
        expected: session.metadata?.steamId,
        provided: steamId
      }, { status: 403 });
    }

    const purchasesKey = 'purchase_history';
    const existingPurchases = await kv.get<Array<any>>(purchasesKey) || [];
    const purchase = existingPurchases.find(p => p.sessionId === sessionId);

    if (purchase && purchase.fulfilled) {
      return NextResponse.json({ 
        message: 'Purchase already fulfilled',
        purchase 
      });
    }

    const type = session.metadata?.type;
    const consumableType = session.metadata?.consumableType;
    const quantity = Number(session.metadata?.quantity || 0);

    // Handle consumables
    if (type === 'consumable' && consumableType && quantity > 0) {
      const rewardsKey = 'user_rewards';
      const existingRewards = await kv.get<Record<string, any[]>>(rewardsKey) || {};
      const userRewards = existingRewards[steamId] || [];

      // Check if already granted
      const alreadyGranted = userRewards.some((r: any) => 
        r?.type === consumableType && r?.sessionId === sessionId
      );

      if (!alreadyGranted) {
        // Grant rewards
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
      }

      // Update purchase history
      if (purchase) {
        purchase.fulfilled = true;
        purchase.fulfilledAt = new Date().toISOString();
      } else {
        existingPurchases.push({
          steamId,
          type: 'consumable',
          consumableType,
          quantity,
          amount: session.amount_total ? (session.amount_total / 100) : 0,
          currency: session.currency || 'eur',
          sessionId: session.id,
          timestamp: new Date().toISOString(),
          fulfilled: true,
          fulfilledAt: new Date().toISOString(),
        });
      }

      await kv.set(purchasesKey, existingPurchases.slice(-1000));

      return NextResponse.json({ 
        success: true,
        message: `Granted ${quantity} ${consumableType} to ${steamId}`,
        consumableType,
        quantity,
        alreadyGranted,
      });
    }

    return NextResponse.json({ 
      error: 'Unknown purchase type or missing data',
      metadata: session.metadata 
    }, { status: 400 });

  } catch (error: any) {
    console.error('Failed to fix purchase:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fix purchase' 
    }, { status: 500 });
  }
}

