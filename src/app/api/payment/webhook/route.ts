import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { grantPro } from '@/app/utils/pro-storage';
import { dbGet, dbSet } from '@/app/utils/database';
import { captureError, captureMessage } from '@/app/lib/error-handler';
import { sendInngestEvent } from '@/app/lib/inngest';
import { notifyConsumablePurchaseStrict, notifyCreditsPurchaseStrict, notifyProPurchaseStrict, notifySpinsPurchaseStrict } from '@/app/utils/discord-webhook';
import { getDatabase } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';
import { sendEmail } from '@/app/utils/email';
import { sanitizeEmail } from '@/app/utils/sanitize';

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

async function sendPaymentProblemEmailSafe(args: {
  to: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  try {
    const to = sanitizeEmail(args.to);
    if (!to) return;
    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#0b0d12; padding:24px">
        <div style="max-width:560px; margin:0 auto; background:#11141d; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:24px; color:#fff">
          <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#9ca3af; font-weight:800">Skinvaults</div>
          <h1 style="margin:10px 0 0; font-size:22px; letter-spacing:-0.02em">${args.title}</h1>
          <p style="margin:12px 0 0; color:#cbd5e1; font-size:14px; line-height:1.5">${args.body}</p>
          <div style="margin-top:18px">
            <a href="${args.ctaUrl}" target="_blank" rel="noreferrer" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; font-size:12px; padding:12px 16px; border-radius:14px">${args.ctaLabel}</a>
          </div>
          <p style="margin:18px 0 0; color:#64748b; font-size:12px">If you think you were charged, please contact support.</p>
        </div>
      </div>
    `;
    await sendEmail({ to, subject: args.subject, html });
  } catch {
  }
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

async function sendPurchaseEmailSafe(args: {
  to: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  try {
    const to = sanitizeEmail(args.to);
    if (!to) return;
    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#0b0d12; padding:24px">
        <div style="max-width:560px; margin:0 auto; background:#11141d; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:24px; color:#fff">
          <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#9ca3af; font-weight:800">Skinvaults</div>
          <h1 style="margin:10px 0 0; font-size:22px; letter-spacing:-0.02em">${args.title}</h1>
          <p style="margin:12px 0 0; color:#cbd5e1; font-size:14px; line-height:1.5">${args.body}</p>
          <div style="margin-top:18px">
            <a href="${args.ctaUrl}" target="_blank" rel="noreferrer" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; font-size:12px; padding:12px 16px; border-radius:14px">${args.ctaLabel}</a>
          </div>
          <p style="margin:18px 0 0; color:#64748b; font-size:12px">If you didn’t make this purchase, please contact support.</p>
        </div>
      </div>
    `;
    await sendEmail({ to, subject: args.subject, html });
  } catch {
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

    const invoicePatch = await getInvoicePatch(stripe, session);
    const receiptPatch = await getReceiptPatch(stripe, session);

    const downloadUrl = String(receiptPatch?.receiptUrl || invoicePatch?.invoiceUrl || invoicePatch?.invoicePdf || '').trim();
    const customerEmail = sanitizeEmail(String(receiptPatch?.customerEmail || ''));

    // Handle spins purchase
    if (steamId && type === 'spins') {
      const spins = Number(session.metadata?.spins || 0);
      const pack = String(session.metadata?.pack || '');

      if (spins > 0) {
        try {
          const purchasesKey = 'purchase_history';
          const existingPurchases = (await dbGet<Array<any>>(purchasesKey)) || [];
          const existingPurchase = existingPurchases.find((p) => p?.sessionId === session.id);
          const alreadyFulfilled = !!existingPurchase;

          if (alreadyFulfilled) {
            console.log(`⚠️ Purchase ${session.id} already fulfilled, skipping`);
            if (
              existingPurchase &&
              Object.keys(invoicePatch).length > 0 &&
              !existingPurchase?.invoiceId
            ) {
              try {
                await updatePurchaseDiscordStatus(session.id, invoicePatch);
              } catch {
              }
            }

            if (
              existingPurchase &&
              Object.keys(receiptPatch).length > 0 &&
              !existingPurchase?.receiptUrl
            ) {
              try {
                await updatePurchaseDiscordStatus(session.id, receiptPatch);
              } catch {
              }
            }
            return NextResponse.json({ received: true, message: 'Already fulfilled' });
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

          const amount = session.amount_total ? session.amount_total / 100 : 0;
          const currency = session.currency || 'eur';

          try {
            existingPurchases.push({
              steamId,
              type: 'spins',
              spins,
              pack,
              amount,
              currency,
              sessionId: session.id,
              timestamp: new Date().toISOString(),
              fulfilled: true,
              fulfilledAt: new Date().toISOString(),
              paymentIntentId: (session.payment_intent as string) || null,
              customerId: (session.customer as string) || null,
              discordNotified: false,
              discordNotifyAttempts: 0,
              ...invoicePatch,
              ...receiptPatch,
            });

            await dbSet(purchasesKey, existingPurchases.slice(-1000));
            console.log(`✅ Purchase ${session.id} recorded in history`);
          } catch (error) {
            console.error('Failed to record purchase history:', error);
          }

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
            console.error('Failed to send spins purchase notification:', error);
            await updatePurchaseDiscordStatus(session.id, {
              discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
            });
          }

          try {
            await createUserNotification(
              db,
              steamId,
              'purchase_spins',
              'Spins Purchased',
              `Your purchase was successful. ${spins.toLocaleString('en-US')} bonus spins were added to your account.`,
              { pack, spins, sessionId: session.id }
            );
          } catch {
          }

          if (customerEmail && downloadUrl) {
            void sendPurchaseEmailSafe({
              to: customerEmail,
              subject: 'Your SkinVaults receipt',
              title: 'Payment successful',
              body: 'Thanks for your purchase. You can view and download your receipt using the button below.',
              ctaLabel: 'View receipt',
              ctaUrl: downloadUrl,
            });
          }

          console.log(`✅ Granted ${spins} bonus spins to ${steamId}`);
        } catch (error) {
          console.error('❌ Failed to grant bonus spins:', error);
          try {
            const failedKey = 'failed_purchases';
            const failed = (await dbGet<Array<any>>(failedKey)) || [];
            failed.push({
              sessionId: session.id,
              steamId,
              type: 'spins',
              spins,
              pack: String(session.metadata?.pack || ''),
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
              amount: session.amount_total ? session.amount_total / 100 : 0,
            });
            await dbSet(failedKey, failed.slice(-100));
          } catch (err) {
            console.error('Failed to record failed purchase:', err);
          }
        }
      }
    }

    // Handle credits purchase
    if (steamId && type === 'credits') {
      const credits = Number(session.metadata?.credits || 0);
      const pack = String(session.metadata?.pack || '');

      if (credits > 0) {
        try {
          const purchasesKey = 'purchase_history';
          const existingPurchases = await dbGet<Array<any>>(purchasesKey) || [];
          const existingPurchase = existingPurchases.find(p => p?.sessionId === session.id);
          const alreadyFulfilled = !!existingPurchase;

          if (alreadyFulfilled) {
            console.log(`⚠️ Purchase ${session.id} already fulfilled, skipping`);

            if (
              existingPurchase &&
              Object.keys(invoicePatch).length > 0 &&
              !existingPurchase?.invoiceId
            ) {
              try {
                await updatePurchaseDiscordStatus(session.id, invoicePatch);
              } catch {
              }
            }

            if (
              existingPurchase &&
              Object.keys(receiptPatch).length > 0 &&
              !existingPurchase?.receiptUrl
            ) {
              try {
                await updatePurchaseDiscordStatus(session.id, receiptPatch);
              } catch {
              }
            }

            if (existingPurchase?.discordNotified !== true) {
              try {
                const amount = session.amount_total ? (session.amount_total / 100) : 0;
                const currency = session.currency || 'eur';
                const nextAttempts = Math.max(0, Math.floor(Number(existingPurchase?.discordNotifyAttempts || 0))) + 1;
                await updatePurchaseDiscordStatus(session.id, {
                  discordNotifyAttempts: nextAttempts,
                  discordNotifyLastAttemptAt: new Date().toISOString(),
                });
                await notifyCreditsPurchaseStrict(steamId, credits, pack, amount, currency, session.id);
                await updatePurchaseDiscordStatus(session.id, {
                  discordNotified: true,
                  discordNotifiedAt: new Date().toISOString(),
                  discordNotifyError: null,
                });
              } catch (error: any) {
                console.error('Failed to send credits purchase notification (retry):', error);
                await updatePurchaseDiscordStatus(session.id, {
                  discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
                });
              }
            }

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

          const amount = session.amount_total ? (session.amount_total / 100) : 0;
          const currency = session.currency || 'eur';

          try {
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
              discordNotified: false,
              discordNotifyAttempts: 0,
              ...invoicePatch,
              ...receiptPatch,
            });

            await dbSet(purchasesKey, existingPurchases.slice(-1000));
            console.log(`✅ Purchase ${session.id} recorded in history`);
          } catch (error) {
            console.error('Failed to record purchase history:', error);
          }

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
            console.error('Failed to send credits purchase notification:', error);
            await updatePurchaseDiscordStatus(session.id, {
              discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
            });
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

          if (customerEmail && downloadUrl) {
            void sendPurchaseEmailSafe({
              to: customerEmail,
              subject: 'Your SkinVaults receipt',
              title: 'Payment successful',
              body: 'Thanks for your purchase. You can view and download your receipt using the button below.',
              ctaLabel: 'View receipt',
              ctaUrl: downloadUrl,
            });
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
          if (Object.keys(invoicePatch).length > 0) {
            try {
              await updatePurchaseDiscordStatus(session.id, invoicePatch);
            } catch {
            }
          }

          if (Object.keys(receiptPatch).length > 0) {
            try {
              await updatePurchaseDiscordStatus(session.id, receiptPatch);
            } catch {
            }
          }
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
            discordNotified: false,
            discordNotifyAttempts: 0,
            ...invoicePatch,
            ...receiptPatch,
          });
          
          // Keep only last 1000 purchases
          const recentPurchases = existingPurchases.slice(-1000);
          await dbSet(purchasesKey, recentPurchases);
          console.log(`✅ Purchase ${session.id} recorded in history`);

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
            console.error('Failed to send Pro purchase notification:', error);
            await updatePurchaseDiscordStatus(session.id, {
              discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
            });
          }

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

          if (customerEmail && downloadUrl) {
            void sendPurchaseEmailSafe({
              to: customerEmail,
              subject: 'Your SkinVaults receipt',
              title: 'Payment successful',
              body: 'Thanks for your purchase. You can view and download your receipt using the button below.',
              ctaLabel: 'View receipt',
              ctaUrl: downloadUrl,
            });
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
            if (Object.keys(invoicePatch).length > 0) {
              try {
                await updatePurchaseDiscordStatus(session.id, invoicePatch);
              } catch {
              }
            }

            if (Object.keys(receiptPatch).length > 0) {
              try {
                await updatePurchaseDiscordStatus(session.id, receiptPatch);
              } catch {
              }
            }
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
              discordNotified: false,
              discordNotifyAttempts: 0,
              ...invoicePatch,
              ...receiptPatch,
            });
            
            // Keep only last 1000 purchases
            const recentPurchases = existingPurchases.slice(-1000);
            await dbSet(purchasesKey, recentPurchases);
            console.log(`✅ Purchase ${session.id} recorded in history`);

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
              console.error('Failed to send consumable purchase notification:', error);
              await updatePurchaseDiscordStatus(session.id, {
                discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
              });
            }

            try {
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
                `Your purchase was successful. ${quantity}x ${consumableLabel} was added to your account.`,
                { consumableType, quantity, sessionId: session.id }
              );
            } catch {
            }

            if (customerEmail && downloadUrl) {
              void sendPurchaseEmailSafe({
                to: customerEmail,
                subject: 'Your SkinVaults receipt',
                title: 'Payment successful',
                body: 'Thanks for your purchase. You can view and download your receipt using the button below.',
                ctaLabel: 'View receipt',
                ctaUrl: downloadUrl,
              });
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

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const steamId = String(session.metadata?.steamId || '').trim();
    const type = String(session.metadata?.type || '').trim();
    const amount = typeof session.amount_total === 'number' ? session.amount_total / 100 : 0;
    const currency = String(session.currency || 'eur');
    const customerEmail = sanitizeEmail(String((session as any)?.customer_details?.email || (session as any)?.customer_email || ''));

    try {
      const failedKey = 'failed_purchases';
      const failed = (await dbGet<Array<any>>(failedKey)) || [];
      failed.push({
        sessionId: session.id,
        steamId: steamId || null,
        type: type || null,
        amount,
        currency,
        status: 'expired',
        error: 'Checkout expired',
        customerEmail: customerEmail || null,
        timestamp: new Date().toISOString(),
      });
      await dbSet(failedKey, failed.slice(-200));
    } catch {
    }

    const baseUrl = String(process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online');
    const ctaUrl = type === 'pro' ? `${baseUrl}/pro` : `${baseUrl}/shop`;

    if (customerEmail) {
      void sendPaymentProblemEmailSafe({
        to: customerEmail,
        subject: 'Payment expired',
        title: 'Your checkout expired',
        body: 'Your payment was not completed in time, so the checkout expired. You can try again using the button below.',
        ctaLabel: 'Try again',
        ctaUrl,
      });
    }

    return NextResponse.json({ received: true });
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const steamId = String((pi.metadata as any)?.steamId || '').trim();
    const type = String((pi.metadata as any)?.type || '').trim();
    const amount = typeof pi.amount === 'number' ? pi.amount / 100 : 0;
    const currency = String(pi.currency || 'eur');
    const customerEmail = sanitizeEmail(String((pi as any)?.receipt_email || ''));
    const errorMsg = String((pi as any)?.last_payment_error?.message || 'Payment failed');

    try {
      const failedKey = 'failed_purchases';
      const failed = (await dbGet<Array<any>>(failedKey)) || [];
      failed.push({
        paymentIntentId: pi.id,
        steamId: steamId || null,
        type: type || null,
        amount,
        currency,
        status: 'payment_failed',
        error: errorMsg,
        customerEmail: customerEmail || null,
        timestamp: new Date().toISOString(),
      });
      await dbSet(failedKey, failed.slice(-200));
    } catch {
    }

    const baseUrl = String(process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online');
    const ctaUrl = type === 'pro' ? `${baseUrl}/pro` : `${baseUrl}/shop`;

    if (customerEmail) {
      void sendPaymentProblemEmailSafe({
        to: customerEmail,
        subject: 'Payment failed',
        title: 'Payment failed',
        body: 'Your payment could not be completed. Please try again or use a different payment method.',
        ctaLabel: 'Try again',
        ctaUrl,
      });
    }

    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
