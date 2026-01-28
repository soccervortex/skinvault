"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import HelpTooltip from '@/app/components/HelpTooltip';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Shield, Trash2 } from 'lucide-react';

export default function AdminFixPurchasePage() {
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [fixSteamId, setFixSteamId] = useState('');
  const [userPurchases, setUserPurchases] = useState<any[]>([]);
  const [loadingUserPurchases, setLoadingUserPurchases] = useState(false);
  const [fixingPurchase, setFixingPurchase] = useState(false);
  const [fixMessage, setFixMessage] = useState<string | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const handleLoadUserPurchases = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixSteamId || !/^\d{17}$/.test(String(fixSteamId || '').trim())) {
      setFixError('Invalid SteamID64 format');
      return;
    }

    setLoadingUserPurchases(true);
    setFixError(null);
    setFixMessage(null);
    setUserPurchases([]);

    try {
      const res = await fetch(`/api/admin/purchases?steamId=${encodeURIComponent(String(fixSteamId || '').trim())}`);

      const data = await res.json().catch(() => null);
      if (res.ok) {
        const rows = Array.isArray((data as any)?.purchases) ? (data as any).purchases : [];
        setUserPurchases(rows);
        if (rows.length === 0) {
          setFixMessage('No purchases found for this user.');
        }
      } else {
        setFixError(String((data as any)?.error || 'Failed to load purchases'));
      }
    } catch (e: any) {
      setFixError(String(e?.message || 'Request failed.'));
    } finally {
      setLoadingUserPurchases(false);
    }
  };

  const handleFixPurchase = async (sessionId: string, steamId: string) => {
    setFixingPurchase(true);
    setFixError(null);
    setFixMessage(null);

    try {
      const res = await fetch('/api/payment/fix-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, steamId }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok) {
        setFixMessage(String((data as any)?.message || 'Purchase fixed successfully!'));
        toast.success('Purchase fixed');

        const reloadRes = await fetch(`/api/admin/purchases?steamId=${encodeURIComponent(String(steamId || '').trim())}`);
        const reloadData = await reloadRes.json().catch(() => null);
        if (reloadRes.ok) {
          setUserPurchases(Array.isArray((reloadData as any)?.purchases) ? (reloadData as any).purchases : []);
        }
      } else {
        const msg = String((data as any)?.error || 'Failed to fix purchase');
        setFixError(msg);
        toast.error(msg);
      }
    } catch (e: any) {
      const msg = String(e?.message || 'Request failed.');
      setFixError(msg);
      toast.error(msg);
    } finally {
      setFixingPurchase(false);
    }
  };

  const hidePurchase = async (sessionId: string) => {
    const sid = String(sessionId || '').trim();
    if (!sid) {
      setFixError('Missing session id for this purchase.');
      return;
    }
    if (!confirm('Hide this purchase from the list?')) return;

    try {
      const res = await fetch('/api/admin/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'hide', sessionId: sid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String((data as any)?.error || 'Failed to hide purchase.');
        setFixError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Hidden');
      setUserPurchases((prev) => prev.filter((p: any) => String(p?.sessionId || '').trim() !== sid));
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to hide purchase.');
      setFixError(msg);
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
        <div className="max-w-6xl mx-auto space-y-8 pb-24">
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
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Fix Purchase</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Retry fulfillment for purchases that didn’t apply correctly.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-start justify-between gap-2 mb-4">
              <p className="text-[10px] md:text-[11px] text-gray-400">Enter a Steam ID to view their purchases and fix any that weren't fulfilled properly.</p>
              <HelpTooltip
                title="Fix Purchases"
                content={
                  <>
                    <p className="mb-2">Fix purchases that failed to fulfill:</p>
                    <p className="mb-1">• Enter a 17-digit Steam64 ID</p>
                    <p className="mb-1">• View all purchases for that user</p>
                    <p className="mb-1">• Click "Fix" on failed purchases to retry fulfillment</p>
                    <p className="text-blue-400 mt-2">💡 Tip: Useful when Stripe webhooks fail or payments don't process correctly</p>
                  </>
                }
                position="left"
              />
            </div>

            <form onSubmit={handleLoadUserPurchases} className="space-y-3 md:space-y-4 text-[10px] md:text-[11px] mb-6">
              <div>
                <label htmlFor="admin-fix-steam-id" className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                  SteamID64
                </label>
                <input
                  id="admin-fix-steam-id"
                  value={fixSteamId}
                  onChange={(e) => setFixSteamId(e.target.value)}
                  placeholder="7656119..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                />
              </div>
              <button
                type="submit"
                disabled={loadingUserPurchases}
                className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingUserPurchases && <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />}
                {loadingUserPurchases ? 'Loading...' : 'Load Purchases'}
              </button>
            </form>

            {fixMessage ? (
              <div className="mb-4 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
                <CheckCircle2 size={12} /> <span>{fixMessage}</span>
              </div>
            ) : null}
            {fixError ? (
              <div className="mb-4 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                <AlertTriangle size={12} /> <span>{fixError}</span>
              </div>
            ) : null}

            {userPurchases.length > 0 ? (
              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 max-h-96 overflow-y-auto">
                <table className="w-full text-left text-[9px] md:text-[10px]">
                  <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                    <tr>
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Amount</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2">Details</th>
                      <th className="py-2 pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userPurchases.map((purchase, idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-b-0">
                        <td className="py-2 pr-2 text-[9px]">{purchase?.timestamp ? new Date(purchase.timestamp).toLocaleString() : ''}</td>
                        <td className="py-2 pr-2 text-[9px]">
                          {purchase?.type === 'pro'
                            ? '👑 Pro'
                            : purchase?.type === 'credits'
                              ? '💳 Credits'
                              : purchase?.type === 'spins'
                                ? '🎰 Spins'
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
                          <div className="flex items-center gap-2">
                            {purchase?.fulfilled === false ? (
                              <button
                                onClick={() => handleFixPurchase(String(purchase?.sessionId || ''), String(purchase?.steamId || ''))}
                                disabled={fixingPurchase}
                                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-2 py-1 rounded text-[8px] font-black uppercase transition-all disabled:opacity-60 flex items-center gap-1"
                              >
                                {fixingPurchase ? (
                                  <>
                                    <Loader2 className="w-2 h-2 animate-spin" /> Fixing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={10} /> Fix
                                  </>
                                )}
                              </button>
                            ) : null}

                            <button
                              onClick={() => hidePurchase(String(purchase?.sessionId || ''))}
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
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
