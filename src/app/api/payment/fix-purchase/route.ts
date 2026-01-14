import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { dbGet, dbSet } from '@/app/utils/database';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';

// Helper to get Stripe instance (checks for test mode)
async function getStripeInstance(): Promise<Stripe> {
  let testMode = false;
  try {
    testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
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
    const existingPurchases = await dbGet<Array<any>>(purchasesKey) || [];
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
      const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
      const userRewards = existingRewards[steamId] || [];

      // Check if already granted (check by type, not just sessionId)
      const alreadyGrantedCount = userRewards.filter((r: any) => 
        r?.type === consumableType
      ).length;

      // Grant missing rewards (if user has less than quantity)
      if (alreadyGrantedCount < quantity) {
        const toGrant = quantity - alreadyGrantedCount;
        for (let i = 0; i < toGrant; i++) {
          userRewards.push({
            type: consumableType,
            grantedAt: new Date().toISOString(),
            source: 'purchase',
            sessionId,
          });
        }

        existingRewards[steamId] = userRewards;
        await dbSet(rewardsKey, existingRewards);
        console.log(`✅ Granted ${toGrant} ${consumableType} to ${steamId} (${alreadyGrantedCount} already existed)`);
      } else {
        console.log(`ℹ️ User already has ${alreadyGrantedCount} ${consumableType}, no need to grant`);
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

      await dbSet(purchasesKey, existingPurchases.slice(-1000));

      const finalCount = existingRewards[steamId]?.filter((r: any) => r?.type === consumableType).length || 0;

      try {
        if (hasMongoConfig()) {
          const db = await getDatabase();
          await createUserNotification(
            db,
            steamId,
            'purchase_fixed',
            'Purchase Fulfilled',
            `A missing purchase reward was fulfilled: ${quantity}x ${String(consumableType)}.`,
            { consumableType, quantity, sessionId }
          );
        }
      } catch {
      }

      return NextResponse.json({ 
        success: true,
        message: alreadyGrantedCount < quantity 
          ? `Granted ${quantity - alreadyGrantedCount} ${consumableType} to ${steamId}` 
          : `User already has ${finalCount} ${consumableType}`,
        consumableType,
        quantity,
        alreadyGranted: alreadyGrantedCount >= quantity,
        totalGranted: finalCount,
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

