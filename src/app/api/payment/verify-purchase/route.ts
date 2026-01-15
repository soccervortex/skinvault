import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { dbGet, dbSet } from '@/app/utils/database';
import { notifyProPurchase, notifyConsumablePurchase } from '@/app/utils/discord-webhook';
import { createUserNotification } from '@/app/utils/user-notifications';

// Helper to get Stripe instance (checks for test mode)
async function getStripeInstance(): Promise<Stripe> {
  let testMode = false;
  try {
    testMode = (await dbGet<boolean>('stripe_test_mode')) === true;
  } catch (error) {
    // If database fails, use production keys
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

    const purchasesKey = 'purchase_history';
    const existingPurchases = await dbGet<Array<any>>(purchasesKey) || [];
    const purchase = existingPurchases.find(p => p.sessionId === sessionId);
    
    // Check if reward was actually granted (not just if purchase exists)
    const type = session.metadata?.type;
    const consumableType = session.metadata?.consumableType;
    
    if (type === 'consumable' && consumableType) {
      const rewardsKey = 'user_rewards';
      const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
      const userRewards = existingRewards[steamId] || [];
      const rewardGranted = userRewards.some((r: any) => 
        r?.type === consumableType && r?.sessionId === sessionId
      );
      
      if (rewardGranted) {
        return NextResponse.json({ 
          fulfilled: true,
          message: 'Reward already granted',
          sessionId,
          purchase: purchase || null,
        });
      }
      // Continue to grant reward even if purchase exists in history
    } else if (purchase) {
      // For Pro subscriptions, if purchase exists, it's fulfilled
      return NextResponse.json({ 
        fulfilled: true,
        message: 'Purchase already fulfilled',
        sessionId 
      });
    }

    // Fulfill the purchase
    const months = Number(session.metadata?.months || 0);

    // Handle credits purchase
    if (type === 'credits') {
      const credits = Number(session.metadata?.credits || 0);
      const pack = String(session.metadata?.pack || '');

      if (credits <= 0) {
        return NextResponse.json({ error: 'Invalid credits amount' }, { status: 400 });
      }

      const { getDatabase, hasMongoConfig } = await import('@/app/utils/mongodb-client');
      if (!hasMongoConfig()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
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
        meta: { sessionId: session.id, pack, verifiedBy: 'manual_verification' },
      } as any);

      try {
        await createUserNotification(
          db,
          steamId,
          'purchase_credits',
          'Credits Purchased',
          `Your purchase was verified and fulfilled. ${credits.toLocaleString('en-US')} credits were added to your balance.`,
          { pack, credits, sessionId: session.id, verifiedBy: 'manual_verification' }
        );
      } catch {
      }

      existingPurchases.push({
        steamId,
        type: 'credits',
        credits,
        pack,
        amount: session.amount_total ? (session.amount_total / 100) : 0,
        currency: session.currency || 'eur',
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'manual_verification',
      });

      await dbSet(purchasesKey, existingPurchases.slice(-1000));

      return NextResponse.json({
        fulfilled: true,
        type: 'credits',
        credits,
        pack,
        message: `Granted ${credits} credits to ${steamId}`,
      });
    }

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
      
      await dbSet(purchasesKey, existingPurchases.slice(-1000));
      
      // Send Discord notification for manually verified Pro purchase
      const amount = session.amount_total ? (session.amount_total / 100) : 0;
      const currency = session.currency || 'eur';
      notifyProPurchase(steamId, months, amount, currency, proUntil, session.id).catch(error => {
        console.error('Failed to send Pro purchase notification:', error);
      });

      try {
        const { getDatabase, hasMongoConfig } = await import('@/app/utils/mongodb-client');
        if (hasMongoConfig()) {
          const db = await getDatabase();
          await createUserNotification(
            db,
            steamId,
            'purchase_pro',
            'Pro Activated',
            `Your Pro purchase was verified and fulfilled. Pro is active for ${months} month${months === 1 ? '' : 's'}.`,
            { months, proUntil, sessionId: session.id, verifiedBy: 'manual_verification' }
          );
        }
      } catch {
      }
      
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
        const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
        const userRewards = existingRewards[steamId] || [];

        // Check if already granted for this session
        const alreadyGranted = userRewards.filter((r: any) => 
          r?.type === consumableType && r?.sessionId === sessionId
        ).length;

        if (alreadyGranted < quantity) {
          // Grant missing rewards
          const toGrant = quantity - alreadyGranted;
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
          console.log(`✅ Granted ${toGrant} ${consumableType} to ${steamId} (${alreadyGranted} already existed)`);
        } else {
          console.log(`ℹ️ Rewards already granted for session ${sessionId}`);
        }

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
        
        await dbSet(purchasesKey, existingPurchases.slice(-1000));

        // Send Discord notification for manually verified consumable purchase
        const amount = session.amount_total ? (session.amount_total / 100) : 0;
        const currency = session.currency || 'eur';
        notifyConsumablePurchase(steamId, consumableType, quantity, amount, currency, session.id).catch(error => {
          console.error('Failed to send consumable purchase notification:', error);
        });

        try {
          const { getDatabase, hasMongoConfig } = await import('@/app/utils/mongodb-client');
          if (hasMongoConfig()) {
            const db = await getDatabase();
            const consumableLabel = (() => {
              const t = String(consumableType || '').trim();
              if (t === 'wishlist_slot') return 'Wishlist Slot';
              if (t === 'price_tracker_slot') return 'Price Tracker Slot';
              if (t === 'discord_access') return 'Discord Access';
              if (t === 'price_scan_boost') return 'Price Scan Boost';
              if (t === 'cache_boost') return 'Cache Boost';
              return t || 'Consumable';
            })();
            await createUserNotification(
              db,
              steamId,
              'purchase_consumable',
              'Purchase Successful',
              `Your purchase was verified and fulfilled. ${quantity}x ${consumableLabel} was added to your account.`,
              { consumableType, quantity, sessionId: session.id, verifiedBy: 'manual_verification' }
            );
          }
        } catch {
        }

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

    const purchasesKey = 'purchase_history';
    const purchases = await dbGet<Array<any>>(purchasesKey) || [];
    
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
        ...(purchase.type === 'credits' && { credits: purchase.credits, pack: purchase.pack }),
      }
    });

  } catch (error: any) {
    console.error('Purchase check error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to check purchase' 
    }, { status: 500 });
  }
}

