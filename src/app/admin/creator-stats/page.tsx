"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { ArrowLeft, BarChart3, Calendar, Loader2, TrendingUp, Users, Sparkles } from 'lucide-react';
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

type RangeDays = 30 | 90 | 365;

type SeriesPoint = {
  day: string;
  pageViews: number;
  uniqueVisitors: number;
  activeUsers: number;
  logins: number;
  newUsers: number;
  proPurchases: number;
};

type LeaderboardRow = {
  slug: string;
  pageViews: number;
  uniqueVisitors: number;
  activeUsers: number;
  uniqueUsers: number;
  returningUsers: number;
  newUsers: number;
  logins: number;
  proPurchases: number;
  proActiveUsers: number;
};

type ApiResponse = {
  creators?: string[];
  windows?: any;
  series?: {
    rangeDays: number;
    slug: string | null;
    startDay: string;
    endDay: string;
    data: SeriesPoint[];
  };
  leaderboard?: LeaderboardRow[];
};

const RANGE_OPTIONS: Array<{ label: string; value: RangeDays }> = [
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '365D', value: 365 },
];

const METRIC_OPTIONS: Array<{ label: string; value: keyof SeriesPoint; color: string }> = [
  { label: 'Page Views', value: 'pageViews', color: '#3b82f6' },
  { label: 'Unique Visitors', value: 'uniqueVisitors', color: '#22c55e' },
  { label: 'Active Users', value: 'activeUsers', color: '#a855f7' },
  { label: 'Logins', value: 'logins', color: '#f59e0b' },
  { label: 'New Users', value: 'newUsers', color: '#ef4444' },
  { label: 'Pro Purchases', value: 'proPurchases', color: '#06b6d4' },
];

function formatDayLabel(day: string) {
  // day is YYYY-MM-DD
  try {
    const [y, m, d] = day.split('-').map((x) => Number(x));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  } catch {
    return day;
  }
}

export default function CreatorStatsAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [selectedCreator, setSelectedCreator] = useState<string>('all');
  const [metric, setMetric] = useState<keyof SeriesPoint>('pageViews');

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseData, setBaseData] = useState<ApiResponse | null>(null);
  const [seriesData, setSeriesData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);
      setUserLoaded(true);
    } catch {
      setUser(null);
      setUserLoaded(true);
    }
  }, []);

  const userIsOwner = isOwner(user?.steamId);

  useEffect(() => {
    if (!userLoaded) return;
    if (!userIsOwner) {
      router.push('/');
      return;
    }
  }, [userLoaded, userIsOwner, router]);

  const loadBase = async () => {
    setLoadingBase(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('rangeDays', String(rangeDays));

      const res = await fetch(`/api/admin/creator-stats?${params.toString()}`, {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok || !json) {
        setError('Failed to load creator stats');
        setBaseData(null);
      } else {
        setBaseData(json);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load creator stats');
      setBaseData(null);
    } finally {
      setLoadingBase(false);
    }
  };

  const loadSeries = async () => {
    setLoadingSeries(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('rangeDays', String(rangeDays));
      if (selectedCreator !== 'all') params.set('slug', selectedCreator);

      const res = await fetch(`/api/admin/creator-stats?${params.toString()}`, {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok || !json) {
        setError('Failed to load creator stats');
        setSeriesData(null);
      } else {
        setSeriesData(json);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load creator stats');
      setSeriesData(null);
    } finally {
      setLoadingSeries(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner, rangeDays]);

  useEffect(() => {
    if (!userIsOwner) return;
    void loadSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner, rangeDays, selectedCreator]);

  const creators = useMemo(() => {
    const arr = Array.isArray(baseData?.creators) ? baseData!.creators! : [];
    return arr.slice().sort((a, b) => a.localeCompare(b));
  }, [baseData?.creators]);

  const series = useMemo(() => {
    const points = Array.isArray(seriesData?.series?.data) ? seriesData!.series!.data : [];
    return points.map((p) => ({
      ...p,
      dayLabel: formatDayLabel(p.day),
    }));
  }, [seriesData?.series?.data]);

  const metricMeta = useMemo(
    () => METRIC_OPTIONS.find((m) => m.value === metric) || METRIC_OPTIONS[0],
    [metric]
  );

  const leaderboard = useMemo(() => {
    return Array.isArray(baseData?.leaderboard) ? baseData!.leaderboard! : [];
  }, [baseData?.leaderboard]);

  const isLoading = loadingBase || loadingSeries;

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
                <div className="p-2 rounded-xl md:rounded-2xl bg-emerald-500/10 border border-emerald-500/40 shrink-0">
                  <BarChart3 className="text-emerald-400" size={18} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                    Creator Analytics
                  </p>
                  <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                    Creator Stats
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
                        rangeDays === r.value
                          ? 'bg-emerald-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Calendar size={12} className="inline mr-2" />
                      {r.label}
                    </button>
                  ))}
                </div>

                <select
                  value={selectedCreator}
                  onChange={(e) => setSelectedCreator(e.target.value)}
                  className="px-4 py-2 bg-[#11141d] border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white"
                >
                  <option value="all">All Creators</option>
                  {creators.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

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

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-emerald-400" size={32} />
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm">
                {error}
              </div>
            ) : (
              <>
                <div className="bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                      <TrendingUp size={14} />
                      Daily Trend
                    </div>
                    <div className="text-[10px] md:text-xs text-gray-500">
                      {seriesData?.series?.startDay} → {seriesData?.series?.endDay}
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
                    <Users size={14} />
                    Leaderboard
                  </div>

                  {leaderboard.length === 0 ? (
                    <div className="text-gray-500 text-sm">No creator traffic yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full text-left">
                        <thead>
                          <tr className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                            <th className="py-3 pr-4">Creator</th>
                            <th className="py-3 pr-4">Views</th>
                            <th className="py-3 pr-4">Unique</th>
                            <th className="py-3 pr-4">Active</th>
                            <th className="py-3 pr-4">New</th>
                            <th className="py-3 pr-4">Returning</th>
                            <th className="py-3 pr-4">Logins</th>
                            <th className="py-3 pr-4">Pro</th>
                            <th className="py-3 pr-4">Pro Active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.slice(0, 50).map((r) => (
                            <tr key={r.slug} className="border-t border-white/5 text-[11px] md:text-xs">
                              <td className="py-3 pr-4 font-black text-white">{r.slug}</td>
                              <td className="py-3 pr-4 text-gray-300">{r.pageViews}</td>
                              <td className="py-3 pr-4 text-gray-300">{r.uniqueVisitors}</td>
                              <td className="py-3 pr-4 text-gray-300">{r.activeUsers}</td>
                              <td className="py-3 pr-4 text-gray-300">{r.newUsers}</td>
                              <td className="py-3 pr-4 text-gray-300">{r.returningUsers}</td>
                              <td className="py-3 pr-4 text-gray-300">{r.logins}</td>
                              <td className="py-3 pr-4 text-gray-300">{r.proPurchases}</td>
                              <td className="py-3 pr-4 text-emerald-300 font-black">{r.proActiveUsers}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-6 text-[10px] text-gray-500 flex items-center gap-2">
                  <Sparkles size={12} className="text-emerald-400" />
                  Stats update in realtime as events are recorded.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
