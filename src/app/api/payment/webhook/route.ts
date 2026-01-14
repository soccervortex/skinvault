import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { grantPro } from '@/app/utils/pro-storage';
import { dbGet, dbSet } from '@/app/utils/database';
import { captureError, captureMessage } from '@/app/lib/error-handler';
import { sendInngestEvent } from '@/app/lib/inngest';
import { notifyProPurchase, notifyConsumablePurchase } from '@/app/utils/discord-webhook';
import { getDatabase } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';

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

    // Handle credits purchase
    if (steamId && type === 'credits') {
      const credits = Number(session.metadata?.credits || 0);
      const pack = String(session.metadata?.pack || '');

      if (credits > 0) {
        try {
          const purchasesKey = 'purchase_history';
          const existingPurchases = await dbGet<Array<any>>(purchasesKey) || [];
          const alreadyFulfilled = existingPurchases.some(p => p.sessionId === session.id);

          if (alreadyFulfilled) {
            console.log(`⚠️ Purchase ${session.id} already fulfilled, skipping`);
            return NextResponse.json({ received: true, message: 'Already fulfilled' });
          }

          const db = await getDatabase();
          const creditsCol = db.collection('user_credits');
          const ledgerCol = db.collection('credits_ledger');
          const now = new Date();

          await creditsCol.updateOne(
            { _id: steamId } as any,
            {
              $setOnInsert: { _id: steamId, steamId },
              $inc: { balance: credits },
              $set: { updatedAt: now },
            } as any,
            { upsert: true }
          );

          await ledgerCol.insertOne({
            steamId,
            delta: credits,
            type: 'purchase_credits',
            createdAt: now,
            meta: { sessionId: session.id, pack },
          } as any);

          try {
            const amount = session.amount_total ? (session.amount_total / 100) : 0;
            const currency = session.currency || 'eur';

            existingPurchases.push({
              steamId,
              type: 'credits',
              credits,
              pack,
              amount,
              currency,
              sessionId: session.id,
              timestamp: new Date().toISOString(),
              fulfilled: true,
              fulfilledAt: new Date().toISOString(),
              paymentIntentId: session.payment_intent as string || null,
              customerId: session.customer as string || null,
            });

            await dbSet(purchasesKey, existingPurchases.slice(-1000));
            console.log(`✅ Purchase ${session.id} recorded in history`);
          } catch (error) {
            console.error('Failed to record purchase history:', error);
          }

          try {
            await createUserNotification(
              db,
              steamId,
              'purchase_credits',
              'Credits Purchased',
              `Your purchase was successful. ${credits.toLocaleString('en-US')} credits were added to your balance.`,
              { pack, credits, sessionId: session.id }
            );
          } catch {
          }

          console.log(`✅ Granted ${credits} credits to ${steamId}`);
        } catch (error) {
          console.error('❌ Failed to grant credits:', error);
          try {
            const failedKey = 'failed_purchases';
            const failed = await dbGet<Array<any>>(failedKey) || [];
            failed.push({
              sessionId: session.id,
              steamId,
              type: 'credits',
              credits,
              pack,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
              amount: session.amount_total ? (session.amount_total / 100) : 0,
            });
            await dbSet(failedKey, failed.slice(-100));
          } catch (err) {
            console.error('Failed to record failed purchase:', err);
          }
        }
      }
    }

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

        // Analytics: pro_purchase (creator-attributed)
        try {
          const db = await getDatabase();
          const attribution = await db.collection('creator_attribution').findOne({ steamId });
          const refSlug = attribution?.refSlug ? String(attribution.refSlug).toLowerCase() : null;
          const utm = attribution?.utm || null;

          const now = new Date();
          await db.collection('analytics_events').insertOne({
            event: 'pro_purchase',
            createdAt: now,
            day: now.toISOString().slice(0, 10),
            steamId,
            refSlug,
            utm,
            value: session.amount_total ? session.amount_total / 100 : undefined,
            metadata: {
              months,
              sessionId: session.id,
              currency: session.currency || undefined,
              proUntil,
            },
          });
        } catch {
          // ignore analytics errors
        }
        
        // Record purchase history with fulfillment status
        try {
          const amount = session.amount_total ? (session.amount_total / 100) : 0;
          const currency = session.currency || 'eur';
          
          existingPurchases.push({
            steamId,
            type: 'pro',
            months,
            amount,
            currency,
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
          
          // Send Discord notification for Pro purchase
          notifyProPurchase(steamId, months, amount, currency, proUntil, session.id).catch(error => {
            console.error('Failed to send Pro purchase notification:', error);
          });

          try {
            const db = await getDatabase();
            await createUserNotification(
              db,
              steamId,
              'purchase_pro',
              'Pro Activated',
              `Your Pro purchase was successful. Pro is active for ${months} month${months > 1 ? 's' : ''}.`,
              { months, proUntil, sessionId: session.id }
            );
          } catch {
          }
          
          // Trigger Discord role sync if user has Discord connected
          try {
            const { dbGet } = await import('@/app/utils/database');
            const discordConnectionsKey = 'discord_connections';
            const connections = await dbGet<Record<string, any>>(discordConnectionsKey) || {};
            const connection = connections[steamId];
            
            if (connection?.discordId) {
              const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online'}/api/discord/sync-roles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  discordId: connection.discordId,
                  steamId: steamId,
                  reason: 'pro_purchased',
                }),
              });
              if (syncResponse.ok) {
                console.log(`✅ Triggered Discord role sync for Pro purchase`);
              }
            }
          } catch (error) {
            console.error('⚠️ Failed to trigger Discord role sync:', error);
          }
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
            const amount = session.amount_total ? (session.amount_total / 100) : 0;
            const currency = session.currency || 'eur';
            
            existingPurchases.push({
              steamId,
              type: 'consumable',
              consumableType,
              quantity,
              amount,
              currency,
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
            
            // Send Discord notification for consumable purchase
            notifyConsumablePurchase(steamId, consumableType, quantity, amount, currency, session.id).catch(error => {
              console.error('Failed to send consumable purchase notification:', error);
            });

            try {
              const db = await getDatabase();
              await createUserNotification(
                db,
                steamId,
                'purchase_consumable',
                'Purchase Successful',
                `Your purchase was successful. ${quantity}x ${String(consumableType)} was added to your account.`,
                { consumableType, quantity, sessionId: session.id }
              );
            } catch {
            }
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
