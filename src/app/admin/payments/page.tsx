"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import { ArrowLeft, ExternalLink, Eye, EyeOff, Loader2, Pencil, RefreshCw, Save, Search, X } from 'lucide-react';

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

type StripeBalanceTransactionsBreakdown = {
  netTotalByCurrency: Record<string, number>;
  feeTotalByCurrency: Record<string, number>;
  netByType: Array<{ type: string; totalByCurrency: Record<string, number> }>;
};

export default function AdminPaymentsPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [loadingUserCount, setLoadingUserCount] = useState(true);
  const [totals, setTotals] = useState<{ total: number; active: number; expired: number }>({ total: 0, active: 0, expired: 0 });
  const [loadingProStats, setLoadingProStats] = useState(true);
  const [paymentsCount, setPaymentsCount] = useState<number>(0);
  const [loadingPaymentsCount, setLoadingPaymentsCount] = useState(true);
  const [paidTotalByCurrency, setPaidTotalByCurrency] = useState<Record<string, number>>({});
  const [stripePayoutsPaidTotalByCurrency, setStripePayoutsPaidTotalByCurrency] = useState<Record<string, number>>({});
  const [stripePayoutsInTransitTotalByCurrency, setStripePayoutsInTransitTotalByCurrency] = useState<Record<string, number>>({});
  const [stripeBalanceTransactions, setStripeBalanceTransactions] = useState<StripeBalanceTransactionsBreakdown | null>(null);
  const [backfillingFees, setBackfillingFees] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('');
  const [steamId, setSteamId] = useState<string>('');
  const [promo, setPromo] = useState<string>('');
  const [coupon, setCoupon] = useState<string>('');
  const [q, setQ] = useState<string>('');

  const [includeHidden, setIncludeHidden] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editCustomerEmail, setEditCustomerEmail] = useState('');
  const [editReceiptUrl, setEditReceiptUrl] = useState('');
  const [editInvoiceUrl, setEditInvoiceUrl] = useState('');
  const [editInvoicePdf, setEditInvoicePdf] = useState('');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');

  const [periodDays, setPeriodDays] = useState<'all' | '7' | '30'>('all');
  const [showStripeAdvanced, setShowStripeAdvanced] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const load = async () => {
    if (!userIsOwner) return;
    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (type) qs.set('type', type);
      if (steamId) qs.set('steamId', steamId);
      if (promo) qs.set('promo', promo);
      if (coupon) qs.set('coupon', coupon);
      if (q) qs.set('q', q);
      if (includeHidden) qs.set('includeHidden', '1');
      if (periodDays !== 'all') qs.set('days', periodDays);

      const res = await fetch(`/api/admin/payments?${qs.toString()}`, {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(String(json?.error || 'Failed to load payments'));
      }

      setPayments(Array.isArray(json?.payments) ? json.payments : []);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load payments'));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrencyAmount = (amount: number, currency: string) => {
    const cur = String(currency || 'eur').toUpperCase();
    const n = Number(amount || 0);
    if (!Number.isFinite(n)) return `0 ${cur}`;
    try {
      return new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency: cur,
        maximumFractionDigits: 2,
      })
        .format(n)
        .replaceAll('\u00A0', '');
    } catch {
      return `${n.toFixed(2)} ${cur}`;
    }
  };

  const paidTotalLabel = useMemo(() => {
    const entries = Object.entries(paidTotalByCurrency || {}).filter(([, v]) => Number.isFinite(Number(v)));
    if (entries.length === 0) return formatCurrencyAmount(0, 'eur');
    return entries
      .map(([cur, amt]) => formatCurrencyAmount(Number(amt || 0), cur))
      .join(' / ');
  }, [paidTotalByCurrency]);

  const stripePayoutsPaidLabel = useMemo(() => {
    const entries = Object.entries(stripePayoutsPaidTotalByCurrency || {}).filter(([, v]) => Number.isFinite(Number(v)));
    if (entries.length === 0) return formatCurrencyAmount(0, 'eur');
    return entries
      .map(([cur, amt]) => formatCurrencyAmount(Number(amt || 0), cur))
      .join(' / ');
  }, [stripePayoutsPaidTotalByCurrency]);

  const stripePayoutsInTransitLabel = useMemo(() => {
    const entries = Object.entries(stripePayoutsInTransitTotalByCurrency || {}).filter(([, v]) => Number.isFinite(Number(v)));
    if (entries.length === 0) return formatCurrencyAmount(0, 'eur');
    return entries
      .map(([cur, amt]) => formatCurrencyAmount(Number(amt || 0), cur))
      .join(' / ');
  }, [stripePayoutsInTransitTotalByCurrency]);

  const formatCurrencyMapLabel = (m: any) => {
    const entries = Object.entries((m || {}) as Record<string, number>).filter(([, v]) => Number.isFinite(Number(v)));
    if (entries.length === 0) return formatCurrencyAmount(0, 'eur');
    return entries
      .map(([cur, amt]) => formatCurrencyAmount(Number(amt || 0), cur))
      .join(' / ');
  };

  const stripeBalanceNetLabel = useMemo(() => formatCurrencyMapLabel(stripeBalanceTransactions?.netTotalByCurrency), [stripeBalanceTransactions]);
  const stripeBalanceFeeLabel = useMemo(() => formatCurrencyMapLabel(stripeBalanceTransactions?.feeTotalByCurrency), [stripeBalanceTransactions]);

  const netRevenueLabel = useMemo(() => {
    const byCur = stripeBalanceTransactions?.netTotalByCurrency || null;
    const entries = Object.entries((byCur || {}) as Record<string, number>).filter(([, v]) => Number.isFinite(Number(v)));
    if (entries.length === 0) return paidTotalLabel;
    return stripeBalanceNetLabel;
  }, [paidTotalLabel, stripeBalanceNetLabel, stripeBalanceTransactions]);

  const backfillMissingFees = async () => {
    if (!userIsOwner) return;
    setBackfillingFees(true);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action: 'backfill_missing_fees', limit: 25 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      toast.success(`Backfill done: updated ${Number(json?.updated || 0)} / scanned ${Number(json?.scanned || 0)}`);
      await loadPaymentsCount();
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed'));
    } finally {
      setBackfillingFees(false);
    }
  };

  const loadUserCount = async () => {
    if (!userIsOwner) return;
    setLoadingUserCount(true);
    try {
      const res = await fetch('/api/admin/user-count', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      setTotalUsers(Number((json as any)?.totalUsers || 0));
    } catch {
    } finally {
      setLoadingUserCount(false);
    }
  };

  const loadProStats = async () => {
    if (!userIsOwner) return;
    setLoadingProStats(true);
    try {
      const res = await fetch('/api/admin/pro/stats', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      setTotals({
        total: Number((json as any)?.total || 0),
        active: Number((json as any)?.active || 0),
        expired: Number((json as any)?.expired || 0),
      });
    } catch {
    } finally {
      setLoadingProStats(false);
    }
  };

  const loadPaymentsCount = async () => {
    if (!userIsOwner) return;
    setLoadingPaymentsCount(true);
    try {
      const qs = new URLSearchParams();
      qs.set('statsOnly', '1');
      if (periodDays !== 'all') qs.set('days', periodDays);
      const res = await fetch(`/api/admin/payments?${qs.toString()}`, {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      setPaymentsCount(Number((json as any)?.paidCount || 0));
      setPaidTotalByCurrency(((json as any)?.paidTotalByCurrency as Record<string, number>) || {});
      setStripePayoutsPaidTotalByCurrency(((json as any)?.stripePayoutsPaidTotalByCurrency as Record<string, number>) || {});
      setStripePayoutsInTransitTotalByCurrency(((json as any)?.stripePayoutsInTransitTotalByCurrency as Record<string, number>) || {});
      setStripeBalanceTransactions(((json as any)?.stripeBalanceTransactions as StripeBalanceTransactionsBreakdown) || null);
    } catch {
    } finally {
      setLoadingPaymentsCount(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;
    if (!userIsOwner) return;
    void load();
    void loadUserCount();
    void loadProStats();
    void loadPaymentsCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner, periodDays]);

  const uniqueTypes = useMemo(() => {
    const s = new Set<string>();
    for (const p of payments) {
      const t = String(p?.type || '').trim();
      if (t) s.add(t);
    }
    return Array.from(s.values()).sort();
  }, [payments]);

  const setHidden = async (id: string, hidden: boolean) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action: 'set_hidden', id, hidden }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed'));
    } finally {
      setBusyId(null);
    }
  };

  const refreshFromStripe = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action: 'refresh_stripe', id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      toast.success(json?.updated ? 'Refreshed from Stripe' : 'No new Stripe data');
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed'));
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (p: PaymentRow) => {
    setEditing(p);
    setEditCustomerEmail(String(p.customerEmail || ''));
    setEditReceiptUrl(String(p.receiptUrl || ''));
    setEditInvoiceUrl(String(p.invoiceUrl || ''));
    setEditInvoicePdf(String(p.invoicePdf || ''));
    setEditInvoiceNumber(String(p.invoiceNumber || ''));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          action: 'update_fields',
          id: editing.id,
          customerEmail: editCustomerEmail,
          receiptUrl: editReceiptUrl,
          invoiceUrl: editInvoiceUrl,
          invoicePdf: editInvoicePdf,
          invoiceNumber: editInvoiceNumber,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      toast.success('Saved');
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed'));
    } finally {
      setEditSaving(false);
    }
  };

  const renderStatus = (p: PaymentRow) => {
    if (p.status === 'paid') return '✅ Paid';
    if (p.status === 'unfulfilled') return '⚠️ Unfulfilled';
    if (p.status === 'expired') return '⌛ Expired';
    if (p.status === 'payment_failed') return '❌ Failed';
    return '❔ Unknown';
  };

  const hrefFor = (p: PaymentRow) => {
    return String(p.receiptUrl || p.invoiceUrl || p.invoicePdf || '').trim();
  };

  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white"
              >
                <ArrowLeft size={14} /> Back
              </Link>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Admin</p>
              </div>
            </div>

            <button
              onClick={() => load()}
              className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] hover:border-white/20"
            >
              Refresh
            </button>
          </div>

          {!userIsOwner && user && (
            <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-[11px] text-red-300">
              You do not have access to this page.
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 text-[10px] md:text-[11px]">
            <div className="bg-black/40 border border-blue-500/30 rounded-xl md:rounded-2xl p-3">
              <p className="text-blue-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">
                Total Users
              </p>
              <p className="text-lg md:text-xl font-black text-blue-400">
                {loadingUserCount ? <Loader2 className="animate-spin inline" size={20} /> : totalUsers}
              </p>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3">
              <p className="text-gray-500 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">
                Total Pro users
              </p>
              <p className="text-lg md:text-xl font-black">
                {loadingProStats ? <Loader2 className="animate-spin inline" size={20} /> : totals.total}
              </p>
            </div>
            <div className="bg-black/40 border border-emerald-500/30 rounded-xl md:rounded-2xl p-3">
              <p className="text-emerald-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">
                Active
              </p>
              <p className="text-lg md:text-xl font-black text-emerald-400">
                {loadingProStats ? <Loader2 className="animate-spin inline" size={20} /> : totals.active}
              </p>
            </div>
            <div className="bg-black/40 border border-red-500/30 rounded-xl md:rounded-2xl p-3">
              <p className="text-red-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">
                Expired
              </p>
              <p className="text-lg md:text-xl font-black text-red-400">
                {loadingProStats ? <Loader2 className="animate-spin inline" size={20} /> : totals.expired}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 text-[10px] md:text-[11px]">
            <div className="bg-black/40 border border-yellow-500/30 rounded-xl md:rounded-2xl p-3">
              <p className="text-yellow-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">Payments</p>
              <p className="text-lg md:text-xl font-black text-yellow-400">
                {loadingPaymentsCount ? <Loader2 className="animate-spin inline" size={20} /> : paymentsCount}
              </p>
            </div>

            <div className="bg-black/40 border border-purple-500/30 rounded-xl md:rounded-2xl p-3">
              <p className="text-purple-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">Net Revenue</p>
              <p className="text-lg md:text-xl font-black text-purple-400">
                {loadingPaymentsCount ? <Loader2 className="animate-spin inline" size={20} /> : netRevenueLabel}
              </p>
            </div>

            <div className="bg-black/40 border border-emerald-500/30 rounded-xl md:rounded-2xl p-3">
              <p className="text-emerald-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">Stripe Payouts (Paid)</p>
              <p className="text-lg md:text-xl font-black text-emerald-400">
                {loadingPaymentsCount ? <Loader2 className="animate-spin inline" size={20} /> : stripePayoutsPaidLabel}
              </p>
            </div>

            <div className="bg-black/40 border border-emerald-500/30 rounded-xl md:rounded-2xl p-3">
              <p className="text-emerald-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">Stripe Payouts (In Transit)</p>
              <p className="text-lg md:text-xl font-black text-emerald-400">
                {loadingPaymentsCount ? <Loader2 className="animate-spin inline" size={20} /> : stripePayoutsInTransitLabel}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Period</div>
              <select
                value={periodDays}
                onChange={(e) => setPeriodDays(e.target.value as any)}
                className="bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-[10px] font-black text-white outline-none"
              >
                <option value="all">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowStripeAdvanced((v) => !v)}
              className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] hover:border-white/20"
            >
              {showStripeAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </button>

            <button
              disabled={backfillingFees || !userIsOwner}
              onClick={() => backfillMissingFees()}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] border transition-all ${
                backfillingFees
                  ? 'bg-black/30 border-white/10 text-gray-400'
                  : 'bg-purple-600/20 border-purple-500/40 text-purple-300 hover:bg-purple-600/30'
              }`}
            >
              {backfillingFees ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw size={14} />}
              Backfill missing fees
            </button>
            <div className="text-[10px] text-gray-500">
              Use this if Net Revenue is higher than your bank deposits (older rows may be missing Stripe fee/net).
            </div>
          </div>

          {showStripeAdvanced && stripeBalanceTransactions && (
            <div className="mt-3 bg-black/40 border border-white/10 rounded-2xl p-4 overflow-x-auto">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Stripe (advanced)</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-[10px] md:text-[11px]">
                <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                  <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black mb-1">Balance Net (period)</div>
                  <div className="text-[12px] font-black">{stripeBalanceNetLabel}</div>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                  <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black mb-1">Balance Fees (period)</div>
                  <div className="text-[12px] font-black">{stripeBalanceFeeLabel}</div>
                </div>
              </div>

              {Array.isArray(stripeBalanceTransactions?.netByType) && stripeBalanceTransactions.netByType.length > 0 && (
                <table className="w-full text-left text-[9px] md:text-[10px]">
                  <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                    <tr>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stripeBalanceTransactions.netByType
                      .slice()
                      .sort((a, b) => String(a.type).localeCompare(String(b.type)))
                      .map((row) => (
                        <tr key={row.type} className="border-b border-white/5 last:border-b-0">
                          <td className="py-2 pr-3 uppercase tracking-widest text-gray-300 font-black">{String(row.type).replaceAll('_', ' ')}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-black">{formatCurrencyMapLabel(row.totalByCurrency)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="mt-6 bg-black/40 border border-white/10 rounded-2xl p-4 md:p-5">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Status</p>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="unfulfilled">Unfulfilled</option>
                  <option value="payment_failed">Failed</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Type</p>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                >
                  <option value="">All</option>
                  {uniqueTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">SteamID</p>
                <input
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  placeholder="7656..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-blue-400 outline-none"
                />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Promo</p>
                <input
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  placeholder="WELCOME20"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-emerald-300 outline-none"
                />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Coupon ID</p>
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="coupon_..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-purple-300 outline-none"
                />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Search</p>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="session, invoice, email..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-[11px] font-black text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIncludeHidden((v) => !v)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] border transition-all ${
                    includeHidden
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
                      : 'bg-black/40 border-white/10 text-gray-300 hover:border-white/20'
                  }`}
                >
                  {includeHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                  {includeHidden ? 'Including hidden' : 'Hide hidden'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => load()}
                  className="bg-blue-600/20 border border-blue-500/40 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] text-blue-300 hover:bg-blue-600/30"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setStatus('all');
                    setType('');
                    setSteamId('');
                    setPromo('');
                    setCoupon('');
                    setQ('');
                    setIncludeHidden(false);
                  }}
                  className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] text-gray-300 hover:border-white/20"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-10">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading payments...
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-[11px] text-red-300">{error}</div>
            ) : payments.length === 0 ? (
              <div className="text-gray-500 text-[11px]">No payments found.</div>
            ) : (
              <div className="bg-black/40 border border-white/10 rounded-2xl p-3 md:p-4 overflow-x-auto">
                <table className="w-full text-left text-[9px] md:text-[10px]">
                  <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                    <tr>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">SteamID</th>
                      <th className="py-2 pr-3">Promo</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Receipt</th>
                      <th className="py-2 pr-3">Invoice #</th>
                      <th className="py-2 pr-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 500).map((p) => {
                      const href = hrefFor(p);
                      const rowHidden = p.hidden === true;
                      return (
                        <tr key={p.id} className={`border-b border-white/5 last:border-b-0 ${rowHidden ? 'opacity-60' : ''}`}>
                          <td className="py-2 pr-3 text-[9px] whitespace-nowrap">{new Date(p.timestamp).toLocaleString()}</td>
                          <td className="py-2 pr-3">{renderStatus(p)}</td>
                          <td className="py-2 pr-3">{p.type || '-'}</td>
                          <td className="py-2 pr-3 font-mono break-all">{p.steamId || '-'}</td>
                          <td className="py-2 pr-3 font-mono">{p.promoCode || '-'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {Number(p.amount || 0).toFixed(2)} {String(p.currency || 'eur').toUpperCase()}
                          </td>
                          <td className="py-2 pr-3 break-all">{p.customerEmail || '-'}</td>
                          <td className="py-2 pr-3">
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-black uppercase tracking-widest text-[9px]"
                              >
                                Open <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 font-mono">{p.invoiceNumber || p.receiptNumber || '-'}</td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <button
                                disabled={busyId === p.id}
                                onClick={() => refreshFromStripe(p.id)}
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl font-black uppercase tracking-widest text-[9px] border transition-all ${
                                  busyId === p.id
                                    ? 'bg-black/30 border-white/10 text-gray-400'
                                    : 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
                                }`}
                              >
                                {busyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw size={12} />}
                                Refresh
                              </button>
                              <button
                                disabled={busyId === p.id}
                                onClick={() => openEdit(p)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl font-black uppercase tracking-widest text-[9px] border bg-black/40 border-white/10 text-gray-200 hover:border-white/20 transition-all"
                              >
                                <Pencil size={12} /> Edit
                              </button>
                              <button
                                disabled={busyId === p.id}
                                onClick={() => setHidden(p.id, !rowHidden)}
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl font-black uppercase tracking-widest text-[9px] border transition-all ${
                                  rowHidden
                                    ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/25'
                                    : 'bg-red-600/15 border-red-500/30 text-red-300 hover:bg-red-600/25'
                                }`}
                              >
                                {rowHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                {rowHidden ? 'Unhide' : 'Hide'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mt-3 text-[10px] text-gray-500">
                  Showing {Math.min(payments.length, 500)} / {payments.length}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#11141d] border border-white/10 rounded-3xl p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.4em] text-gray-500 font-black">Edit Payment</p>
                <div className="mt-1 text-[10px] text-gray-400 font-mono break-all">{editing.id}</div>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Customer Email</p>
                <input
                  value={editCustomerEmail}
                  onChange={(e) => setEditCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Receipt URL (preferred)</p>
                <input
                  value={editReceiptUrl}
                  onChange={(e) => setEditReceiptUrl(e.target.value)}
                  placeholder="https://pay.stripe.com/receipts/..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-blue-300 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Invoice URL</p>
                  <input
                    value={editInvoiceUrl}
                    onChange={(e) => setEditInvoiceUrl(e.target.value)}
                    placeholder="https://invoice.stripe.com/i/..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                  />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Invoice PDF</p>
                  <input
                    value={editInvoicePdf}
                    onChange={(e) => setEditInvoicePdf(e.target.value)}
                    placeholder="https://.../invoice.pdf"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Invoice Number</p>
                <input
                  value={editInvoiceNumber}
                  onChange={(e) => setEditInvoiceNumber(e.target.value)}
                  placeholder="INV-..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                disabled={editSaving}
                onClick={() => setEditing(null)}
                className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] text-gray-300 hover:border-white/20"
              >
                Cancel
              </button>
              <button
                disabled={editSaving}
                onClick={saveEdit}
                className="bg-blue-600/20 border border-blue-500/40 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] text-blue-300 hover:bg-blue-600/30 inline-flex items-center gap-2"
              >
                {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save size={12} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
