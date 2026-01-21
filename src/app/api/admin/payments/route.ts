import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { sendEmail } from '@/app/utils/email';
import { sanitizeEmail } from '@/app/utils/sanitize';

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
  invoiceUrl: string | null;
  invoicePdf: string | null;
  invoiceNumber: string | null;
  sessionId: string | null;
  paymentIntentId: string | null;
  error: string | null;
  emailResentAt: string | null;
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
    invoiceUrl: p?.invoiceUrl ? String(p.invoiceUrl) : null,
    invoicePdf: p?.invoicePdf ? String(p.invoicePdf) : null,
    invoiceNumber: p?.invoiceNumber ? String(p.invoiceNumber) : null,
    sessionId,
    paymentIntentId: p?.paymentIntentId ? String(p.paymentIntentId) : null,
    error: p?.error ? String(p.error) : null,
    emailResentAt: p?.emailResentAt ? asIso(p.emailResentAt) : null,
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
    invoiceUrl: f?.invoiceUrl ? String(f.invoiceUrl) : null,
    invoicePdf: f?.invoicePdf ? String(f.invoicePdf) : null,
    invoiceNumber: f?.invoiceNumber ? String(f.invoiceNumber) : null,
    sessionId,
    paymentIntentId,
    error: f?.error ? String(f.error) : null,
    emailResentAt: f?.emailResentAt ? asIso(f.emailResentAt) : null,
  };
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

async function sendResendEmail(args: {
  to: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  const to = sanitizeEmail(args.to);
  if (!to) return { ok: false, error: 'Invalid email' };

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#0b0d12; padding:24px">
      <div style="max-width:560px; margin:0 auto; background:#11141d; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:24px; color:#fff">
        <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#9ca3af; font-weight:800">Skinvaults</div>
        <h1 style="margin:10px 0 0; font-size:22px; letter-spacing:-0.02em">${args.title}</h1>
        <p style="margin:12px 0 0; color:#cbd5e1; font-size:14px; line-height:1.5">${args.body}</p>
        <div style="margin-top:18px">
          <a href="${args.ctaUrl}" target="_blank" rel="noreferrer" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; font-size:12px; padding:12px 16px; border-radius:14px">${args.ctaLabel}</a>
        </div>
        <p style="margin:18px 0 0; color:#64748b; font-size:12px">If you didn’t request this, please contact support.</p>
      </div>
    </div>
  `;

  return await sendEmail({
    to,
    subject: args.subject,
    html,
  });
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

    const purchases = (await dbGet<Array<any>>('purchase_history', false)) || [];
    const failed = (await dbGet<Array<any>>('failed_purchases', false)) || [];

    let rows: PaymentRow[] = [];
    rows = rows.concat(purchases.filter(Boolean).map(normalizePaid));
    rows = rows.concat(failed.filter(Boolean).map(normalizeFailed));

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

    if (action !== 'resend_email') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (!id || !id.includes(':')) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const [kind, rawId] = id.split(':', 2);
    const baseUrl = String(process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online');

    if (kind === 'paid') {
      const purchases = (await dbGet<Array<any>>('purchase_history', false)) || [];
      const purchase = purchases.find((p) => String(p?.sessionId || '').trim() === rawId);
      if (!purchase) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

      const to = sanitizeEmail(String(purchase?.customerEmail || ''));
      if (!to) return NextResponse.json({ error: 'Missing customer email' }, { status: 400 });

      const href = String(purchase?.receiptUrl || purchase?.invoiceUrl || purchase?.invoicePdf || '').trim();
      const ctaUrl = href || (purchase?.type === 'pro' ? `${baseUrl}/pro` : `${baseUrl}/shop`);

      const result = await sendResendEmail({
        to,
        subject: 'Your receipt',
        title: 'Receipt resend',
        body: 'Here is a fresh copy of your receipt / invoice link.',
        ctaLabel: href ? 'Open receipt' : 'Open shop',
        ctaUrl,
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
      }

      const ts = new Date().toISOString();
      await patchPurchase(rawId, { emailResentAt: ts });

      return NextResponse.json({ ok: true });
    }

    if (kind === 'failed') {
      const failed = (await dbGet<Array<any>>('failed_purchases', false)) || [];
      const record = failed.find((p) => {
        const key = String(p?.sessionId || p?.paymentIntentId || p?._id || p?.id || '').trim();
        return key === rawId;
      });
      if (!record) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

      const to = sanitizeEmail(String(record?.customerEmail || ''));
      if (!to) return NextResponse.json({ error: 'Missing customer email' }, { status: 400 });

      const status = String(record?.status || '').trim();
      const ctaUrl = record?.type === 'pro' ? `${baseUrl}/pro` : `${baseUrl}/shop`;

      const result = await sendResendEmail({
        to,
        subject: status === 'expired' ? 'Payment expired' : 'Payment failed',
        title: status === 'expired' ? 'Your checkout expired' : 'Payment failed',
        body:
          status === 'expired'
            ? 'Your payment was not completed in time, so the checkout expired. You can try again using the button below.'
            : 'Your payment could not be completed. Please try again or use a different payment method.',
        ctaLabel: 'Try again',
        ctaUrl,
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
      }

      const ts = new Date().toISOString();
      await patchFailed(rawId, { emailResentAt: ts });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to resend email:', error);
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
