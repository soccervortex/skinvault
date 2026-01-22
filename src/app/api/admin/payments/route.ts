import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { sanitizeEmail } from '@/app/utils/sanitize';
import Stripe from 'stripe';

const ADMIN_HEADER = 'x-admin-key';

type PaymentStatus = 'paid' | 'payment_failed' | 'expired' | 'unfulfilled' | 'unknown';

type PaymentRow = {
  id: string;
  kind: 'paid' | 'failed';
  status: PaymentStatus;
  type: string | null;
  steamId: string | null;
  timestamp: string;
  amount: number;
  currency: string;
  customerEmail: string | null;
  receiptUrl: string | null;
  receiptNumber: string | null;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  invoiceNumber: string | null;
  sessionId: string | null;
  paymentIntentId: string | null;
  error: string | null;
  hidden: boolean;
  hiddenAt: string | null;
};

function asIso(ts: any): string {
  const s = String(ts || '').trim();
  if (!s) return new Date(0).toISOString();
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d.toISOString();
  return new Date(0).toISOString();
}

function normalizePaid(p: any): PaymentRow {
  const sessionId = String(p?.sessionId || '').trim() || null;
  const status: PaymentStatus = p?.fulfilled === false ? 'unfulfilled' : 'paid';

  return {
    id: `paid:${sessionId || String(p?._id || p?.id || '').trim() || String(Math.random())}`,
    kind: 'paid',
    status,
    type: p?.type ? String(p.type) : null,
    steamId: p?.steamId ? String(p.steamId) : null,
    timestamp: asIso(p?.timestamp),
    amount: Number(p?.amount || 0),
    currency: String(p?.currency || 'eur'),
    customerEmail: p?.customerEmail ? sanitizeEmail(String(p.customerEmail)) : null,
    receiptUrl: p?.receiptUrl ? String(p.receiptUrl) : null,
    receiptNumber: p?.receiptNumber ? String(p.receiptNumber) : null,
    invoiceUrl: p?.invoiceUrl ? String(p.invoiceUrl) : null,
    invoicePdf: p?.invoicePdf ? String(p.invoicePdf) : null,
    invoiceNumber: p?.invoiceNumber ? String(p.invoiceNumber) : null,
    sessionId,
    paymentIntentId: p?.paymentIntentId ? String(p.paymentIntentId) : null,
    error: p?.error ? String(p.error) : null,
    hidden: p?.hidden === true,
    hiddenAt: p?.hiddenAt ? asIso(p.hiddenAt) : null,
  };
}

function normalizeFailed(f: any): PaymentRow {
  const sessionId = String(f?.sessionId || '').trim() || null;
  const paymentIntentId = String(f?.paymentIntentId || '').trim() || null;

  let status: PaymentStatus = 'unknown';
  const raw = String(f?.status || '').trim();
  if (raw === 'expired') status = 'expired';
  else if (raw === 'payment_failed') status = 'payment_failed';

  return {
    id: `failed:${sessionId || paymentIntentId || String(f?._id || f?.id || '').trim() || String(Math.random())}`,
    kind: 'failed',
    status,
    type: f?.type ? String(f.type) : null,
    steamId: f?.steamId ? String(f.steamId) : null,
    timestamp: asIso(f?.timestamp),
    amount: Number(f?.amount || 0),
    currency: String(f?.currency || 'eur'),
    customerEmail: f?.customerEmail ? sanitizeEmail(String(f.customerEmail)) : null,
    receiptUrl: f?.receiptUrl ? String(f.receiptUrl) : null,
    receiptNumber: f?.receiptNumber ? String(f.receiptNumber) : null,
    invoiceUrl: f?.invoiceUrl ? String(f.invoiceUrl) : null,
    invoicePdf: f?.invoicePdf ? String(f.invoicePdf) : null,
    invoiceNumber: f?.invoiceNumber ? String(f.invoiceNumber) : null,
    sessionId,
    paymentIntentId,
    error: f?.error ? String(f.error) : null,
    hidden: f?.hidden === true,
    hiddenAt: f?.hiddenAt ? asIso(f.hiddenAt) : null,
  };
}

function parseBool(value: any): boolean {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function getStripeSecretKeyFromRecord(record: any): string | null {
  const recordTest = parseBool(record?.testMode);
  if (recordTest) {
    return process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || null;
  }
  return process.env.STRIPE_SECRET_KEY || null;
}

function createStripe(secretKey: string): Stripe {
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

async function getReceiptPatchFromPaymentIntent(
  stripe: Stripe,
  paymentIntentId: string
): Promise<Record<string, any>> {
  try {
    const out: Record<string, any> = {};
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });

    const receiptEmail = sanitizeEmail(String((pi as any)?.receipt_email || ''));
    if (receiptEmail) out.customerEmail = receiptEmail;

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

async function patchPurchase(sessionId: string, patch: Record<string, any>) {
  const purchasesKey = 'purchase_history';
  const purchases = (await dbGet<Array<any>>(purchasesKey, false)) || [];
  let updated = false;
  const next = purchases.map((p) => {
    if (!p || updated) return p;
    if (String(p.sessionId || '').trim() !== sessionId) return p;
    updated = true;
    return { ...p, ...patch };
  });
  if (updated) {
    await dbSet(purchasesKey, next.slice(-1000));
  }
}

async function patchFailed(id: string, patch: Record<string, any>) {
  const failedKey = 'failed_purchases';
  const failed = (await dbGet<Array<any>>(failedKey, false)) || [];
  let updated = false;
  const next = failed.map((p) => {
    if (!p || updated) return p;
    const key = String(p.sessionId || p.paymentIntentId || p._id || p.id || '').trim();
    if (key !== id) return p;
    updated = true;
    return { ...p, ...patch };
  });
  if (updated) {
    await dbSet(failedKey, next.slice(-200));
  }
}

export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const filterSteamId = String(url.searchParams.get('steamId') || '').trim();
    const filterType = String(url.searchParams.get('type') || '').trim();
    const filterStatus = String(url.searchParams.get('status') || '').trim();
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const includeHidden = parseBool(url.searchParams.get('includeHidden'));
    const statsOnly = parseBool(url.searchParams.get('statsOnly'));

    const purchases = (await dbGet<Array<any>>('purchase_history', false)) || [];
    const failed = (await dbGet<Array<any>>('failed_purchases', false)) || [];

    if (statsOnly) {
      let paidRows = purchases.filter(Boolean);
      if (!includeHidden) {
        paidRows = paidRows.filter((p) => p?.hidden !== true);
      }
      if (filterSteamId) {
        paidRows = paidRows.filter((p) => String(p?.steamId || '').trim() === filterSteamId);
      }
      if (filterType) {
        paidRows = paidRows.filter((p) => String(p?.type || '').trim() === filterType);
      }

      let paidCount = 0;
      const paidTotalByCurrency: Record<string, number> = {};
      for (const p of paidRows) {
        const row = normalizePaid(p);
        if (row.kind !== 'paid' || row.status !== 'paid') continue;
        paidCount += 1;
        const cur = String(row.currency || 'eur').toLowerCase();
        const amount = Number(row.amount || 0);
        if (!Number.isFinite(amount)) continue;
        paidTotalByCurrency[cur] = Number((paidTotalByCurrency[cur] || 0) + amount);
      }

      const res = NextResponse.json({
        paidCount,
        paidTotalByCurrency,
      });
      res.headers.set('cache-control', 'no-store');
      return res;
    }

    let rows: PaymentRow[] = [];
    rows = rows.concat(purchases.filter(Boolean).map(normalizePaid));
    rows = rows.concat(failed.filter(Boolean).map(normalizeFailed));

    if (!includeHidden) {
      rows = rows.filter((r) => r.hidden !== true);
    }

    if (filterSteamId) {
      rows = rows.filter((r) => String(r.steamId || '').trim() === filterSteamId);
    }

    if (filterType) {
      rows = rows.filter((r) => String(r.type || '').trim() === filterType);
    }

    if (filterStatus && filterStatus !== 'all') {
      if (filterStatus === 'paid') {
        rows = rows.filter((r) => r.kind === 'paid' && r.status === 'paid');
      } else if (filterStatus === 'unfulfilled') {
        rows = rows.filter((r) => r.kind === 'paid' && r.status === 'unfulfilled');
      } else {
        rows = rows.filter((r) => r.status === filterStatus);
      }
    }

    if (q) {
      rows = rows.filter((r) => {
        const hay = [
          r.id,
          r.kind,
          r.status,
          r.type || '',
          r.steamId || '',
          r.customerEmail || '',
          r.sessionId || '',
          r.paymentIntentId || '',
          r.invoiceNumber || '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const res = NextResponse.json({ payments: rows });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error) {
    console.error('Failed to get payments:', error);
    return NextResponse.json({ error: 'Failed to get payments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const id = String(body?.id || '').trim();

    if (!id || !id.includes(':')) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const [kind, rawId] = id.split(':', 2);

    if (action === 'set_hidden') {
      const hidden = body?.hidden === true;
      const ts = new Date().toISOString();
      const patch = hidden ? { hidden: true, hiddenAt: ts } : { hidden: false, hiddenAt: null };

      if (kind === 'paid') {
        await patchPurchase(rawId, patch);
        return NextResponse.json({ ok: true });
      }
      if (kind === 'failed') {
        await patchFailed(rawId, patch);
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    if (action === 'update_fields') {
      const nextPatch: Record<string, any> = {};
      if ('customerEmail' in body) {
        const em = sanitizeEmail(String(body?.customerEmail || ''));
        nextPatch.customerEmail = em || null;
      }
      if ('receiptUrl' in body) {
        nextPatch.receiptUrl = String(body?.receiptUrl || '').trim() || null;
      }
      if ('invoiceUrl' in body) {
        nextPatch.invoiceUrl = String(body?.invoiceUrl || '').trim() || null;
      }
      if ('invoicePdf' in body) {
        nextPatch.invoicePdf = String(body?.invoicePdf || '').trim() || null;
      }
      if ('invoiceNumber' in body) {
        nextPatch.invoiceNumber = String(body?.invoiceNumber || '').trim() || null;
      }

      if (Object.keys(nextPatch).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      if (kind === 'paid') {
        await patchPurchase(rawId, nextPatch);
        return NextResponse.json({ ok: true });
      }
      if (kind === 'failed') {
        await patchFailed(rawId, nextPatch);
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    if (action === 'refresh_stripe') {
      const purchases = (await dbGet<Array<any>>('purchase_history', false)) || [];
      const failed = (await dbGet<Array<any>>('failed_purchases', false)) || [];

      let record: any = null;
      if (kind === 'paid') {
        record = purchases.find((p) => String(p?.sessionId || '').trim() === rawId);
      } else if (kind === 'failed') {
        record = failed.find((p) => {
          const key = String(p?.sessionId || p?.paymentIntentId || p?._id || p?.id || '').trim();
          return key === rawId;
        });
      }

      if (!record) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

      const secretKey = getStripeSecretKeyFromRecord(record);
      if (!secretKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
      const stripe = createStripe(secretKey);

      let patch: Record<string, any> = {};
      if (kind === 'paid') {
        const sessionId = String(record?.sessionId || rawId).trim();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const invoicePatch = await getInvoicePatch(stripe, session);
        const receiptPatch = await getReceiptPatch(stripe, session);
        patch = { ...invoicePatch, ...receiptPatch };
      } else {
        const sessionId = String(record?.sessionId || '').trim();
        const paymentIntentId = String(record?.paymentIntentId || '').trim();
        if (sessionId) {
          const session = await stripe.checkout.sessions.retrieve(sessionId);
          const invoicePatch = await getInvoicePatch(stripe, session);
          const receiptPatch = await getReceiptPatch(stripe, session);
          patch = { ...invoicePatch, ...receiptPatch };
        } else if (paymentIntentId) {
          patch = await getReceiptPatchFromPaymentIntent(stripe, paymentIntentId);
        }
      }

      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ ok: true, updated: false });
      }

      if (kind === 'paid') {
        await patchPurchase(rawId, patch);
      } else {
        await patchFailed(rawId, patch);
      }

      return NextResponse.json({ ok: true, updated: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to update payment:', error);
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
