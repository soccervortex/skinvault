import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { grantPro } from '@/app/utils/pro-storage';
import { dbGet, dbSet } from '@/app/utils/database';

// Helper to get Stripe instance (checks for test mode)
async function getStripeInstance(): Promise<Stripe> {
  // Check if test mode is enabled (use database abstraction)
  let testMode = false;
  try {
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

// Helper to get webhook secrets (returns both test and production)
function getWebhookSecrets(): { test?: string; production?: string } {
  return {
    test: process.env.STRIPE_TEST_WEBHOOK_SECRET,
    production: process.env.STRIPE_WEBHOOK_SECRET,
  };
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event | null = null;
  let stripe: Stripe;

  try {
    stripe = await getStripeInstance();
  } catch (error: any) {
    console.error('Failed to get Stripe instance:', error.message);
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  // Try both test and production webhook secrets
  const secrets = getWebhookSecrets();
  let lastError: Error | null = null;

  // Try production secret first, then test secret
  for (const secret of [secrets.production, secrets.test].filter(Boolean)) {
    if (!secret) continue;
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
      break; // Success, exit loop
    } catch (err: any) {
      lastError = err;
      // Continue to try next secret
    }
  }

  if (!event) {
    console.error('Webhook signature verification failed with all secrets:', lastError?.message);
    return NextResponse.json({ error: `Webhook Error: ${lastError?.message || 'Invalid signature'}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const steamId = session.metadata?.steamId;
    const months = Number(session.metadata?.months || 0);
    const type = session.metadata?.type;

    // Handle Pro subscription
    if (steamId && months > 0 && type !== 'consumable') {
      try {
        // Check if already fulfilled (idempotency check)
        const purchasesKey = 'purchase_history';
        const existingPurchases = await dbGet<Array<any>>(purchasesKey) || [];
        const alreadyFulfilled = existingPurchases.some(p => p.sessionId === session.id);
        
        if (alreadyFulfilled) {
          console.log(`⚠️ Purchase ${session.id} already fulfilled, skipping`);
          return NextResponse.json({ received: true, message: 'Already fulfilled' });
        }

        const proUntil = await grantPro(steamId, months);
        console.log(`✅ Granted ${months} months Pro to ${steamId}, expires ${proUntil}`);
        
        // Record purchase history with fulfillment status
        try {
          existingPurchases.push({
            steamId,
            type: 'pro',
            months,
            amount: session.amount_total ? (session.amount_total / 100) : 0,
            currency: session.currency || 'eur',
            sessionId: session.id,
            timestamp: new Date().toISOString(),
            proUntil,
            fulfilled: true,
            fulfilledAt: new Date().toISOString(),
            paymentIntentId: session.payment_intent as string || null,
            customerId: session.customer as string || null,
          });
          
          // Keep only last 1000 purchases
          const recentPurchases = existingPurchases.slice(-1000);
          await dbSet(purchasesKey, recentPurchases);
          console.log(`✅ Purchase ${session.id} recorded in history`);
        } catch (error) {
          console.error('❌ Failed to record purchase history:', error);
          // Still continue - the Pro was granted
        }
      } catch (error) {
        console.error('❌ Failed to update Pro status:', error);
        // Record failed fulfillment for manual review
        try {
          const failedKey = 'failed_purchases';
          const failed = await dbGet<Array<any>>(failedKey) || [];
          failed.push({
            sessionId: session.id,
            steamId,
            type: 'pro',
            months,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            amount: session.amount_total ? (session.amount_total / 100) : 0,
          });
          await dbSet(failedKey, failed.slice(-100)); // Keep last 100 failed
        } catch (err) {
          console.error('Failed to record failed purchase:', err);
        }
        // Still return 200 to prevent Stripe from retrying (we'll handle manually)
      }
    }

    // Handle consumables (price tracker slots, wishlist slots)
    if (steamId && type === 'consumable') {
      const consumableType = session.metadata?.consumableType;
      const quantity = Number(session.metadata?.quantity || 0);

      if (consumableType && quantity > 0) {
        try {
          // Check if already fulfilled (idempotency check)
          const purchasesKey = 'purchase_history';
          const existingPurchases = await dbGet<Array<any>>(purchasesKey) || [];
          const alreadyFulfilled = existingPurchases.some(p => p.sessionId === session.id);
          
          if (alreadyFulfilled) {
            console.log(`⚠️ Purchase ${session.id} already fulfilled, skipping`);
            return NextResponse.json({ received: true, message: 'Already fulfilled' });
          }

          // Grant consumable rewards
          const rewardsKey = 'user_rewards';
          const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
          const userRewards = existingRewards[steamId] || [];

          // Add consumable rewards
          for (let i = 0; i < quantity; i++) {
            userRewards.push({
              type: consumableType,
              grantedAt: new Date().toISOString(),
              source: 'purchase',
              sessionId: session.id,
            });
          }

          existingRewards[steamId] = userRewards;
          await dbSet(rewardsKey, existingRewards);

          // Record purchase history with fulfillment status
          try {
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
              paymentIntentId: session.payment_intent as string || null,
              customerId: session.customer as string || null,
            });
            
            // Keep only last 1000 purchases
            const recentPurchases = existingPurchases.slice(-1000);
            await dbSet(purchasesKey, recentPurchases);
            console.log(`✅ Purchase ${session.id} recorded in history`);
          } catch (error) {
            console.error('Failed to record purchase history:', error);
            // Still continue - rewards were granted
          }

          console.log(`✅ Granted ${quantity} ${consumableType} to ${steamId}`);
        } catch (error) {
          console.error('❌ Failed to grant consumables:', error);
          // Record failed fulfillment for manual review
          try {
            const failedKey = 'failed_purchases';
            const failed = await dbGet<Array<any>>(failedKey) || [];
            failed.push({
              sessionId: session.id,
              steamId,
              type: 'consumable',
              consumableType: session.metadata?.consumableType,
              quantity: Number(session.metadata?.quantity || 0),
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
              amount: session.amount_total ? (session.amount_total / 100) : 0,
            });
            await dbSet(failedKey, failed.slice(-100)); // Keep last 100 failed
          } catch (err) {
            console.error('Failed to record failed purchase:', err);
          }
          // Still return 200 to prevent Stripe from retrying (we'll handle manually)
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
