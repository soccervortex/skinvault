"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { ArrowLeft, BarChart3, Calendar, Loader2, Star } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

type RangeDays = 1 | 7 | 30 | 90 | 365 | 'all';

type SeriesPoint = {
  day: string;
  referrals: number;
  claims: number;
  creditsGranted: number;
};

type LeaderboardRow = {
  steamId: string;
  referrals: number;
  claims: number;
  creditsGranted: number;
  firstReferralAt: string | null;
  lastReferralAt: string | null;
};

type ApiResponse = {
  ok?: boolean;
  totals?: {
    totalReferrals: number;
    uniqueAffiliates: number;
    totalClaims: number;
    creditsGranted: number;
  };
  series?: {
    range?: number | 'all';
    bucketFormat?: string;
    startDay?: string | null;
    endDay?: string | null;
    data?: SeriesPoint[];
  };
  leaderboard?: LeaderboardRow[];
  error?: string;
};

const RANGE_OPTIONS: Array<{ label: string; value: RangeDays }> = [
  { label: '24H', value: 1 },
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '365D', value: 365 },
  { label: 'All', value: 'all' },
];

const METRIC_OPTIONS: Array<{ label: string; value: keyof SeriesPoint; color: string }> = [
  { label: 'Referrals', value: 'referrals', color: '#3b82f6' },
  { label: 'Claims', value: 'claims', color: '#22c55e' },
  { label: 'Credits Granted', value: 'creditsGranted', color: '#f59e0b' },
];

function formatDayLabel(day: string) {
  try {
    if (/^\d{4}-\d{2}$/.test(day)) {
      const [y, m] = day.split('-').map((x) => Number(x));
      const dt = new Date(y, (m || 1) - 1, 1);
      return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    const [y, m, d] = day.split('-').map((x) => Number(x));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  } catch {
    return day;
  }
}

function parseRangeDays(raw: string | null): RangeDays {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'all' || s === 'all_time' || s === 'alltime') return 'all';
  const n = Number(s);
  if (n === 1 || n === 7 || n === 30 || n === 90 || n === 365) return n as any;
  return 30;
}

function parseMetric(raw: string | null): keyof SeriesPoint {
  const s = String(raw || '').trim();
  const allowed: Array<keyof SeriesPoint> = ['referrals', 'claims', 'creditsGranted'];
  return (allowed.includes(s as any) ? (s as any) : 'referrals') as keyof SeriesPoint;
}

export default function AffiliateStatsAdminPage() {
  const [user, setUser] = useState<any>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [metric, setMetric] = useState<keyof SeriesPoint>('referrals');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferOk, setTransferOk] = useState<string | null>(null);

  const [optReferrals, setOptReferrals] = useState(true);
  const [optClaims, setOptClaims] = useState(true);
  const [optCreditsBalance, setOptCreditsBalance] = useState(false);
  const [optCreditsLedger, setOptCreditsLedger] = useState(false);
  const [optBonusSpins, setOptBonusSpins] = useState(false);
  const [optUserRewards, setOptUserRewards] = useState(false);

  const didInitFromUrl = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      setUser(stored ? JSON.parse(stored) : null);
      setUserLoaded(true);
    } catch {
      setUser(null);
      setUserLoaded(true);
    }
  }, []);

  const userIsOwner = isOwner(user?.steamId);

  useEffect(() => {
    if (!userLoaded) return;
    if (!userIsOwner) return;
    if (didInitFromUrl.current) return;

    const url = new URL(window.location.href);
    const qp = url.searchParams;

    const urlRange = qp.get('rangeDays');
    const urlMetric = qp.get('metric');

    if (urlRange) setRangeDays(parseRangeDays(urlRange));
    if (urlMetric) setMetric(parseMetric(urlMetric));

    didInitFromUrl.current = true;
  }, [userLoaded, userIsOwner]);

  useEffect(() => {
    if (!userLoaded) return;
    if (!userIsOwner) return;

    const qs = new URLSearchParams();
    qs.set('rangeDays', rangeDays === 'all' ? 'all' : String(rangeDays));
    qs.set('metric', String(metric));

    const next = `${window.location.pathname}?${qs.toString()}`;
    window.history.replaceState(null, '', next);
  }, [userLoaded, userIsOwner, rangeDays, metric]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('rangeDays', rangeDays === 'all' ? 'all' : String(rangeDays));

      const res = await fetch(`/api/admin/affiliate-stats?${params.toString()}`, {
        cache: 'no-store',
      });

      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok || !json) {
        setError((json as any)?.error || 'Failed to load affiliate stats');
        setData(null);
      } else {
        setData(json);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load affiliate stats');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    if (!userLoaded) return;
    if (!userIsOwner) return;
    void load();
  }, [userLoaded, userIsOwner, load]);

  const series = useMemo(() => {
    const rows = Array.isArray(data?.series?.data) ? (data!.series!.data as SeriesPoint[]) : [];
    return rows.map((r) => ({
      ...r,
      dayLabel: formatDayLabel(String(r.day)),
    }));
  }, [data?.series?.data]);

  const metricMeta = useMemo(() => {
    return METRIC_OPTIONS.find((m) => m.value === metric) || METRIC_OPTIONS[0];
  }, [metric]);

  const leaderboard = useMemo(() => {
    return Array.isArray(data?.leaderboard) ? (data!.leaderboard as LeaderboardRow[]) : [];
  }, [data?.leaderboard]);

  const totals = data?.totals || null;

  if (!userLoaded) {
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
              <ArrowLeft size={14} />
              Back to Admin
            </Link>

            <div className="flex items-start justify-between gap-4 flex-wrap mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/40 shrink-0">
                  <Star className="text-blue-400" size={18} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                    Affiliate Analytics
                  </p>
                  <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                    Affiliate Stats
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-1 flex items-center">
                  {RANGE_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRangeDays(r.value)}
                      className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        rangeDays === r.value ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Calendar size={12} className="inline mr-2" />
                      {r.label}
                    </button>
                  ))}
                </div>

                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as any)}
                  className="px-4 py-2 bg-[#11141d] border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white"
                >
                  {METRIC_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-400" size={32} />
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm">
                {error}
              </div>
            ) : (
              <>
                <div className="mb-8 bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">Admin Tools</div>
                      <div className="mt-1 text-xl md:text-2xl font-black italic uppercase tracking-tighter">Transfer referrals</div>
                      <div className="mt-2 text-[11px] text-gray-400 max-w-2xl">
                        Move an affiliate's credited referrals to another SteamID (for fixing wrong attribution). By default it also moves milestone claims.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                      <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">From SteamID</div>
                      <input
                        value={transferFrom}
                        onChange={(e) => setTransferFrom(e.target.value)}
                        placeholder="7656119..."
                        className="mt-2 w-full px-3 py-2 rounded-xl bg-[#0b0d14] border border-white/10 text-[12px] font-black"
                      />
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                      <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">To SteamID</div>
                      <input
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        placeholder="7656119..."
                        className="mt-2 w-full px-3 py-2 rounded-xl bg-[#0b0d14] border border-white/10 text-[12px] font-black"
                      />
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Action</div>
                        <div className="mt-2 text-[11px] text-gray-400">Choose what to move, then confirm.</div>
                      </div>
                      <button
                        disabled={transferLoading}
                        onClick={async () => {
                          setTransferLoading(true);
                          setTransferError(null);
                          setTransferOk(null);
                          try {
                            const from = String(transferFrom || '').trim();
                            const to = String(transferTo || '').trim();
                            const opts = {
                              referrals: optReferrals,
                              claims: optClaims,
                              creditsBalance: optCreditsBalance,
                              creditsLedger: optCreditsLedger,
                              bonusSpins: optBonusSpins,
                              userRewards: optUserRewards,
                            };

                            const enabled = Object.entries(opts).filter(([, v]) => !!v).map(([k]) => k);
                            if (enabled.length === 0) {
                              throw new Error('Select at least one thing to transfer');
                            }

                            const ok = window.confirm(
                              `Transfer from ${from} to ${to}?\n\nThis will move: ${enabled.join(', ')}\n\nThis cannot be automatically undone.`
                            );
                            if (!ok) {
                              setTransferLoading(false);
                              return;
                            }

                            const res = await fetch('/api/admin/affiliate-transfer', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                fromSteamId: from,
                                toSteamId: to,
                                options: opts,
                              }),
                            });
                            const json = await res.json().catch(() => null);
                            if (!res.ok) throw new Error(String(json?.error || 'Transfer failed'));
                            setTransferOk(`Transfer complete. Moved referrals: ${Number(json?.moved?.referrals || 0)}; moved claims: ${Number(json?.moved?.claims || 0)}.`);
                            await load();
                          } catch (e: any) {
                            setTransferError(String(e?.message || 'Transfer failed'));
                          } finally {
                            setTransferLoading(false);
                          }
                        }}
                        className={`mt-4 w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          transferLoading ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
                      >
                        {transferLoading ? 'Transferring...' : 'Transfer'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                      <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Move</div>
                      <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-300 font-black">
                        <input type="checkbox" className="accent-amber-500" checked={optReferrals} onChange={(e) => setOptReferrals(e.target.checked)} />
                        Referrals
                      </label>
                      <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-300 font-black">
                        <input type="checkbox" className="accent-amber-500" checked={optClaims} onChange={(e) => setOptClaims(e.target.checked)} />
                        Milestone claims
                      </label>
                    </div>

                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                      <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Optional</div>
                      <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-300 font-black">
                        <input type="checkbox" className="accent-amber-500" checked={optCreditsBalance} onChange={(e) => setOptCreditsBalance(e.target.checked)} />
                        Credits balance
                      </label>
                      <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-300 font-black">
                        <input type="checkbox" className="accent-amber-500" checked={optBonusSpins} onChange={(e) => setOptBonusSpins(e.target.checked)} />
                        Bonus spins balance
                      </label>
                      <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-300 font-black">
                        <input type="checkbox" className="accent-amber-500" checked={optUserRewards} onChange={(e) => setOptUserRewards(e.target.checked)} />
                        User rewards (discord/boosts)
                      </label>
                    </div>

                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                      <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Advanced</div>
                      <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-300 font-black">
                        <input type="checkbox" className="accent-amber-500" checked={optCreditsLedger} onChange={(e) => setOptCreditsLedger(e.target.checked)} />
                        Credits ledger history
                      </label>
                      <div className="mt-2 text-[11px] text-gray-500">
                        Ledger transfer is only for data cleanup. It will rewrite history.
                      </div>
                    </div>
                  </div>

                  {transferError ? (
                    <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-[11px]">{transferError}</div>
                  ) : null}
                  {transferOk ? (
                    <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-300 text-[11px]">{transferOk}</div>
                  ) : null}
                </div>

                {totals ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Total Referrals</div>
                      <div className="text-2xl font-black mt-2">{totals.totalReferrals}</div>
                    </div>
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Unique Affiliates</div>
                      <div className="text-2xl font-black mt-2">{totals.uniqueAffiliates}</div>
                    </div>
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Total Claims</div>
                      <div className="text-2xl font-black mt-2">{totals.totalClaims}</div>
                    </div>
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Credits Granted</div>
                      <div className="text-2xl font-black mt-2">{totals.creditsGranted}</div>
                    </div>
                  </div>
                ) : null}

                <div className="bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                      <BarChart3 size={14} />
                      Trend
                    </div>
                    <div className="text-[10px] md:text-xs text-gray-500">
                      {data?.series?.startDay ? `${data.series.startDay} → ` : ''}{data?.series?.endDay || ''}
                    </div>
                  </div>

                  <div className="h-[280px] md:h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
                        <CartesianGrid stroke="#1f2430" strokeDasharray="3 3" />
                        <XAxis dataKey="dayLabel" stroke="#6b7280" tick={{ fontSize: 10, fontWeight: 800 }} />
                        <YAxis stroke="#6b7280" tick={{ fontSize: 10, fontWeight: 800 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0b0d14',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12,
                            color: '#fff',
                          }}
                          labelStyle={{ color: '#9ca3af', fontWeight: 900, fontSize: 11 }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey={metric}
                          stroke={metricMeta.color}
                          strokeWidth={3}
                          dot={false}
                          name={metricMeta.label}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-8 bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-4">
                    <Star size={14} />
                    Top Affiliates
                  </div>

                  {leaderboard.length === 0 ? (
                    <div className="text-gray-500 text-sm">No affiliate referrals yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full text-left">
                        <thead>
                          <tr className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                            <th className="py-3 pr-4">Steam ID</th>
                            <th className="py-3 pr-4">Referrals</th>
                            <th className="py-3 pr-4">Claims</th>
                            <th className="py-3 pr-4">Credits Granted</th>
                            <th className="py-3 pr-4">First</th>
                            <th className="py-3 pr-4">Last</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((r) => (
                            <tr key={r.steamId} className="border-t border-white/5">
                              <td className="py-3 pr-4 text-[11px] font-black text-gray-300">
                                <Link href={`/admin/affiliate-stats/${encodeURIComponent(r.steamId)}`} className="hover:text-white">
                                  {r.steamId}
                                </Link>
                              </td>
                              <td className="py-3 pr-4 text-[11px] font-black">{r.referrals}</td>
                              <td className="py-3 pr-4 text-[11px] font-black">{r.claims}</td>
                              <td className="py-3 pr-4 text-[11px] font-black">{r.creditsGranted}</td>
                              <td className="py-3 pr-4 text-[11px] text-gray-400">{r.firstReferralAt ? new Date(r.firstReferralAt).toLocaleDateString('en-US') : '—'}</td>
                              <td className="py-3 pr-4 text-[11px] text-gray-400">{r.lastReferralAt ? new Date(r.lastReferralAt).toLocaleDateString('en-US') : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
