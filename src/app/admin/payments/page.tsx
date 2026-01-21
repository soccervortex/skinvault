"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import { ArrowLeft, ExternalLink, Loader2, Mail, Search } from 'lucide-react';

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

export default function AdminPaymentsPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('');
  const [steamId, setSteamId] = useState<string>('');
  const [q, setQ] = useState<string>('');

  const [resendBusyId, setResendBusyId] = useState<string | null>(null);

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
      if (q) qs.set('q', q);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;
    if (!userIsOwner) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const uniqueTypes = useMemo(() => {
    const s = new Set<string>();
    for (const p of payments) {
      const t = String(p?.type || '').trim();
      if (t) s.add(t);
    }
    return Array.from(s.values()).sort();
  }, [payments]);

  const resendEmail = async (id: string) => {
    setResendBusyId(id);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action: 'resend_email', id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed to resend email'));
      toast.success('Email sent');
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed to resend email'));
    } finally {
      setResendBusyId(null);
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

          <div className="mt-6 bg-black/40 border border-white/10 rounded-2xl p-4 md:p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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

            <div className="mt-4 flex items-center gap-2">
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
                  setQ('');
                }}
                className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] text-gray-300 hover:border-white/20"
              >
                Reset
              </button>
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
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Receipt</th>
                      <th className="py-2 pr-3">Invoice #</th>
                      <th className="py-2 pr-3">Resend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 500).map((p) => {
                      const href = hrefFor(p);
                      return (
                        <tr key={p.id} className="border-b border-white/5 last:border-b-0">
                          <td className="py-2 pr-3 text-[9px] whitespace-nowrap">{new Date(p.timestamp).toLocaleString()}</td>
                          <td className="py-2 pr-3">{renderStatus(p)}</td>
                          <td className="py-2 pr-3">{p.type || '-'}</td>
                          <td className="py-2 pr-3 font-mono break-all">{p.steamId || '-'}</td>
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
                          <td className="py-2 pr-3 font-mono">{p.invoiceNumber || '-'}</td>
                          <td className="py-2 pr-3">
                            <button
                              disabled={!p.customerEmail || resendBusyId === p.id}
                              onClick={() => resendEmail(p.id)}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl font-black uppercase tracking-widest text-[9px] border transition-all ${
                                !p.customerEmail
                                  ? 'bg-black/20 border-white/5 text-gray-600'
                                  : resendBusyId === p.id
                                  ? 'bg-black/30 border-white/10 text-gray-400'
                                  : 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
                              }`}
                            >
                              {resendBusyId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail size={12} />}
                              Resend
                            </button>
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
    </div>
  );
}
