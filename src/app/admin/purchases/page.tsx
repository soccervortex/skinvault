"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import { AlertTriangle, ArrowLeft, Bell, CheckCircle2, Loader2, Shield, ShoppingBag, Trash2 } from 'lucide-react';

export default function AdminPurchasesPage() {
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  const [failedPurchases, setFailedPurchases] = useState<any[]>([]);
  const [loadingFailedPurchases, setLoadingFailedPurchases] = useState(true);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadPurchases = async () => {
    if (!userIsOwner) return;
    setLoadingPurchases(true);
    try {
      const res = await fetch('/api/admin/purchases', {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setPurchases(Array.isArray((data as any)?.purchases) ? (data as any).purchases : []);
      }
    } catch {
    } finally {
      setLoadingPurchases(false);
    }
  };

  const loadFailedPurchases = async () => {
    if (!userIsOwner) return;
    setLoadingFailedPurchases(true);
    try {
      const res = await fetch('/api/admin/failed-purchases', {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setFailedPurchases(Array.isArray((data as any)?.failedPurchases) ? (data as any).failedPurchases : []);
      }
    } catch {
    } finally {
      setLoadingFailedPurchases(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadPurchases();
    void loadFailedPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const fulfillFailed = async (sessionId: string, steamId: string) => {
    try {
      setMessage(null);
      setError(null);
      const res = await fetch('/api/payment/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, steamId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data as any)?.fulfilled) {
        setMessage(`Purchase fulfilled: ${(data as any)?.message || ''}`);
        toast.success('Fulfilled');
        await loadFailedPurchases();
        await loadPurchases();
      } else {
        const msg = String((data as any)?.error || 'Failed to fulfill purchase');
        setError(msg);
        toast.error(msg);
      }
    } catch (e: any) {
      const msg = String(e?.message || 'Request failed.');
      setError(msg);
      toast.error(msg);
    }
  };

  const retryDiscord = async (sessionId: string) => {
    if (!sessionId) return;
    if (!confirm('Retry Discord notification for this purchase?')) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action: 'retry_discord', sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String((data as any)?.error || 'Failed to retry Discord notification.');
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Discord retry sent');
      setPurchases((prev) =>
        prev.map((p: any) => {
          if (String(p?.sessionId || '').trim() !== String(sessionId || '').trim()) return p;
          return {
            ...p,
            discordNotified: true,
            discordNotifiedAt: new Date().toISOString(),
            discordNotifyError: null,
          };
        })
      );
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to retry Discord notification.');
      setError(msg);
      toast.error(msg);
    }
  };

  const hidePurchase = async (sessionId: string) => {
    if (!sessionId) return;
    if (!confirm('Hide this purchase from the list?')) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action: 'hide', sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String((data as any)?.error || 'Failed to hide purchase.');
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Hidden');
      setPurchases((prev) => prev.filter((p: any) => String(p?.sessionId || '').trim() !== String(sessionId || '').trim()));
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to hide purchase.');
      setError(msg);
      toast.error(msg);
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Sign in first.</div>
      </div>
    );
  }

  if (!userIsOwner) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Access denied.</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8 pb-24">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>

          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Owner</p>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Purchases</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Purchase history, failed purchase review, and admin actions.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          {message ? (
            <div className="flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
              <CheckCircle2 size={12} /> <span>{message}</span>
            </div>
          ) : null}
          {error ? (
            <div className="flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
              <AlertTriangle size={12} /> <span>{error}</span>
            </div>
          ) : null}

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/40">
                  <AlertTriangle className="text-red-400" size={16} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Failed Purchases</p>
                  <h2 className="text-lg md:text-xl font-black italic uppercase tracking-tighter">Needs Manual Review</h2>
                </div>
              </div>

              <button
                onClick={loadFailedPurchases}
                className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-black uppercase"
              >
                Refresh
              </button>
            </div>

            <p className="text-[10px] md:text-[11px] text-gray-400 mb-6">
              These purchases failed to fulfill automatically. Use the verify endpoint to manually fulfill them.
            </p>

            {loadingFailedPurchases ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading failed purchases...
              </div>
            ) : failedPurchases.length === 0 ? (
              <div className="text-gray-500 text-[11px]">No failed purchases.</div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl md:rounded-2xl p-3 md:p-4 max-h-96 overflow-y-auto">
                <table className="w-full text-left text-[9px] md:text-[10px]">
                  <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                    <tr>
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">SteamID</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Amount</th>
                      <th className="py-2 pr-2">Session ID</th>
                      <th className="py-2 pr-2">Error</th>
                      <th className="py-2 pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedPurchases.map((fp, idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-b-0">
                        <td className="py-2 pr-2 text-[9px]">{fp?.timestamp ? new Date(fp.timestamp).toLocaleString() : ''}</td>
                        <td className="py-2 pr-2 font-mono text-[9px] break-all">{fp?.steamId || ''}</td>
                        <td className="py-2 pr-2 text-[9px]">{fp?.type === 'pro' ? '👑 Pro' : '🎁 Consumable'}</td>
                        <td className="py-2 pr-2 text-[9px]">€{Number(fp?.amount || 0).toFixed(2)}</td>
                        <td className="py-2 pr-2 font-mono text-[8px] break-all">{String(fp?.sessionId || '').substring(0, 20)}...</td>
                        <td className="py-2 pr-2 text-[9px] text-red-400">{fp?.error || 'Unknown'}</td>
                        <td className="py-2 pr-2">
                          <button
                            onClick={() => fulfillFailed(String(fp?.sessionId || ''), String(fp?.steamId || ''))}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                            title="Fulfill Purchase"
                          >
                            <CheckCircle2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/40">
                  <ShoppingBag className="text-blue-400" size={16} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Purchase History</p>
                  <h2 className="text-lg md:text-xl font-black italic uppercase tracking-tighter">Recent Purchases</h2>
                </div>
              </div>

              <button
                onClick={loadPurchases}
                className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-black uppercase"
              >
                Refresh
              </button>
            </div>

            {loadingPurchases ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading purchases...
              </div>
            ) : purchases.length === 0 ? (
              <div className="text-gray-500 text-[11px]">No purchases yet.</div>
            ) : (
              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 max-h-96 overflow-y-auto">
                <table className="w-full text-left text-[9px] md:text-[10px]">
                  <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                    <tr>
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">SteamID</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Amount</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2">Details</th>
                      <th className="py-2 pr-2">Receipt</th>
                      <th className="py-2 pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.slice(0, 200).map((purchase, idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-b-0">
                        <td className="py-2 pr-2 text-[9px]">{purchase?.timestamp ? new Date(purchase.timestamp).toLocaleString() : ''}</td>
                        <td className="py-2 pr-2 font-mono text-[9px] break-all">{purchase?.steamId || ''}</td>
                        <td className="py-2 pr-2 text-[9px]">
                          {purchase?.type === 'pro'
                            ? '👑 Pro'
                            : purchase?.type === 'credits'
                              ? '💳 Credits'
                              : purchase?.type === 'spins'
                                ? '🎡 Spins'
                                : '🎁 Consumable'}
                        </td>
                        <td className="py-2 pr-2 text-[9px]">
                          {(purchase?.currency || 'eur') === 'eur' ? '€' : '$'}{Number(purchase?.amount || 0).toFixed(2)}
                        </td>
                        <td className="py-2 pr-2 text-[9px]">
                          {purchase?.fulfilled !== false ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-emerald-400">✅ Fulfilled</span>
                              {purchase?.discordNotified === true ? (
                                <span className="text-emerald-400">🔔 Discord</span>
                              ) : (
                                <span className="text-amber-400">🔕 Discord pending</span>
                              )}
                              {purchase?.discordNotified !== true && (Number(purchase?.discordNotifyAttempts) > 0 || (purchase as any)?.discordNotifyError) ? (
                                <div className="text-[8px] text-gray-500">
                                  <div>Attempts: {Math.max(0, Math.floor(Number(purchase?.discordNotifyAttempts || 0)))}</div>
                                  {!!String((purchase as any)?.discordNotifyError || '').trim() ? (
                                    <div
                                      className="text-red-400/80"
                                      title={String((purchase as any)?.discordNotifyError || '')}
                                    >
                                      {String((purchase as any)?.discordNotifyError || '').slice(0, 80)}
                                      {String((purchase as any)?.discordNotifyError || '').length > 80 ? '…' : ''}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-red-400">❌ Failed</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-[9px]">
                          {(() => {
                            const t = String(purchase?.type || '').trim();
                            if (t === 'pro') {
                              const months = Math.max(0, Math.floor(Number(purchase?.months || 0)));
                              return months > 0 ? `${months} month${months > 1 ? 's' : ''}` : '—';
                            }
                            if (t === 'credits') {
                              const credits = Math.max(0, Math.floor(Number(purchase?.credits || 0)));
                              const pack = String(purchase?.pack || '').trim();
                              if (credits > 0 && pack) return `${credits.toLocaleString('en-US')} credits (${pack})`;
                              if (credits > 0) return `${credits.toLocaleString('en-US')} credits`;
                              if (pack) return `Credits pack (${pack})`;
                              return 'Credits purchase';
                            }
                            if (t === 'spins') {
                              const spins = Math.max(0, Math.floor(Number((purchase as any)?.spins || 0)));
                              const pack = String(purchase?.pack || '').trim();
                              if (spins > 0 && pack) return `${spins.toLocaleString('en-US')} spins (${pack})`;
                              if (spins > 0) return `${spins.toLocaleString('en-US')} spins`;
                              if (pack) return `Spins pack (${pack})`;
                              return 'Spins purchase';
                            }
                            const quantityRaw = Number((purchase as any)?.quantity);
                            const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1;
                            const item = String((purchase as any)?.consumableType || (purchase as any)?.itemType || 'item');
                            return `${quantity}x ${item}`;
                          })()}
                        </td>
                        <td className="py-2 pr-2">
                          {(() => {
                            const href = String((purchase as any)?.receiptUrl || (purchase as any)?.invoiceUrl || (purchase as any)?.invoicePdf || '').trim();
                            if (!href) return null;
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 font-black uppercase tracking-widest text-[9px]"
                              >
                                Download
                              </a>
                            );
                          })()}
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1">
                            {purchase?.fulfilled !== false && purchase?.discordNotified !== true && String((purchase as any)?.sessionId || '').trim() ? (
                              <button
                                onClick={() => retryDiscord(String((purchase as any)?.sessionId || '').trim())}
                                className="p-1 text-amber-400 hover:text-amber-300"
                                title="Retry Discord notification"
                              >
                                <Bell size={12} />
                              </button>
                            ) : null}

                            <button
                              onClick={() => hidePurchase(String((purchase as any)?.sessionId || '').trim())}
                              className="p-1 text-red-400 hover:text-red-300"
                              title="Hide from list"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
