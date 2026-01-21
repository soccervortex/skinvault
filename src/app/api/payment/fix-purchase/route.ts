import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { dbGet, dbSet } from '@/app/utils/database';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';
import { sanitizeEmail } from '@/app/utils/sanitize';

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

    const receiptNumber = String((charge as any)?.receipt_number || '').trim();
    if (receiptNumber) out.receiptNumber = receiptNumber;

    const chargeEmail = sanitizeEmail(String((charge as any)?.billing_details?.email || ''));
    if (!out.customerEmail && chargeEmail) out.customerEmail = chargeEmail;

    return out;
  } catch {
    return {};
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

// POST: Manually fulfill a purchase that wasn't fulfilled
export async function POST(request: Request) {
  try {
    const { sessionId, steamId } = await request.json();

    if (!sessionId || !steamId) {
      return NextResponse.json({ error: 'Missing sessionId or steamId' }, { status: 400 });
    }

    const stripe = await getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const invoicePatch = await getInvoicePatch(stripe, session);
    const receiptPatch = await getReceiptPatch(stripe, session);

    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
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

        for (const [k, v] of Object.entries({ ...invoicePatch, ...receiptPatch })) {
          if (v == null) continue;
          if (purchase[k] == null || String(purchase[k] || '').trim() === '') {
            purchase[k] = v;
          }
        }
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
          paymentIntentId: (session.payment_intent as string) || null,
          customerId: (session.customer as string) || null,
          ...invoicePatch,
          ...receiptPatch,
        });
      }

      await dbSet(purchasesKey, existingPurchases.slice(-1000));

      const finalCount = existingRewards[steamId]?.filter((r: any) => r?.type === consumableType).length || 0;

      try {
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
            'purchase_fixed',
            'Purchase Fulfilled',
            `A missing purchase reward was fulfilled: ${quantity}x ${consumableLabel}.`,
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

