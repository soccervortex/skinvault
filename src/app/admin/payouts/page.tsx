"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import { ArrowLeft, Loader2, RefreshCw, Save, Trash2, Copy } from 'lucide-react';

type PaidEntry = {
  id: string;
  amount: number;
  currency: string;
  note: string | null;
  createdAt: string | null;
};

type StakeholderRow = {
  steamId: string;
  role: string;
  displayName: string;
  payoutCurrency: string;
  conversionFeePct: number;
  fxRateEurToPayoutCurrency: number | null;
  owedTotalByCurrency: Record<string, number>;
  owedEur: number;
  owedGrossPayoutCurrency: number | null;
  owedConversionFeePayoutCurrency: number | null;
  owedNetPayoutCurrency: number | null;
  paidEntries: PaidEntry[];
  paidEurEquivalent: number;
  paidInPayoutCurrency: number;
  remainingEur: number;
  remainingNetPayoutCurrency: number | null;
};

function monthKeyNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function formatCurrencyAmount(amount: number, currency: string) {
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
}

function normalizeCurrency(raw: any): string {
  const s = String(raw || '').trim().toLowerCase();
  return s || 'eur';
}

export default function AdminPayoutsPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [monthKey, setMonthKey] = useState<string>(monthKeyNow());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StakeholderRow[]>([]);
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [showOnlyWithOwed, setShowOnlyWithOwed] = useState(true);

  const [newStakeholderSteamId, setNewStakeholderSteamId] = useState('');
  const [newStakeholderName, setNewStakeholderName] = useState('');
  const [newStakeholderCurrency, setNewStakeholderCurrency] = useState('eur');
  const [newStakeholderFeePct, setNewStakeholderFeePct] = useState('0');
  const [addingStakeholder, setAddingStakeholder] = useState(false);

  const [savingSteamId, setSavingSteamId] = useState<string | null>(null);
  const [savingFxCurrency, setSavingFxCurrency] = useState<string | null>(null);
  const [addingPaymentFor, setAddingPaymentFor] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('eur');
  const [paymentNote, setPaymentNote] = useState('');
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

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
    try {
      const qs = new URLSearchParams();
      qs.set('month', monthKey);
      const res = await fetch(`/api/admin/payouts?${qs.toString()}`, {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed to load payouts'));
      setRows(Array.isArray(json?.stakeholders) ? (json.stakeholders as StakeholderRow[]) : []);
      setFxRates((json?.fxRates as Record<string, number>) || {});
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed to load payouts'));
      setRows([]);
      setFxRates({});
    } finally {
      setLoading(false);
    }
  };

  const addStakeholder = async () => {
    if (!userIsOwner) return;
    const steamId = String(newStakeholderSteamId || '').trim();
    if (!/^\d{17}$/.test(steamId)) {
      toast.error('Invalid SteamID');
      return;
    }
    const displayName = String(newStakeholderName || '').trim();
    const payoutCurrency = normalizeCurrency(newStakeholderCurrency);
    const pct = Number(String(newStakeholderFeePct || '').replace(',', '.'));
    const conversionFeePct = Number.isFinite(pct) ? pct : 0;

    setAddingStakeholder(true);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          action: 'upsert_stakeholder',
          steamId,
          displayName,
          payoutCurrency,
          conversionFeePct,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      toast.success('Stakeholder added');
      setNewStakeholderSteamId('');
      setNewStakeholderName('');
      setNewStakeholderCurrency('eur');
      setNewStakeholderFeePct('0');
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed'));
    } finally {
      setAddingStakeholder(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner, monthKey]);

  const visibleRows = useMemo(() => {
    const list = rows.slice();
    if (!showOnlyWithOwed) return list;
    return list.filter((r) => Number(r?.owedEur || 0) > 0 || (r.paidEntries?.length || 0) > 0);
  }, [rows, showOnlyWithOwed]);

  const currenciesNeedingFx = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const c = normalizeCurrency(r?.payoutCurrency);
      if (c && c !== 'eur') s.add(c);
      for (const p of r.paidEntries || []) {
        const pc = normalizeCurrency(p?.currency);
        if (pc && pc !== 'eur') s.add(pc);
      }
    }
    return Array.from(s.values()).sort();
  }, [rows]);

  const upsertStakeholder = async (steamId: string, next: { displayName: string; payoutCurrency: string; conversionFeePct: number }) => {
    if (!userIsOwner) return;
    setSavingSteamId(steamId);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          action: 'upsert_stakeholder',
          steamId,
          displayName: next.displayName,
          payoutCurrency: next.payoutCurrency,
          conversionFeePct: next.conversionFeePct,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      toast.success('Saved');
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed'));
    } finally {
      setSavingSteamId(null);
    }
  };

  const setFxRate = async (currency: string, rate: number) => {
    if (!userIsOwner) return;
    setSavingFxCurrency(currency);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          action: 'set_fx_rate',
          monthKey,
          currency,
          rateEurToCurrency: rate,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      toast.success('FX saved');
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed'));
    } finally {
      setSavingFxCurrency(null);
    }
  };

  const openAddPayment = (steamId: string, defaultCurrency: string) => {
    setAddingPaymentFor(steamId);
    setPaymentAmount('');
    setPaymentCurrency(normalizeCurrency(defaultCurrency));
    setPaymentNote('');
  };

  const submitPayment = async () => {
    if (!userIsOwner) return;
    const sid = String(addingPaymentFor || '').trim();
    if (!/^\d{17}$/.test(sid)) return;

    const amt = Number(String(paymentAmount || '').replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Invalid amount');
      return;
    }

    const cur = normalizeCurrency(paymentCurrency);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          action: 'add_payment',
          monthKey,
          steamId: sid,
          amount: amt,
          currency: cur,
          note: paymentNote,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      toast.success('Payment added');
      setAddingPaymentFor(null);
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed'));
    }
  };

  const deletePayment = async (steamId: string, id: string) => {
    if (!userIsOwner) return;
    setDeletingPaymentId(id);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action: 'delete_payment', id, monthKey, steamId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      toast.success('Deleted');
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed'));
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
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
                <h1 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Payouts</h1>
              </div>
            </div>

            <button
              onClick={() => load()}
              className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] hover:border-white/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : <RefreshCw size={14} className="inline" />} Refresh
            </button>
          </div>

          <div className="mt-4 bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Month</div>
              <input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-[10px] font-black text-white outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input
                type="checkbox"
                checked={showOnlyWithOwed}
                onChange={(e) => setShowOnlyWithOwed(e.target.checked)}
              />
              Show only owed/paid
            </label>
          </div>

          <div className="mt-4 bg-black/40 border border-white/10 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Add stakeholder</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">SteamID</div>
                <input
                  value={newStakeholderSteamId}
                  onChange={(e) => setNewStakeholderSteamId(e.target.value)}
                  placeholder="7656..."
                  className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Name</div>
                <input
                  value={newStakeholderName}
                  onChange={(e) => setNewStakeholderName(e.target.value)}
                  placeholder="dio1v1"
                  className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Currency</div>
                <input
                  value={newStakeholderCurrency}
                  onChange={(e) => setNewStakeholderCurrency(e.target.value)}
                  placeholder="eur"
                  className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Fee %</div>
                <input
                  value={newStakeholderFeePct}
                  onChange={(e) => setNewStakeholderFeePct(e.target.value)}
                  placeholder="0"
                  className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end">
              <button
                disabled={addingStakeholder}
                onClick={addStakeholder}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] border transition-all ${
                  addingStakeholder
                    ? 'bg-black/30 border-white/10 text-gray-400'
                    : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                }`}
              >
                {addingStakeholder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
                Add
              </button>
            </div>
          </div>

          {currenciesNeedingFx.length > 0 && (
            <div className="mt-4 bg-black/40 border border-white/10 rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">FX rates (EUR → currency)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currenciesNeedingFx.map((c) => (
                  <FxRow
                    key={c}
                    currency={c}
                    current={Number(fxRates?.[c] || 0) || 0}
                    saving={savingFxCurrency === c}
                    onSave={setFxRate}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 bg-black/40 border border-white/10 rounded-2xl p-4 overflow-x-auto">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Stakeholders</div>

            <table className="w-full text-left text-[9px] md:text-[10px]">
              <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">SteamID</th>
                  <th className="py-2 pr-3">Payout cur</th>
                  <th className="py-2 pr-3">Fee %</th>
                  <th className="py-2 pr-3">Owed (EUR)</th>
                  <th className="py-2 pr-3">Owed (net)</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2 pr-3">Remaining</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <StakeholderRowView
                    key={r.steamId}
                    row={r}
                    saving={savingSteamId === r.steamId}
                    onSave={upsertStakeholder}
                    onAddPayment={openAddPayment}
                    onCopy={copy}
                    onDeletePayment={deletePayment}
                    deletingPaymentId={deletingPaymentId}
                  />
                ))}
              </tbody>
            </table>

            {visibleRows.length === 0 && !loading && (
              <div className="text-[11px] text-gray-500">No payouts for this month.</div>
            )}
          </div>

          {addingPaymentFor && (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80"
              role="dialog"
              aria-modal="true"
              onClick={() => setAddingPaymentFor(null)}
            >
              <div
                className="bg-[#11141d] border border-white/10 p-6 rounded-[2rem] w-full max-w-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Add payment</div>
                <div className="mt-1 text-sm font-black">{addingPaymentFor}</div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Amount</div>
                    <input
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Currency</div>
                    <input
                      value={paymentCurrency}
                      onChange={(e) => setPaymentCurrency(e.target.value)}
                      className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                      placeholder="eur"
                    />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Note</div>
                    <input
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                      placeholder="optional"
                    />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setAddingPaymentFor(null)}
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitPayment}
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FxRow({
  currency,
  current,
  saving,
  onSave,
}: {
  currency: string;
  current: number;
  saving: boolean;
  onSave: (currency: string, rate: number) => Promise<void>;
}) {
  const [val, setVal] = useState(String(current || ''));

  useEffect(() => {
    setVal(String(current || ''));
  }, [current]);

  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex items-end gap-2">
      <div className="flex-1">
        <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">{currency.toUpperCase()}</div>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
          placeholder="rate"
        />
      </div>
      <button
        disabled={saving}
        onClick={() => {
          const n = Number(String(val || '').replace(',', '.'));
          if (!Number.isFinite(n) || n <= 0) return;
          void onSave(currency, n);
        }}
        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
          saving ? 'bg-black/30 border-white/10 text-gray-400' : 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
        }`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
      </button>
    </div>
  );
}

function StakeholderRowView({
  row,
  saving,
  onSave,
  onAddPayment,
  onCopy,
  onDeletePayment,
  deletingPaymentId,
}: {
  row: StakeholderRow;
  saving: boolean;
  onSave: (steamId: string, next: { displayName: string; payoutCurrency: string; conversionFeePct: number }) => Promise<void>;
  onAddPayment: (steamId: string, defaultCurrency: string) => void;
  onCopy: (text: string) => void;
  onDeletePayment: (steamId: string, id: string) => void;
  deletingPaymentId: string | null;
}) {
  const [displayName, setDisplayName] = useState(row.displayName || '');
  const [payoutCurrency, setPayoutCurrency] = useState(row.payoutCurrency || 'eur');
  const [feePct, setFeePct] = useState(String(row.conversionFeePct ?? 0));

  useEffect(() => {
    setDisplayName(row.displayName || '');
    setPayoutCurrency(row.payoutCurrency || 'eur');
    setFeePct(String(row.conversionFeePct ?? 0));
  }, [row.displayName, row.payoutCurrency, row.conversionFeePct]);

  const owedEurLabel = formatCurrencyAmount(Number(row.owedEur || 0), 'eur');
  const owedNetLabel = row.owedNetPayoutCurrency == null ? '-' : formatCurrencyAmount(Number(row.owedNetPayoutCurrency || 0), row.payoutCurrency);
  const paidLabel = row.paidInPayoutCurrency ? formatCurrencyAmount(Number(row.paidInPayoutCurrency || 0), row.payoutCurrency) : '-';
  const remainingLabel =
    row.remainingNetPayoutCurrency == null ? '-' : formatCurrencyAmount(Number(row.remainingNetPayoutCurrency || 0), row.payoutCurrency);

  return (
    <tr className="border-b border-white/5 align-top">
      <td className="py-3 pr-3">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="display name"
          className="w-40 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black"
        />
      </td>
      <td className="py-3 pr-3 uppercase tracking-widest text-gray-300 font-black">{String(row.role || '').replaceAll('_', ' ')}</td>
      <td className="py-3 pr-3 font-mono break-all">
        <div className="flex items-center gap-2">
          <span>{row.steamId}</span>
          <button onClick={() => onCopy(row.steamId)} className="p-1 rounded bg-white/5 hover:bg-white/10" aria-label="Copy steam id">
            <Copy size={12} />
          </button>
        </div>
      </td>
      <td className="py-3 pr-3">
        <input
          value={payoutCurrency}
          onChange={(e) => setPayoutCurrency(e.target.value)}
          className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black"
        />
      </td>
      <td className="py-3 pr-3">
        <input
          value={feePct}
          onChange={(e) => setFeePct(e.target.value)}
          className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black"
        />
      </td>
      <td className="py-3 pr-3 whitespace-nowrap font-black">{owedEurLabel}</td>
      <td className="py-3 pr-3 whitespace-nowrap font-black">{owedNetLabel}</td>
      <td className="py-3 pr-3 whitespace-nowrap font-black">{paidLabel}</td>
      <td className="py-3 pr-3 whitespace-nowrap font-black">{remainingLabel}</td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            disabled={saving}
            onClick={() => {
              const pct = Number(String(feePct || '').replace(',', '.'));
              void onSave(row.steamId, {
                displayName,
                payoutCurrency: normalizeCurrency(payoutCurrency),
                conversionFeePct: Number.isFinite(pct) ? pct : 0,
              });
            }}
            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
              saving ? 'bg-black/30 border-white/10 text-gray-400' : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
          <button
            onClick={() => onAddPayment(row.steamId, row.payoutCurrency)}
            className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10"
          >
            Add paid
          </button>
        </div>

        {Array.isArray(row.paidEntries) && row.paidEntries.length > 0 && (
          <div className="mt-2 space-y-1">
            {row.paidEntries.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-[9px] text-gray-400">
                <div className="min-w-0 truncate">
                  {formatCurrencyAmount(Number(p.amount || 0), p.currency)} {p.note ? `- ${p.note}` : ''}
                </div>
                <button
                  disabled={deletingPaymentId === p.id}
                  onClick={() => onDeletePayment(row.steamId, p.id)}
                  className="p-1 rounded bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30"
                  aria-label="Delete payment"
                >
                  {deletingPaymentId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
