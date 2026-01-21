"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { Copy, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/app/components/Toast';

type SpinHistoryRow = {
  id: string;
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

type ApiResponse = {
  ok?: boolean;
  days?: number;
  page?: number;
  limit?: number;
  total?: number;
  steamId?: string | null;
  q?: string | null;
  todaySummary?: SpinHistorySummary;
  summary?: SpinHistorySummary;
  allTimeSummary?: SpinHistorySummary;
  user?: any;
  items?: SpinHistoryRow[];
  error?: string;
};

type GrantsResponse = {
  ok?: boolean;
  page?: number;
  limit?: number;
  total?: number;
  steamId?: string | null;
  q?: string | null;
  items?: Array<{
    id: string;
    createdAt: string;
    bySteamId: string;
    targetSteamId: string;
    day: string;
    amount: number;
    reason: string | null;
    ip: string | null;
    rolledBackAt: string | null;
    rolledBackBy: string | null;
    rolledBackReason: string | null;
  }>;
  error?: string;
};

function safeInt(v: string, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export default function AdminSpinsPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SpinHistoryRow[]>([]);
  const [todaySummary, setTodaySummary] = useState<SpinHistorySummary | null>(null);
  const [summary, setSummary] = useState<SpinHistorySummary | null>(null);
  const [allTimeSummary, setAllTimeSummary] = useState<SpinHistorySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterSteamId, setFilterSteamId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [days, setDays] = useState(30);
  const [total, setTotal] = useState(0);
  const [userStats, setUserStats] = useState<any>(null);
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantAmount, setGrantAmount] = useState('1');
  const [grantReason, setGrantReason] = useState('');

  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantsError, setGrantsError] = useState<string | null>(null);
  const [grants, setGrants] = useState<NonNullable<GrantsResponse['items']>>([]);
  const [grantsPage, setGrantsPage] = useState(1);
  const [grantsLimit] = useState(25);
  const [grantsTotal, setGrantsTotal] = useState(0);
  const [grantsFilter, setGrantsFilter] = useState('');
  const [rollbackBusyId, setRollbackBusyId] = useState<string | null>(null);
  const [deleteSpinBusyId, setDeleteSpinBusyId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('days', String(days));
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      qs.set('tzOffset', String(new Date().getTimezoneOffset()));

      const localStart = new Date();
      localStart.setHours(0, 0, 0, 0);
      const localEnd = new Date(localStart.getTime() + 24 * 60 * 60 * 1000);
      qs.set('todayStart', localStart.toISOString());
      qs.set('todayEnd', localEnd.toISOString());

      const trimmed = String(filterSteamId || '').trim();
      if (/^\d{17}$/.test(trimmed)) {
        qs.set('steamId', trimmed);
      } else if (trimmed) {
        qs.set('q', trimmed);
      }

      const res = await fetch(`/api/admin/spins/history?${qs.toString()}`, {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok || !json) throw new Error((json as any)?.error || 'Failed');
      setItems(Array.isArray(json?.items) ? (json.items as any) : []);
      setTodaySummary((json as any)?.todaySummary || null);
      setSummary((json as any)?.summary || null);
      setAllTimeSummary((json as any)?.allTimeSummary || null);
      setTotal(Number((json as any)?.total || 0));
      setUserStats((json as any)?.user || null);
    } catch (e: any) {
      setItems([]);
      setTodaySummary(null);
      setSummary(null);
      setAllTimeSummary(null);
      setTotal(0);
      setUserStats(null);
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [days, filterSteamId, limit, page]);

  useEffect(() => {
    if (!userIsOwner) return;
    void loadHistory();
  }, [userIsOwner, loadHistory]);

  const loadGrants = useCallback(async () => {
    setGrantsLoading(true);
    setGrantsError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(grantsPage));
      qs.set('limit', String(grantsLimit));

      const trimmed = String(grantsFilter || '').trim();
      if (/^\d{17}$/.test(trimmed)) {
        qs.set('steamId', trimmed);
      } else if (trimmed) {
        qs.set('q', trimmed);
      }

      const res = await fetch(`/api/admin/spins/grants?${qs.toString()}`, {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      const json = (await res.json().catch(() => null)) as GrantsResponse | null;
      if (!res.ok || !json) throw new Error((json as any)?.error || 'Failed');
      setGrants(Array.isArray(json?.items) ? (json.items as any) : []);
      setGrantsTotal(Number(json?.total || 0));
    } catch (e: any) {
      setGrants([]);
      setGrantsTotal(0);
      setGrantsError(e?.message || 'Failed');
    } finally {
      setGrantsLoading(false);
    }
  }, [grantsFilter, grantsLimit, grantsPage]);

  useEffect(() => {
    if (!userIsOwner) return;
    void loadGrants();
  }, [userIsOwner, loadGrants]);

  useEffect(() => {
    setGrantsPage(1);
  }, [grantsFilter]);

  useEffect(() => {
    setPage(1);
  }, [filterSteamId, days, limit]);

  const normalizedSteamId = useMemo(() => {
    const v = String(filterSteamId || '').trim();
    return /^\d{17}$/.test(v) ? v : '';
  }, [filterSteamId]);

  const canGrant = Boolean(normalizedSteamId);

  const submitGrant = useCallback(async () => {
    if (!canGrant) return;
    const amount = safeInt(String(grantAmount || ''), 1, 1, 10000);
    setGrantBusy(true);
    try {
      const res = await fetch('/api/admin/spins/grant', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ steamId: normalizedSteamId, amount, reason: String(grantReason || '').trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to grant spins');
      toast.success('Granted');
      await loadHistory();
      await loadGrants();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setGrantBusy(false);
    }
  }, [canGrant, grantAmount, grantReason, loadGrants, loadHistory, normalizedSteamId, toast]);

  const rollbackGrant = useCallback(async (grantId: string) => {
    if (!grantId) return;
    const ok = window.confirm('Rollback this grant? This will remove the bonus spins that were added.');
    if (!ok) return;
    const reason = window.prompt('Reason (optional)') || '';
    setRollbackBusyId(grantId);
    try {
      const res = await fetch('/api/admin/spins/grants/rollback', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ grantId, reason: String(reason || '').trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to rollback');
      toast.success('Rolled back');
      await loadHistory();
      await loadGrants();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setRollbackBusyId(null);
    }
  }, [loadGrants, loadHistory, toast]);

  const deleteSpin = useCallback(async (spinId: string) => {
    if (!spinId) return;
    const ok = window.confirm('Delete this spin? This will reverse the credits and remove it from stats.');
    if (!ok) return;
    const reason = window.prompt('Reason (optional)') || '';
    setDeleteSpinBusyId(spinId);
    try {
      const res = await fetch('/api/admin/spins/history/delete', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ spinId, reason: String(reason || '').trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to delete spin');
      toast.success('Deleted');
      await loadHistory();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setDeleteSpinBusyId(null);
    }
  }, [loadHistory, toast]);

  const totals30d = useMemo(() => {
    const totalSpins = Number(summary?.totalSpins) || 0;
    const totalCredits = Number(summary?.totalCredits) || 0;
    return { totalSpins, totalCredits };
  }, [summary]);

  const totalsToday = useMemo(() => {
    const totalSpins = Number(todaySummary?.totalSpins) || 0;
    const totalCredits = Number(todaySummary?.totalCredits) || 0;
    return { totalSpins, totalCredits };
  }, [todaySummary]);

  const allTimeTotals = useMemo(() => {
    const totalSpins = Number(allTimeSummary?.totalSpins) || 0;
    const totalCredits = Number(allTimeSummary?.totalCredits) || 0;
    return { totalSpins, totalCredits };
  }, [allTimeSummary]);

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
                  <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">Spins Manager</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={filterSteamId}
                  onChange={(e) => setFilterSteamId(e.target.value)}
                  placeholder="Filter SteamID"
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase text-gray-200 placeholder:text-gray-600"
                />
                {String(filterSteamId || '').trim().length > 0 && (
                  <button
                    onClick={() => setFilterSteamId('')}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                  >
                    Clear
                  </button>
                )}
                <select
                  value={String(days)}
                  onChange={(e) => setDays(safeInt(e.target.value, 30, 1, 365))}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black tracking-widest uppercase text-gray-200"
                  aria-label="Range"
                >
                  <option value="1">1d</option>
                  <option value="7">7d</option>
                  <option value="30">30d</option>
                  <option value="90">90d</option>
                </select>
                <select
                  value={String(limit)}
                  onChange={(e) => setLimit(safeInt(e.target.value, 100, 1, 500))}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black tracking-widest uppercase text-gray-200"
                  aria-label="Limit"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
                <button
                  onClick={loadHistory}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                >
                  {loading ? 'Loading' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#11141d] border border-white/5 rounded-[1.5rem] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Total Spins (Today)</div>
                <div className="text-2xl font-black italic tracking-tighter mt-1">{Number(totalsToday.totalSpins).toLocaleString('en-US')}</div>
              </div>
              <div className="bg-[#11141d] border border-white/5 rounded-[1.5rem] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Credits Distributed (Today)</div>
                <div className="text-2xl font-black italic tracking-tighter mt-1">{Number(totalsToday.totalCredits).toLocaleString('en-US')}</div>
              </div>
              <div className="bg-[#11141d] border border-white/5 rounded-[1.5rem] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Total Spins (30d)</div>
                <div className="text-2xl font-black italic tracking-tighter mt-1">{Number(totals30d.totalSpins).toLocaleString('en-US')}</div>
              </div>
              <div className="bg-[#11141d] border border-white/5 rounded-[1.5rem] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Credits Distributed (30d)</div>
                <div className="text-2xl font-black italic tracking-tighter mt-1">{Number(totals30d.totalCredits).toLocaleString('en-US')}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#11141d] border border-white/5 rounded-[1.5rem] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Total Spins (All-Time)</div>
                <div className="text-2xl font-black italic tracking-tighter mt-1">{Number(allTimeTotals.totalSpins).toLocaleString('en-US')}</div>
              </div>
              <div className="bg-[#11141d] border border-white/5 rounded-[1.5rem] p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Credits Distributed (All-Time)</div>
                <div className="text-2xl font-black italic tracking-tighter mt-1">{Number(allTimeTotals.totalCredits).toLocaleString('en-US')}</div>
              </div>
            </div>

            {canGrant && (
              <div className="bg-[#11141d] border border-white/5 rounded-[2rem] overflow-hidden mb-6">
                <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">User</div>
                    <div className="text-[12px] font-black uppercase tracking-widest text-gray-200">{normalizedSteamId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={grantAmount}
                      onChange={(e) => setGrantAmount(e.target.value)}
                      placeholder="Spins"
                      className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase text-gray-200 placeholder:text-gray-600 w-[110px]"
                    />
                    <input
                      value={grantReason}
                      onChange={(e) => setGrantReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase text-gray-200 placeholder:text-gray-600 w-[240px]"
                    />
                    <button
                      onClick={submitGrant}
                      disabled={grantBusy || !canGrant}
                      className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest text-emerald-200 disabled:opacity-60"
                    >
                      {grantBusy ? 'Granting' : 'Grant Spins'}
                    </button>
                  </div>
                </div>

                {userStats && (
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-black/20 border border-white/5 rounded-[1.25rem] p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Role</div>
                      <div className="text-xl font-black italic tracking-tighter mt-1">{String(userStats?.role || 'user')}</div>
                    </div>
                    <div className="bg-black/20 border border-white/5 rounded-[1.25rem] p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Daily Limit</div>
                      <div className="text-xl font-black italic tracking-tighter mt-1">{userStats?.dailyLimit == null ? '∞' : Number(userStats.dailyLimit).toLocaleString('en-US')}</div>
                    </div>
                    <div className="bg-black/20 border border-white/5 rounded-[1.25rem] p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Bonus Spins (Today)</div>
                      <div className="text-xl font-black italic tracking-tighter mt-1">{Number(userStats?.bonusSpins || 0).toLocaleString('en-US')}</div>
                    </div>
                    <div className="bg-black/20 border border-white/5 rounded-[1.25rem] p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Remaining (Today)</div>
                      <div className="text-xl font-black italic tracking-tighter mt-1">{userStats?.remainingSpins == null ? '∞' : Number(userStats.remainingSpins).toLocaleString('en-US')}</div>
                    </div>
                  </div>
                )}

                {userStats && (
                  <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-black/20 border border-white/5 rounded-[1.25rem] p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Spins (Today)</div>
                      <div className="text-xl font-black italic tracking-tighter mt-1">{Number(userStats?.today?.totalSpins || 0).toLocaleString('en-US')}</div>
                    </div>
                    <div className="bg-black/20 border border-white/5 rounded-[1.25rem] p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Credits (Today)</div>
                      <div className="text-xl font-black italic tracking-tighter mt-1">{Number(userStats?.today?.totalCredits || 0).toLocaleString('en-US')}</div>
                    </div>
                    <div className="bg-black/20 border border-white/5 rounded-[1.25rem] p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Spins (All-Time)</div>
                      <div className="text-xl font-black italic tracking-tighter mt-1">{Number(userStats?.allTime?.totalSpins || 0).toLocaleString('en-US')}</div>
                    </div>
                    <div className="bg-black/20 border border-white/5 rounded-[1.25rem] p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Credits (All-Time)</div>
                      <div className="text-xl font-black italic tracking-tighter mt-1">{Number(userStats?.allTime?.totalCredits || 0).toLocaleString('en-US')}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-[#11141d] border border-white/5 rounded-[2rem] overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Latest Spins</div>
                {error && <div className="text-[11px] text-red-400 font-black">{error}</div>}
              </div>

              {!loading && total > limit && (
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Page {page} / {Math.max(1, Math.ceil(total / limit))} ({Number(total).toLocaleString('en-US')} rows)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                      disabled={page <= 1}
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                      disabled={page >= Math.ceil(total / limit)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="p-8 flex items-center gap-2 text-gray-500">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-[11px] uppercase tracking-widest font-black">Loading</span>
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 text-gray-500 text-[11px]">No spins found.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {items.map((r: SpinHistoryRow, idx: number) => {
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
                            <button
                              onClick={() => deleteSpin(String(r.id || ''))}
                              disabled={deleteSpinBusyId === String(r.id || '')}
                              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-[10px] font-black uppercase tracking-widest text-red-200 disabled:opacity-60"
                            >
                              {deleteSpinBusyId === String(r.id || '') ? 'Deleting' : 'Delete'}
                            </button>
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

            <div className="bg-[#11141d] border border-white/5 rounded-[2rem] overflow-hidden mt-6">
              <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Recent Spin Grants</div>
                <div className="flex items-center gap-2">
                  <input
                    value={grantsFilter}
                    onChange={(e) => setGrantsFilter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void loadGrants();
                    }}
                    placeholder="Filter SteamID"
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase text-gray-200 placeholder:text-gray-600"
                  />
                  {String(grantsFilter || '').trim().length > 0 && (
                    <button
                      onClick={() => setGrantsFilter('')}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                    >
                      Clear
                    </button>
                  )}
                  {grantsError && <div className="text-[11px] text-red-400 font-black">{grantsError}</div>}
                </div>
              </div>

              {!grantsLoading && grantsTotal > grantsLimit && (
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Page {grantsPage} / {Math.max(1, Math.ceil(grantsTotal / grantsLimit))} ({Number(grantsTotal).toLocaleString('en-US')} rows)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGrantsPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                      disabled={grantsPage <= 1}
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setGrantsPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                      disabled={grantsPage >= Math.ceil(grantsTotal / grantsLimit)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {grantsLoading ? (
                <div className="p-8 flex items-center gap-2 text-gray-500">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-[11px] uppercase tracking-widest font-black">Loading</span>
                </div>
              ) : grants.length === 0 ? (
                <div className="p-8 text-gray-500 text-[11px]">No grants found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Time</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">By</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Target</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Day</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Amount</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Reason</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grants.map((g, idx) => {
                        const ts = g.createdAt ? new Date(g.createdAt) : null;
                        const timeLabel = ts && !isNaN(ts.getTime()) ? ts.toLocaleString() : '—';
                        const byHref = g.bySteamId ? `/inventory/${encodeURIComponent(g.bySteamId)}` : '#';
                        const targetHref = g.targetSteamId ? `/inventory/${encodeURIComponent(g.targetSteamId)}` : '#';
                        return (
                          <tr key={`${g.createdAt}-${g.targetSteamId}-${idx}`} className="border-b border-white/5 last:border-b-0">
                            <td className="px-5 py-3 text-[11px] font-black text-gray-200 whitespace-nowrap">{timeLabel}</td>
                            <td className="px-5 py-3 text-[11px] font-black text-gray-300">
                              <div className="flex items-center gap-2">
                                <Link href={byHref} className="hover:text-white">{g.bySteamId}</Link>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(g.bySteamId || ''));
                                    toast.success('Copied');
                                  }}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"
                                  aria-label="Copy admin SteamID"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-[11px] font-black text-gray-300">
                              <div className="flex items-center gap-2">
                                <Link href={targetHref} className="hover:text-white">{g.targetSteamId}</Link>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(g.targetSteamId || ''));
                                    toast.success('Copied');
                                  }}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"
                                  aria-label="Copy target SteamID"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-[11px] font-black text-gray-300 whitespace-nowrap">{g.day}</td>
                            <td className="px-5 py-3 text-[11px] font-black text-emerald-200 whitespace-nowrap">+{Number(g.amount || 0).toLocaleString('en-US')}</td>
                            <td className="px-5 py-3 text-[11px] text-gray-300 max-w-[420px] truncate" title={g.reason || ''}>{g.reason || '—'}</td>
                            <td className="px-5 py-3 text-[11px]">
                              {g.rolledBackAt ? (
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Rolled back</span>
                              ) : (
                                <button
                                  onClick={() => rollbackGrant(String(g.id || ''))}
                                  disabled={rollbackBusyId === String(g.id || '')}
                                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-[10px] font-black uppercase tracking-widest text-red-200 disabled:opacity-60"
                                >
                                  {rollbackBusyId === String(g.id || '') ? 'Rolling' : 'Rollback'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
