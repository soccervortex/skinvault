import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { dbGet } from '@/app/utils/database';
import { sanitizeEmail } from '@/app/utils/sanitize';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { OWNER_STEAM_IDS } from '@/app/utils/owner-ids';

export const runtime = 'nodejs';

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
  feeAmount: number | null;
  netAmount: number;
  currency: string;
  customerEmail: string | null;
  promoCode: string | null;
  promoCodeId: string | null;
  couponId: string | null;
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

  const amount = Number(p?.amount || 0);
  const currency = String(p?.currency || 'eur');
  const fee = Number(p?.feeAmount);
  const netStored = Number(p?.netAmount);

  const feeAmount = Number.isFinite(fee) ? fee : null;
  const netAmount = Number.isFinite(netStored) ? netStored : Number.isFinite(fee) ? amount - fee : amount;

  return {
    id: `paid:${sessionId || String(p?._id || p?.id || '').trim() || String(Math.random())}`,
    kind: 'paid',
    status,
    type: p?.type ? String(p.type) : null,
    steamId: p?.steamId ? String(p.steamId) : null,
    timestamp: asIso(p?.timestamp),
    amount,
    feeAmount,
    netAmount,
    currency,
    customerEmail: p?.customerEmail ? sanitizeEmail(String(p.customerEmail)) : null,
    promoCode: p?.promoCode ? String(p.promoCode) : null,
    promoCodeId: p?.promoCodeId ? String(p.promoCodeId) : null,
    couponId: p?.couponId ? String(p.couponId) : null,
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

function addMoney(map: Record<string, number>, currency: string, amount: number) {
  const cur = String(currency || 'eur').toLowerCase();
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return;
  map[cur] = Number((map[cur] || 0) + n);
}

function addStakeholder(
  stakeholders: Record<string, { steamId: string; role: string; totalByCurrency: Record<string, number> }>,
  steamId: string | null,
  role: string,
  currency: string,
  amount: number
) {
  const sid = String(steamId || '').trim();
  if (!/^\d{17}$/.test(sid)) return;
  const n = Number(amount || 0);
  if (!Number.isFinite(n) || n === 0) return;
  const existing = stakeholders[sid];
  if (!existing) {
    const totalByCurrency: Record<string, number> = {};
    addMoney(totalByCurrency, currency, n);
    stakeholders[sid] = { steamId: sid, role, totalByCurrency };
    return;
  }
  if (existing.role !== role) existing.role = 'multiple';
  addMoney(existing.totalByCurrency, currency, n);
}

async function readCreatorsFromDb(): Promise<Array<{ slug: string; partnerSteamId?: string }>> {
  const stored = (await dbGet<any[]>('creators_v1', false)) || [];
  const list = Array.isArray(stored) ? stored : [];
  return list
    .map((c: any) => ({ slug: String(c?.slug || ''), partnerSteamId: c?.partnerSteamId ? String(c.partnerSteamId) : undefined }))
    .filter((c) => !!String(c.slug || '').trim());
}

function monthKeyForDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function parseMonthKey(raw: any): string {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return monthKeyForDate(new Date());
}

function monthRangeUtc(monthKey: string): { start: Date; end: Date } {
  const [yRaw, mRaw] = monthKey.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, end };
}

function normalizeCurrency(raw: any): string {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'eur';
  return s;
}

function safePct(raw: any): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, n);
}

function defaultConversionFeePct(currency: string): number {
  const cur = normalizeCurrency(currency);
  if (!cur || cur === 'eur') return 0;
  const envRaw = process.env.PAYOUT_DEFAULT_CONVERSION_FEE_PCT;
  const envN = Number(String(envRaw ?? '').replace(',', '.'));
  if (Number.isFinite(envN) && envN >= 0 && envN <= 100) return envN;
  return 10.3;
}

function prevMonthKey(monthKey: string): string {
  const [yRaw, mRaw] = String(monthKey || '').split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKeyForDate(new Date());
  const d = new Date(Date.UTC(y, m - 2, 1, 0, 0, 0, 0));
  return monthKeyForDate(d);
}

function monthKeyToIsoDate(monthKey: string): string {
  const { start } = monthRangeUtc(monthKey);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + 1;
  const d = start.getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function fetchFrankfurterRates(dateIso: string, currencies: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(currencies.map((c) => normalizeCurrency(c)).filter((c) => c && c !== 'eur'))).sort();
  if (unique.length === 0) return {};

  const url = `https://api.frankfurter.app/${encodeURIComponent(dateIso)}?from=EUR&to=${encodeURIComponent(unique.join(','))}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return {};
  const json: any = await res.json().catch(() => null);
  const ratesRaw = json?.rates && typeof json.rates === 'object' ? json.rates : null;
  if (!ratesRaw) return {};

  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(ratesRaw)) {
    const cur = normalizeCurrency(k);
    const n = Number(v);
    if (!cur || cur === 'eur' || !Number.isFinite(n) || n <= 0) continue;
    out[cur] = n;
  }
  return out;
}

export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const url = new URL(request.url);
    const monthKey = parseMonthKey(url.searchParams.get('month'));
    const { start, end } = monthRangeUtc(monthKey);

    const purchases = (await dbGet<Array<any>>('purchase_history', false)) || [];

    let paidRows = purchases.filter(Boolean);
    paidRows = paidRows.filter((p) => p?.hidden !== true);
    paidRows = paidRows.filter((p) => {
      const ts = new Date(String(p?.timestamp || '')).getTime();
      if (!Number.isFinite(ts)) return false;
      return ts >= start.getTime() && ts < end.getTime();
    });

    const ownerSteamId = OWNER_STEAM_IDS?.[0] ? String(OWNER_STEAM_IDS[0]) : null;
    const coOwnerSteamId = OWNER_STEAM_IDS?.[1] ? String(OWNER_STEAM_IDS[1]) : null;

    const db = await getDatabase();

    const paidSteamIds: string[] = [];
    for (const p of paidRows) {
      const sid = String(p?.steamId || '').trim();
      if (/^\d{17}$/.test(sid)) paidSteamIds.push(sid);
    }
    const uniquePaidSteamIds = Array.from(new Set(paidSteamIds));

    const referralByUser = new Map<string, string>();
    const refSlugByUser = new Map<string, string>();
    const partnerByRefSlug = new Map<string, string>();

    try {
      const creators = await readCreatorsFromDb();
      for (const c of creators as any[]) {
        const slug = String(c?.slug || '').trim().toLowerCase();
        const psid = String(c?.partnerSteamId || '').trim();
        if (slug && /^\d{17}$/.test(psid)) partnerByRefSlug.set(slug, psid);
      }
    } catch {
    }

    if (uniquePaidSteamIds.length > 0) {
      try {
        const referrals = await db
          .collection('affiliate_referrals')
          .find({ _id: { $in: uniquePaidSteamIds } } as any, { projection: { _id: 1, referrerSteamId: 1 } } as any)
          .toArray();

        for (const r of referrals as any[]) {
          const user = String(r?._id || '').trim();
          const referrer = String(r?.referrerSteamId || '').trim();
          if (user && /^\d{17}$/.test(referrer)) referralByUser.set(user, referrer);
        }

        const attributions = await db
          .collection('creator_attribution')
          .find({ steamId: { $in: uniquePaidSteamIds } } as any, { projection: { steamId: 1, refSlug: 1 } } as any)
          .toArray();

        for (const a of attributions as any[]) {
          const user = String(a?.steamId || '').trim();
          const slug = String(a?.refSlug || '').trim().toLowerCase();
          if (user && slug) refSlugByUser.set(user, slug);
        }
      } catch {
      }
    }

    const stakeholders: Record<string, { steamId: string; role: string; totalByCurrency: Record<string, number> }> = {};

    for (const p of paidRows) {
      const row = normalizePaid(p);
      if (row.kind !== 'paid' || row.status !== 'paid') continue;

      const cur = String(row.currency || 'eur');
      const gross = Number(row.amount || 0);
      const net = Number(row.netAmount || 0);
      if (!Number.isFinite(net)) continue;

      const buyerSteamId = String(row.steamId || '').trim();
      const base = Math.max(0, net);

      let partnerCommission = 0;
      let futurePartnerCommission = 0;

      const eligibleForCommissions = gross >= 10;

      if (/^\d{17}$/.test(buyerSteamId) && base > 0) {
        const referrerSteamId = referralByUser.get(buyerSteamId) || null;
        if (referrerSteamId && eligibleForCommissions) {
          futurePartnerCommission = base * 0.1;
          addStakeholder(stakeholders, referrerSteamId, 'future_partner', cur, futurePartnerCommission);
        }

        const slug = refSlugByUser.get(buyerSteamId) || null;
        const partnerSteamId = slug ? partnerByRefSlug.get(slug) || null : null;
        const partnerEligible = !!(partnerSteamId && eligibleForCommissions);
        if (partnerEligible) {
          partnerCommission = base * 0.15;
          addStakeholder(stakeholders, partnerSteamId, 'partner', cur, partnerCommission);
        }
      }

      const commissionsTotal = Math.min(base, Math.max(0, partnerCommission + futurePartnerCommission));
      const remaining = Math.max(0, base - commissionsTotal);

      if (ownerSteamId) {
        const amt = remaining * 0.7;
        addStakeholder(stakeholders, ownerSteamId, 'owner', cur, amt);
      }
      if (coOwnerSteamId) {
        const amt = remaining * 0.3;
        addStakeholder(stakeholders, coOwnerSteamId, 'co_owner', cur, amt);
      }
    }

    const stakeholderIds = Object.keys(stakeholders);

    const stakeholdersCol = db.collection('payout_stakeholders');
    const fxCol = db.collection('payout_fx_rates');
    const paymentsCol = db.collection('payout_monthly_payments');

    const savedStakeholders: any[] = await stakeholdersCol
      .find({}, { projection: { _id: 0, steamId: 1, displayName: 1, payoutCurrency: 1, conversionFeePct: 1, createdAt: 1, updatedAt: 1 } } as any)
      .toArray();

    const allSteamIds = Array.from(new Set<string>([...stakeholderIds, ...savedStakeholders.map((s) => String(s?.steamId || '').trim())].filter((s) => /^\d{17}$/.test(s))));

    const fxDocs: any[] = await fxCol
      .find({ monthKey } as any, { projection: { _id: 0, monthKey: 1, currency: 1, rateEurToCurrency: 1 } } as any)
      .toArray();

    const fxByCurrency = new Map<string, number>();
    for (const f of fxDocs) {
      const cur = normalizeCurrency(f?.currency);
      const rate = Number(f?.rateEurToCurrency);
      if (!cur || !Number.isFinite(rate) || rate <= 0) continue;
      fxByCurrency.set(cur, rate);
    }

    const partnerSteamIds = new Set<string>(Array.from(partnerByRefSlug.values()).map((v) => String(v).trim()));

    const neededFxCurrencies = new Set<string>();
    for (const s of savedStakeholders) {
      const c = normalizeCurrency(s?.payoutCurrency);
      if (c && c !== 'eur') neededFxCurrencies.add(c);
    }
    for (const c of Array.from(neededFxCurrencies.values())) {
      if (!fxByCurrency.has(c)) {
        const prevKey = prevMonthKey(monthKey);
        if (prevKey && prevKey !== monthKey) {
          const prev = await fxCol.findOne({ _id: `${prevKey}:${c}` } as any, { projection: { rateEurToCurrency: 1 } } as any);
          const pr = Number((prev as any)?.rateEurToCurrency);
          if (Number.isFinite(pr) && pr > 0) fxByCurrency.set(c, pr);
        }
      }
    }

    const missingCurrencies = Array.from(neededFxCurrencies.values()).filter((c) => c !== 'eur' && !fxByCurrency.has(c));
    if (missingCurrencies.length > 0) {
      try {
        const dateIso = monthKeyToIsoDate(monthKey);
        const fetched = await fetchFrankfurterRates(dateIso, missingCurrencies);
        const now = new Date();
        for (const [cur, rate] of Object.entries(fetched)) {
          if (!cur || !Number.isFinite(rate) || rate <= 0) continue;
          fxByCurrency.set(cur, rate);
          const docId = `${monthKey}:${cur}`;
          await fxCol.updateOne(
            { _id: docId } as any,
            {
              $set: {
                monthKey,
                currency: cur,
                rateEurToCurrency: rate,
                updatedAt: now,
              },
              $setOnInsert: { createdAt: now },
            } as any,
            { upsert: true }
          );
        }
      } catch {
      }
    }

    const paymentDocs: any[] = await paymentsCol
      .find(
        { monthKey, steamId: { $in: allSteamIds } } as any,
        { projection: { monthKey: 1, steamId: 1, amount: 1, currency: 1, note: 1, createdAt: 1 } } as any
      )
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    const paidBySteamId: Record<
      string,
      Array<{ id: string; amount: number; currency: string; note: string | null; createdAt: string | null }>
    > = {};
    for (const p of paymentDocs) {
      const sid = String(p?.steamId || '').trim();
      if (!paidBySteamId[sid]) paidBySteamId[sid] = [];
      paidBySteamId[sid].push({
        id: String(p?._id || ''),
        amount: Number(p?.amount || 0),
        currency: normalizeCurrency(p?.currency),
        note: p?.note ? String(p.note) : null,
        createdAt: p?.createdAt ? new Date(p.createdAt).toISOString() : null,
      });
    }

    const savedBySteamId = new Map<string, any>();
    for (const s of savedStakeholders) {
      const sid = String(s?.steamId || '').trim();
      if (!/^\d{17}$/.test(sid)) continue;
      savedBySteamId.set(sid, {
        steamId: sid,
        displayName: s?.displayName ? String(s.displayName) : '',
        payoutCurrency: normalizeCurrency(s?.payoutCurrency || 'eur'),
        conversionFeePct: safePct(s?.conversionFeePct),
      });
    }

    const rows = allSteamIds
      .map((sid) => {
        const computed = stakeholders[sid] || null;
        const saved = savedBySteamId.get(sid) || null;
        const role = computed?.role
          ? String(computed.role)
          : ownerSteamId && sid === ownerSteamId
            ? 'owner'
            : coOwnerSteamId && sid === coOwnerSteamId
              ? 'co_owner'
              : partnerSteamIds.has(sid)
                ? 'partner'
                : 'unknown';

        const totalByCurrency: Record<string, number> = computed?.totalByCurrency || {};
        const owedEur = Number(totalByCurrency?.eur || 0);

        const payoutCurrency = normalizeCurrency(saved?.payoutCurrency || 'eur');
        const feePct = defaultConversionFeePct(payoutCurrency);
        const rate = payoutCurrency === 'eur' ? 1 : fxByCurrency.get(payoutCurrency) || null;

        const grossPayout = rate && Number.isFinite(owedEur) ? owedEur * rate : null;
        const conversionFee = grossPayout != null ? grossPayout * (feePct / 100) : null;
        const netPayout = grossPayout != null ? Math.max(0, grossPayout - (conversionFee || 0)) : null;

        const payments = paidBySteamId[sid] || [];
        let paidEurEquivalent = 0;
        let paidInPayoutCurrency = 0;
        for (const pay of payments) {
          const amt = Number(pay.amount || 0);
          if (!Number.isFinite(amt) || amt === 0) continue;
          if (pay.currency === payoutCurrency) paidInPayoutCurrency += amt;
          if (pay.currency === 'eur') {
            paidEurEquivalent += amt;
          } else {
            const pr = fxByCurrency.get(pay.currency) || null;
            if (pr && pr > 0) paidEurEquivalent += amt / pr;
          }
        }

        const remainingEur = Math.max(0, owedEur - paidEurEquivalent);
        const remainingGrossPayout = rate ? remainingEur * rate : null;
        const remainingFee = remainingGrossPayout != null ? remainingGrossPayout * (feePct / 100) : null;
        const remainingNetPayout = remainingGrossPayout != null ? Math.max(0, remainingGrossPayout - (remainingFee || 0)) : null;

        return {
          steamId: sid,
          role,
          displayName: saved?.displayName ? String(saved.displayName) : '',
          payoutCurrency,
          conversionFeePct: feePct,
          fxRateEurToPayoutCurrency: rate,
          owedTotalByCurrency: totalByCurrency,
          owedEur,
          owedGrossPayoutCurrency: grossPayout,
          owedConversionFeePayoutCurrency: conversionFee,
          owedNetPayoutCurrency: netPayout,
          paidEntries: payments,
          paidEurEquivalent,
          paidInPayoutCurrency,
          remainingEur,
          remainingNetPayoutCurrency: remainingNetPayout,
        };
      })
      .sort((a, b) => {
        if (a.role !== b.role) return a.role.localeCompare(b.role);
        return a.steamId.localeCompare(b.steamId);
      });

    const res = NextResponse.json({
      ok: true,
      monthKey,
      fxRates: Object.fromEntries(Array.from(fxByCurrency.entries())),
      stakeholders: rows,
    });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load payouts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const body = await request.json().catch(() => null);
    const action = String(body?.action || '').trim();

    const db = await getDatabase();
    const stakeholdersCol = db.collection('payout_stakeholders');
    const fxCol = db.collection('payout_fx_rates');
    const paymentsCol = db.collection('payout_monthly_payments');

    if (action === 'upsert_stakeholder') {
      const steamId = String(body?.steamId || '').trim();
      if (!/^\d{17}$/.test(steamId)) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

      const displayName = String(body?.displayName || '').trim().slice(0, 40);
      const payoutCurrency = normalizeCurrency(body?.payoutCurrency || 'eur');
      const hasFee = Object.prototype.hasOwnProperty.call(body || {}, 'conversionFeePct');
      const conversionFeePct = hasFee ? safePct(body?.conversionFeePct) : defaultConversionFeePct(payoutCurrency);

      const now = new Date();
      await stakeholdersCol.updateOne(
        { steamId } as any,
        {
          $set: {
            steamId,
            displayName,
            payoutCurrency,
            conversionFeePct,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        } as any,
        { upsert: true }
      );

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === 'set_fx_rate') {
      const monthKey = parseMonthKey(body?.monthKey);
      const currency = normalizeCurrency(body?.currency);
      if (!currency || currency === 'eur') return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
      const rate = Number(body?.rateEurToCurrency);
      if (!Number.isFinite(rate) || rate <= 0) return NextResponse.json({ error: 'Invalid rate' }, { status: 400 });

      const now = new Date();
      const docId = `${monthKey}:${currency}`;
      await fxCol.updateOne(
        { _id: docId } as any,
        {
          $set: {
            monthKey,
            currency,
            rateEurToCurrency: rate,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        } as any,
        { upsert: true }
      );

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === 'add_payment') {
      const monthKey = parseMonthKey(body?.monthKey);
      const steamId = String(body?.steamId || '').trim();
      if (!/^\d{17}$/.test(steamId)) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

      const amount = Number(body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

      const currency = normalizeCurrency(body?.currency || 'eur');
      const note = String(body?.note || '').trim().slice(0, 120) || null;

      const now = new Date();
      await paymentsCol.insertOne({
        monthKey,
        steamId,
        amount,
        currency,
        note,
        createdAt: now,
      } as any);

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === 'delete_payment') {
      const idRaw = String(body?.id || '').trim();
      const monthKey = parseMonthKey(body?.monthKey);
      const steamId = String(body?.steamId || '').trim();
      if (!/^\d{17}$/.test(steamId)) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
      let oid: ObjectId;
      try {
        oid = new ObjectId(idRaw);
      } catch {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      }

      await paymentsCol.deleteOne({ _id: oid, monthKey, steamId } as any);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === 'delete_stakeholder') {
      const steamId = String(body?.steamId || '').trim();
      if (!/^\d{17}$/.test(steamId)) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

      await stakeholdersCol.deleteOne({ steamId } as any);
      await paymentsCol.deleteMany({ steamId } as any);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
