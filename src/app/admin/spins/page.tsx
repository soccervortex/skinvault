"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { Copy, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/app/components/Toast';

type SpinHistoryRow = {
  steamId: string;
  reward: number;
  createdAt: string;
  role: string;
};

type SpinHistorySummary = {
  totalSpins: number;
  totalCredits: number;
  bestReward: number;
};

export default function AdminSpinsPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SpinHistoryRow[]>([]);
  const [summary, setSummary] = useState<SpinHistorySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterSteamId, setFilterSteamId] = useState('');

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/spins/history?days=30&limit=2000', {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setItems(Array.isArray(json?.items) ? json.items : []);
      setSummary(json?.summary || null);
    } catch (e: any) {
      setItems([]);
      setSummary(null);
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const filtered = useMemo(() => {
    const q = String(filterSteamId || '').trim();
    if (!q) return items;
    return items.filter((r) => String(r.steamId || '').includes(q));
  }, [items, filterSteamId]);

  const totals = useMemo(() => {
    const totalSpins = Number(summary?.totalSpins) || filtered.length;
    const totalCredits = Number(summary?.totalCredits) || filtered.reduce((sum, r) => sum + (Number(r.reward) || 0), 0);
    return { totalSpins, totalCredits };
  }, [filtered]);

  if (!user) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      </div>
    );
  }

  if (!userIsOwner) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-12 custom-scrollbar">
          <div className="w-full max-w-7xl mx-auto">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
            >
              Back to Admin
            </Link>

            <div className="flex items-center justify-between mb-6 md:mb-8 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/40">
                  <Sparkles className="text-yellow-400" size={20} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Credits</p>
                  <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">Spin History (30 Days)</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={filterSteamId}
                  onChange={(e) => setFilterSteamId(e.target.value)}
                  placeholder="Filter SteamID"
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase text-gray-200 placeholder:text-gray-600"
                />
                <button
                  onClick={loadHistory}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#11141d] border border-white/5 rounded-[1.5rem] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Total Spins</div>
                <div className="text-2xl font-black italic tracking-tighter mt-1">{Number(totals.totalSpins).toLocaleString('en-US')}</div>
              </div>
              <div className="bg-[#11141d] border border-white/5 rounded-[1.5rem] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Credits Distributed</div>
                <div className="text-2xl font-black italic tracking-tighter mt-1">{Number(totals.totalCredits).toLocaleString('en-US')}</div>
              </div>
            </div>

            <div className="bg-[#11141d] border border-white/5 rounded-[2rem] overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Latest Spins</div>
                {error && <div className="text-[11px] text-red-400 font-black">{error}</div>}
              </div>

              {loading ? (
                <div className="p-8 flex items-center gap-2 text-gray-500">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-[11px] uppercase tracking-widest font-black">Loading</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-gray-500 text-[11px]">No spins found.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filtered.slice(0, 500).map((r, idx) => {
                    const ts = r.createdAt ? new Date(r.createdAt) : null;
                    const timeLabel = ts && !isNaN(ts.getTime()) ? ts.toLocaleString() : '—';
                    const invHref = r.steamId ? `/inventory/${encodeURIComponent(r.steamId)}` : '#';
                    return (
                      <div key={`${r.steamId}-${r.createdAt}-${idx}`} className="p-4 md:p-5 flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-[11px] font-black uppercase tracking-widest text-gray-200">{timeLabel}</div>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <Link href={invHref} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300">
                              {r.steamId}
                            </Link>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(String(r.steamId || ''));
                                toast.success('Copied');
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"
                              aria-label="Copy SteamID"
                            >
                              <Copy size={14} />
                            </button>
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{String(r.role || 'user')}</span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Won</div>
                          <div className="text-xl font-black italic tracking-tighter text-emerald-300">{Number(r.reward || 0).toLocaleString('en-US')} CR</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
