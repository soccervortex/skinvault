import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { grantPro } from '@/app/utils/pro-storage';

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

  let event: Stripe.Event;
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
        const proUntil = await grantPro(steamId, months);
        console.log(`✅ Granted ${months} months Pro to ${steamId}, expires ${proUntil}`);
        
        // Record purchase history
        try {
          const { kv } = await import('@vercel/kv');
          const purchasesKey = 'purchase_history';
          const existingPurchases = await kv.get<Array<any>>(purchasesKey) || [];
          
          existingPurchases.push({
            steamId,
            type: 'pro',
            months,
            amount: session.amount_total ? (session.amount_total / 100) : 0,
            currency: session.currency || 'eur',
            sessionId: session.id,
            timestamp: new Date().toISOString(),
            proUntil,
          });
          
          // Keep only last 1000 purchases
          const recentPurchases = existingPurchases.slice(-1000);
          await kv.set(purchasesKey, recentPurchases);
        } catch (error) {
          console.error('Failed to record purchase history:', error);
        }
      } catch (error) {
        console.error('❌ Failed to update Pro status:', error);
        // Still return 200 to prevent Stripe from retrying
      }
    }

    // Handle consumables (price tracker slots, wishlist slots)
    if (steamId && type === 'consumable') {
      const consumableType = session.metadata?.consumableType;
      const quantity = Number(session.metadata?.quantity || 0);

      if (consumableType && quantity > 0) {
        try {
          // Grant consumable rewards
          const { kv } = await import('@vercel/kv');
          const rewardsKey = 'user_rewards';
          
          const existingRewards = await kv.get<Record<string, any[]>>(rewardsKey) || {};
          const userRewards = existingRewards[steamId] || [];

          // Add consumable rewards
          for (let i = 0; i < quantity; i++) {
            userRewards.push({
              type: consumableType,
              grantedAt: new Date().toISOString(),
              source: 'purchase',
            });
          }

          existingRewards[steamId] = userRewards;
          await kv.set(rewardsKey, existingRewards);

          // Record purchase history
          try {
            const purchasesKey = 'purchase_history';
            const existingPurchases = await kv.get<Array<any>>(purchasesKey) || [];
            
            existingPurchases.push({
              steamId,
              type: 'consumable',
              consumableType,
              quantity,
              amount: session.amount_total ? (session.amount_total / 100) : 0,
              currency: session.currency || 'eur',
              sessionId: session.id,
              timestamp: new Date().toISOString(),
            });
            
            // Keep only last 1000 purchases
            const recentPurchases = existingPurchases.slice(-1000);
            await kv.set(purchasesKey, recentPurchases);
          } catch (error) {
            console.error('Failed to record purchase history:', error);
          }

          console.log(`✅ Granted ${quantity} ${consumableType} to ${steamId}`);
        } catch (error) {
          console.error('❌ Failed to grant consumables:', error);
          // Still return 200 to prevent Stripe from retrying
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
