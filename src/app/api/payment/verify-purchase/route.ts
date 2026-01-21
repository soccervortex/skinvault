import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { dbGet, dbSet } from '@/app/utils/database';
import { notifyConsumablePurchaseStrict, notifyCreditsPurchaseStrict, notifyProPurchaseStrict, notifySpinsPurchaseStrict } from '@/app/utils/discord-webhook';
import { createUserNotification } from '@/app/utils/user-notifications';
import { sanitizeEmail } from '@/app/utils/sanitize';

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

async function getReceiptPatch(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<Record<string, any>> {
  try {
    const out: Record<string, any> = {};

    const sessionEmail = sanitizeEmail(String((session as any)?.customer_details?.email || (session as any)?.customer_email || ''));
    if (sessionEmail) out.customerEmail = sessionEmail;

    const piId = (session.payment_intent as string) || '';
    if (!piId) return out;

    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });

    const receiptEmail = sanitizeEmail(String((pi as any)?.receipt_email || ''));
    if (!out.customerEmail && receiptEmail) out.customerEmail = receiptEmail;

    const latestCharge = (pi as any)?.latest_charge;
    let charge: Stripe.Charge | null = null;
    if (typeof latestCharge === 'string' && latestCharge) {
      charge = await stripe.charges.retrieve(latestCharge);
    } else if (latestCharge && typeof latestCharge === 'object') {
      charge = latestCharge as Stripe.Charge;
    }

    const receiptUrl = String((charge as any)?.receipt_url || '').trim();
    if (receiptUrl) out.receiptUrl = receiptUrl;

    const chargeEmail = sanitizeEmail(String((charge as any)?.billing_details?.email || ''));
    if (!out.customerEmail && chargeEmail) out.customerEmail = chargeEmail;

    return out;
  } catch {
    return {};
  }
}

async function updatePurchaseDiscordStatus(sessionId: string, patch: Record<string, any>) {
  const purchasesKey = 'purchase_history';
  const purchases = (await dbGet<Array<any>>(purchasesKey)) || [];
  let updated = false;
  const next = purchases.map((p) => {
    if (!p || updated) return p;
    if (String(p.sessionId || '').trim() !== String(sessionId || '').trim()) return p;
    updated = true;
    return { ...p, ...patch };
  });
  if (updated) {
    await dbSet(purchasesKey, next.slice(-1000));
  }
}

async function getInvoicePatch(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<Record<string, any>> {
  try {
    const refreshed = await stripe.checkout.sessions.retrieve(String(session.id), {
      expand: ['invoice'],
    });

    let invoiceId: string | null = null;
    const rawInvoice = (refreshed as any)?.invoice;
    if (typeof rawInvoice === 'string') invoiceId = rawInvoice;
    else if (rawInvoice && typeof rawInvoice.id === 'string') invoiceId = rawInvoice.id;

    if (!invoiceId) return {};

    const invoice = await stripe.invoices.retrieve(invoiceId);
    const patch: Record<string, any> = { invoiceId: invoice.id };
    if (invoice.hosted_invoice_url) patch.invoiceUrl = invoice.hosted_invoice_url;
    if (invoice.invoice_pdf) patch.invoicePdf = invoice.invoice_pdf;
    if (invoice.number) patch.invoiceNumber = invoice.number;
    return patch;
  } catch {
    return {};
  }
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
    const invoicePatch = await getInvoicePatch(stripe, session);
    const receiptPatch = await getReceiptPatch(stripe, session);

    // Check if payment was successful
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
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
    const months = Number(session.metadata?.months || 0);
    
    if (type === 'consumable' && consumableType) {
      const rewardsKey = 'user_rewards';
      const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
      const userRewards = existingRewards[steamId] || [];
      const rewardGranted = userRewards.some((r: any) => 
        r?.type === consumableType && r?.sessionId === sessionId
      );
      
      if (rewardGranted) {
        if (purchase && purchase?.discordNotified !== true) {
          const quantityRaw = Number(session.metadata?.quantity || purchase?.quantity || 0);
          const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1;
          const amount = session.amount_total ? (session.amount_total / 100) : 0;
          const currency = session.currency || 'eur';
          const nextAttempts = Math.max(0, Math.floor(Number(purchase?.discordNotifyAttempts || 0))) + 1;
          try {
            await updatePurchaseDiscordStatus(session.id, {
              discordNotifyAttempts: nextAttempts,
              discordNotifyLastAttemptAt: new Date().toISOString(),
            });
            await notifyConsumablePurchaseStrict(steamId, consumableType, quantity, amount, currency, session.id);
            await updatePurchaseDiscordStatus(session.id, {
              discordNotified: true,
              discordNotifiedAt: new Date().toISOString(),
              discordNotifyError: null,
            });
          } catch (error: any) {
            await updatePurchaseDiscordStatus(session.id, {
              discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
            });
          }
        }

        if (purchase && Object.keys(invoicePatch).length > 0 && !purchase?.invoiceId) {
          try {
            await updatePurchaseDiscordStatus(session.id, invoicePatch);
          } catch {
          }
        }

        if (purchase && Object.keys(receiptPatch).length > 0 && !purchase?.receiptUrl) {
          try {
            await updatePurchaseDiscordStatus(session.id, receiptPatch);
          } catch {
          }
        }
        return NextResponse.json({ 
          fulfilled: true,
          message: 'Reward already granted',
          sessionId,
          purchase: purchase || null,
        });
      }
      // Continue to grant reward even if purchase exists in history
    } else if (purchase) {
      if (Object.keys(invoicePatch).length > 0 && !purchase?.invoiceId) {
        try {
          await updatePurchaseDiscordStatus(session.id, invoicePatch);
        } catch {
        }
      }
      if (Object.keys(receiptPatch).length > 0 && !purchase?.receiptUrl) {
        try {
          await updatePurchaseDiscordStatus(session.id, receiptPatch);
        } catch {
        }
      }
      if (purchase?.discordNotified !== true) {
        const amount = session.amount_total ? (session.amount_total / 100) : 0;
        const currency = session.currency || 'eur';
        const nextAttempts = Math.max(0, Math.floor(Number(purchase?.discordNotifyAttempts || 0))) + 1;
        try {
          await updatePurchaseDiscordStatus(session.id, {
            discordNotifyAttempts: nextAttempts,
            discordNotifyLastAttemptAt: new Date().toISOString(),
          });

          const t = String(type || '').trim();
          if (t === 'credits') {
            const credits = Number(session.metadata?.credits || purchase?.credits || 0);
            const pack = String(session.metadata?.pack || purchase?.pack || '');
            await notifyCreditsPurchaseStrict(steamId, credits, pack, amount, currency, session.id);
          } else if (t === 'spins') {
            const spins = Number(session.metadata?.spins || purchase?.spins || 0);
            const pack = String(session.metadata?.pack || purchase?.pack || '');
            await notifySpinsPurchaseStrict(steamId, spins, pack, amount, currency, session.id);
          } else {
            const proUntil = String(session.metadata?.proUntil || purchase?.proUntil || '');
            await notifyProPurchaseStrict(steamId, months, amount, currency, proUntil, session.id);
          }

          await updatePurchaseDiscordStatus(session.id, {
            discordNotified: true,
            discordNotifiedAt: new Date().toISOString(),
            discordNotifyError: null,
          });
        } catch (error: any) {
          await updatePurchaseDiscordStatus(session.id, {
            discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
          });
        }
      }

      // For Pro subscriptions / credits, if purchase exists, it's fulfilled
      return NextResponse.json({
        fulfilled: true,
        message: 'Purchase already fulfilled',
        sessionId,
      });
    }

    // Fulfill the purchase

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

      const amount = session.amount_total ? (session.amount_total / 100) : 0;
      const currency = session.currency || 'eur';
      const nowIso = new Date().toISOString();
      const record = {
        steamId,
        type: 'credits',
        credits,
        pack,
        amount,
        currency,
        sessionId: session.id,
        timestamp: nowIso,
        verifiedAt: nowIso,
        verifiedBy: 'manual_verification',
        fulfilled: true,
        fulfilledAt: nowIso,
        paymentIntentId: (session.payment_intent as string) || null,
        customerId: (session.customer as string) || null,
        discordNotified: false,
        discordNotifyAttempts: 0,
        ...invoicePatch,
        ...receiptPatch,
      };

      const existingIdx = existingPurchases.findIndex((p) => String(p?.sessionId || '').trim() === String(session.id || '').trim());
      if (existingIdx >= 0) {
        existingPurchases[existingIdx] = { ...existingPurchases[existingIdx], ...record };
      } else {
        existingPurchases.push(record);
      }

      await dbSet(purchasesKey, existingPurchases.slice(-1000));

      try {
        await updatePurchaseDiscordStatus(session.id, {
          discordNotifyAttempts: 1,
          discordNotifyLastAttemptAt: new Date().toISOString(),
        });
        await notifyCreditsPurchaseStrict(steamId, credits, pack, amount, currency, session.id);
        await updatePurchaseDiscordStatus(session.id, {
          discordNotified: true,
          discordNotifiedAt: new Date().toISOString(),
          discordNotifyError: null,
        });
      } catch (error: any) {
        await updatePurchaseDiscordStatus(session.id, {
          discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
        });
      }

      return NextResponse.json({
        fulfilled: true,
        type: 'credits',
        credits,
        pack,
        ...invoicePatch,
        ...receiptPatch,
        message: `Granted ${credits} credits to ${steamId}`,
      });
    }

    // Handle spins purchase
    if (type === 'spins') {
      const spins = Number(session.metadata?.spins || 0);
      const pack = String(session.metadata?.pack || '');

      if (spins <= 0) {
        return NextResponse.json({ error: 'Invalid spins amount' }, { status: 400 });
      }

      const { getDatabase, hasMongoConfig } = await import('@/app/utils/mongodb-client');
      if (!hasMongoConfig()) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const db = await getDatabase();
      const bonusCol = db.collection('bonus_spins');
      const now = new Date();

      await bonusCol.updateOne(
        { _id: steamId } as any,
        {
          $setOnInsert: { _id: steamId, steamId, createdAt: now } as any,
          $inc: { count: spins },
          $set: { updatedAt: now },
        } as any,
        { upsert: true }
      );

      try {
        await createUserNotification(
          db,
          steamId,
          'purchase_spins',
          'Spins Purchased',
          `Your purchase was verified and fulfilled. ${spins.toLocaleString('en-US')} bonus spins were added to your account.`,
          { pack, spins, sessionId: session.id, verifiedBy: 'manual_verification' }
        );
      } catch {
      }

      const amount = session.amount_total ? (session.amount_total / 100) : 0;
      const currency = session.currency || 'eur';
      const nowIso = new Date().toISOString();
      const record = {
        steamId,
        type: 'spins',
        spins,
        pack,
        amount,
        currency,
        sessionId: session.id,
        timestamp: nowIso,
        verifiedAt: nowIso,
        verifiedBy: 'manual_verification',
        fulfilled: true,
        fulfilledAt: nowIso,
        paymentIntentId: (session.payment_intent as string) || null,
        customerId: (session.customer as string) || null,
        discordNotified: false,
        discordNotifyAttempts: 0,
        ...invoicePatch,
      };

      const existingIdx = existingPurchases.findIndex((p) => String(p?.sessionId || '').trim() === String(session.id || '').trim());
      if (existingIdx >= 0) {
        existingPurchases[existingIdx] = { ...existingPurchases[existingIdx], ...record };
      } else {
        existingPurchases.push(record);
      }

      await dbSet(purchasesKey, existingPurchases.slice(-1000));

      try {
        await updatePurchaseDiscordStatus(session.id, {
          discordNotifyAttempts: 1,
          discordNotifyLastAttemptAt: new Date().toISOString(),
        });
        await notifySpinsPurchaseStrict(steamId, spins, pack, amount, currency, session.id);
        await updatePurchaseDiscordStatus(session.id, {
          discordNotified: true,
          discordNotifiedAt: new Date().toISOString(),
          discordNotifyError: null,
        });
      } catch (error: any) {
        await updatePurchaseDiscordStatus(session.id, {
          discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
        });
      }

      return NextResponse.json({
        fulfilled: true,
        type: 'spins',
        spins,
        pack,
        ...invoicePatch,
        ...receiptPatch,
        message: `Granted ${spins} spins to ${steamId}`,
      });
    }

    // Handle Pro subscription
    if (months > 0 && type !== 'consumable') {
      const { grantPro } = await import('@/app/utils/pro-storage');
      const proUntil = await grantPro(steamId, months);
      
      const amount = session.amount_total ? (session.amount_total / 100) : 0;
      const currency = session.currency || 'eur';
      const nowIso = new Date().toISOString();
      const record = {
        steamId,
        type: 'pro',
        months,
        amount,
        currency,
        sessionId: session.id,
        timestamp: nowIso,
        proUntil,
        verifiedAt: nowIso,
        verifiedBy: 'manual_verification',
        fulfilled: true,
        fulfilledAt: nowIso,
        paymentIntentId: (session.payment_intent as string) || null,
        customerId: (session.customer as string) || null,
        discordNotified: false,
        discordNotifyAttempts: 0,
        ...invoicePatch,
      };

      const existingIdx = existingPurchases.findIndex((p) => String(p?.sessionId || '').trim() === String(session.id || '').trim());
      if (existingIdx >= 0) {
        existingPurchases[existingIdx] = { ...existingPurchases[existingIdx], ...record };
      } else {
        existingPurchases.push(record);
      }
      
      await dbSet(purchasesKey, existingPurchases.slice(-1000));

      try {
        await updatePurchaseDiscordStatus(session.id, {
          discordNotifyAttempts: 1,
          discordNotifyLastAttemptAt: new Date().toISOString(),
        });
        await notifyProPurchaseStrict(steamId, months, amount, currency, proUntil, session.id);
        await updatePurchaseDiscordStatus(session.id, {
          discordNotified: true,
          discordNotifiedAt: new Date().toISOString(),
          discordNotifyError: null,
        });
      } catch (error: any) {
        await updatePurchaseDiscordStatus(session.id, {
          discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
        });
      }

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
        ...invoicePatch,
        ...receiptPatch,
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

        const amount = session.amount_total ? (session.amount_total / 100) : 0;
        const currency = session.currency || 'eur';
        const nowIso = new Date().toISOString();
        const record = {
          steamId,
          type: 'consumable',
          consumableType,
          quantity,
          amount,
          currency,
          sessionId: session.id,
          timestamp: nowIso,
          verifiedAt: nowIso,
          verifiedBy: 'manual_verification',
          fulfilled: true,
          fulfilledAt: nowIso,
          paymentIntentId: (session.payment_intent as string) || null,
          customerId: (session.customer as string) || null,
          discordNotified: false,
          discordNotifyAttempts: 0,
          ...invoicePatch,
          ...receiptPatch,
        };

        const existingIdx = existingPurchases.findIndex((p) => String(p?.sessionId || '').trim() === String(session.id || '').trim());
        if (existingIdx >= 0) {
          existingPurchases[existingIdx] = { ...existingPurchases[existingIdx], ...record };
        } else {
          existingPurchases.push(record);
        }
        
        await dbSet(purchasesKey, existingPurchases.slice(-1000));

        try {
          await updatePurchaseDiscordStatus(session.id, {
            discordNotifyAttempts: 1,
            discordNotifyLastAttemptAt: new Date().toISOString(),
          });
          await notifyConsumablePurchaseStrict(steamId, consumableType, quantity, amount, currency, session.id);
          await updatePurchaseDiscordStatus(session.id, {
            discordNotified: true,
            discordNotifiedAt: new Date().toISOString(),
            discordNotifyError: null,
          });
        } catch (error: any) {
          await updatePurchaseDiscordStatus(session.id, {
            discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
          });
        }

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
          ...invoicePatch,
          ...receiptPatch,
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
        receiptUrl: (purchase as any).receiptUrl || null,
        customerEmail: (purchase as any).customerEmail || null,
        invoiceId: (purchase as any).invoiceId || null,
        invoiceUrl: (purchase as any).invoiceUrl || null,
        invoicePdf: (purchase as any).invoicePdf || null,
        invoiceNumber: (purchase as any).invoiceNumber || null,
        ...(purchase.type === 'pro' && { months: purchase.months, proUntil: purchase.proUntil }),
        ...(purchase.type === 'consumable' && { consumableType: purchase.consumableType, quantity: purchase.quantity }),
        ...(purchase.type === 'credits' && { credits: purchase.credits, pack: purchase.pack }),
        ...(purchase.type === 'spins' && { spins: purchase.spins, pack: purchase.pack }),
      }
    });

  } catch (error: any) {
    console.error('Purchase check error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to check purchase' 
    }, { status: 500 });
  }
}

