"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { ArrowLeft, BarChart3, Calendar, Loader2, TrendingUp, Users, Sparkles, Trash2, ExternalLink, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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
    range?: number | 'all';
    bucketFormat?: string;
    slug: string | null;
    startDay: string | null;
    endDay: string;
    data: SeriesPoint[];
  };
  leaderboard?: LeaderboardRow[];
  excludedSteamId?: string | null;
};

type CreatorUsersResponse = {
  ok?: boolean;
  slug?: string;
  page?: number;
  limit?: number;
  total?: number;
  users?: Array<{
    steamId: string;
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
    pageViews: number;
    logins: number;
    newUsers: number;
    proPurchases: number;
    lastEventAt?: string | null;
  }>;
  excludeSteamId?: string | null;
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
  { label: 'Page Views', value: 'pageViews', color: '#3b82f6' },
  { label: 'Unique Visitors', value: 'uniqueVisitors', color: '#22c55e' },
  { label: 'Active Users', value: 'activeUsers', color: '#a855f7' },
  { label: 'Logins', value: 'logins', color: '#f59e0b' },
  { label: 'New Users', value: 'newUsers', color: '#ef4444' },
  { label: 'Pro Purchases', value: 'proPurchases', color: '#06b6d4' },
];

function formatDayLabel(day: string) {
  // day is YYYY-MM-DD or YYYY-MM (all-time buckets)
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
  const allowed: Array<keyof SeriesPoint> = ['pageViews', 'uniqueVisitors', 'activeUsers', 'logins', 'newUsers', 'proPurchases'];
  return (allowed.includes(s as any) ? (s as any) : 'pageViews') as keyof SeriesPoint;
}

type CreatorStatsAdminPageInnerProps = {
  forcedSlug?: string | null;
};

export function CreatorStatsAdminPageInner({ forcedSlug }: CreatorStatsAdminPageInnerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const forcedCreator = useMemo(() => {
    const s = String(forcedSlug || '').trim().toLowerCase();
    if (!s || s === 'all') return '';
    return s;
  }, [forcedSlug]);

  const basePath = useMemo(() => {
    if (!forcedCreator) return '/admin/creator-stats';
    return `/admin/creator-stats/${encodeURIComponent(forcedCreator)}`;
  }, [forcedCreator]);

  const [user, setUser] = useState<any>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [selectedCreator, setSelectedCreator] = useState<string>(forcedCreator || 'all');
  const [metric, setMetric] = useState<keyof SeriesPoint>('pageViews');

  const [manualSteamId, setManualSteamId] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualPurge, setManualPurge] = useState(false);
  const [manualBackfill, setManualBackfill] = useState(false);

  const [usersQ, setUsersQ] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersData, setUsersData] = useState<CreatorUsersResponse | null>(null);

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseData, setBaseData] = useState<ApiResponse | null>(null);
  const [seriesData, setSeriesData] = useState<ApiResponse | null>(null);

  const didInitFromUrl = useRef(false);
  const lastSyncedQuery = useRef<string>('');

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
    if (!userIsOwner) return;
    if (didInitFromUrl.current) return;

    const urlSlug = searchParams.get('slug');
    const urlRangeDays = searchParams.get('rangeDays');
    const urlMetric = searchParams.get('metric');

    if (forcedCreator) {
      setSelectedCreator(forcedCreator);
    } else if (urlSlug) {
      setSelectedCreator(String(urlSlug).toLowerCase());
    }
    if (urlRangeDays) setRangeDays(parseRangeDays(urlRangeDays));
    if (urlMetric) setMetric(parseMetric(urlMetric));

    didInitFromUrl.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoaded, userIsOwner]);

  useEffect(() => {
    if (!forcedCreator) return;
    if (selectedCreator === forcedCreator) return;
    setSelectedCreator(forcedCreator);
  }, [forcedCreator, selectedCreator]);

  useEffect(() => {
    if (!userLoaded) return;
    if (!userIsOwner) return;
    if (!didInitFromUrl.current) return;

    const qs = new URLSearchParams();
    if (!forcedCreator && selectedCreator !== 'all') qs.set('slug', selectedCreator);
    qs.set('rangeDays', rangeDays === 'all' ? 'all' : String(rangeDays));
    qs.set('metric', String(metric));
    const next = qs.toString();
    if (next === lastSyncedQuery.current) return;
    lastSyncedQuery.current = next;
    router.replace(`${basePath}?${next}`);
  }, [userLoaded, userIsOwner, selectedCreator, rangeDays, metric, router]);

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
      params.set('rangeDays', rangeDays === 'all' ? 'all' : String(rangeDays));
      params.set('includeWindows', '0');
      params.set('includeSeries', '0');
      params.set('includeLeaderboard', '1');

      const res = await fetch(`/api/admin/creator-stats?${params.toString()}`, {
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
      params.set('rangeDays', rangeDays === 'all' ? 'all' : String(rangeDays));
      if (selectedCreator !== 'all') params.set('slug', selectedCreator);
      params.set('includeWindows', '0');
      params.set('includeSeries', '1');
      params.set('includeLeaderboard', '0');

      const res = await fetch(`/api/admin/creator-stats?${params.toString()}`, {
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

  const loadCreatorUsers = async () => {
    if (selectedCreator === 'all') {
      setUsersData(null);
      setUsersError(null);
      return;
    }

    setUsersLoading(true);
    setUsersError(null);
    try {
      const params = new URLSearchParams();
      params.set('slug', selectedCreator);
      params.set('page', String(usersPage));
      params.set('limit', '50');
      params.set('range', rangeDays === 'all' ? 'all' : String(rangeDays));
      if (usersQ.trim()) params.set('q', usersQ.trim());

      const res = await fetch(`/api/admin/creator-users?${params.toString()}`, {
        cache: 'no-store',
      });

      const json = (await res.json().catch(() => null)) as CreatorUsersResponse | null;
      if (!res.ok || !json) {
        setUsersError((json as any)?.error || 'Failed to load creator users');
        setUsersData(null);
      } else {
        setUsersData(json);
      }
    } catch (e: any) {
      setUsersError(e?.message || 'Failed to load creator users');
      setUsersData(null);
    } finally {
      setUsersLoading(false);
    }
  };

  const resetAnalytics = async (scope: 'all' | 'creator') => {
    const slug = scope === 'creator' && selectedCreator !== 'all' ? selectedCreator : null;

    const confirmText = scope === 'all' ? 'RESET ALL' : 'RESET';
    const label = scope === 'all' ? 'all creators' : `creator "${slug}"`;

    if (scope === 'creator' && !slug) {
      window.alert('Select a creator first.');
      return;
    }

    try {
      const qs = new URLSearchParams();
      if (slug) qs.set('slug', slug);

      const dryRes = await fetch(`/api/admin/creator-stats/reset?${qs.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: true }),
      });

      const dryJson = await dryRes.json().catch(() => null);
      if (!dryRes.ok) {
        window.alert(dryJson?.error || 'Failed to compute reset size');
        return;
      }

      const match = Number(dryJson?.match || 0);
      const typed = window.prompt(
        `This will delete ${match} analytics events for ${label}.\n\nType "${confirmText}" to confirm.`,
        ''
      );
      if (typed !== confirmText) return;

      const res = await fetch(`/api/admin/creator-stats/reset?${qs.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: false }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        window.alert(json?.error || 'Failed to reset stats');
        return;
      }

      window.alert(`Deleted ${Number(json?.deleted || 0)} analytics events.`);
      await loadBase();
      await loadSeries();
    } catch (e: any) {
      window.alert(e?.message || 'Failed to reset stats');
    }
  };

  const updateAttribution = async (mode: 'set' | 'remove') => {
    const slug = selectedCreator !== 'all' ? selectedCreator : null;
    if (!slug) {
      window.alert('Select a creator first.');
      return;
    }

    const steamId = String(manualSteamId || '').trim();
    if (!/^\d{17}$/.test(steamId)) {
      window.alert('Enter a valid 17-digit SteamID64.');
      return;
    }

    const label = mode === 'set' ? 'Assign' : 'Remove';
    const extra = mode === 'remove' && manualPurge ? ' (and purge analytics events)' : '';
    const ok = window.confirm(`${label} SteamID ${steamId} to creator "${slug}"${extra}?`);
    if (!ok) return;

    setManualBusy(true);
    try {
      const res = await fetch('/api/admin/creator-attribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          steamId,
          slug,
          mode,
          purgeEvents: mode === 'remove' ? manualPurge : false,
          backfillEvents: mode === 'set' ? manualBackfill : false,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        window.alert(json?.error || 'Failed');
        return;
      }

      if (mode === 'remove') {
        window.alert(`Removed referral. Purged events: ${Number(json?.purgedEvents || 0)}`);
      } else {
        window.alert(`Referral assigned. Backfilled events: ${Number(json?.backfilledEvents || 0)}`);
      }

      setManualSteamId('');
      await loadBase();
      await loadSeries();
    } catch (e: any) {
      window.alert(e?.message || 'Failed');
    } finally {
      setManualBusy(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner, rangeDays]);

  useEffect(() => {
    if (!userIsOwner) return;
    if (selectedCreator === 'all') {
      setSeriesData(null);
      setLoadingSeries(false);
      return;
    }
    void loadSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner, rangeDays, selectedCreator]);

  useEffect(() => {
    if (!userIsOwner) return;
    if (selectedCreator === 'all') {
      setUsersData(null);
      setUsersLoading(false);
      setUsersError(null);
      return;
    }
    void loadCreatorUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner, rangeDays, selectedCreator, usersPage]);

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

  const creatorTotals = useMemo(() => {
    if (selectedCreator === 'all') return null;
    const points = Array.isArray(seriesData?.series?.data) ? seriesData!.series!.data : [];
    return points.reduce(
      (acc, p) => {
        acc.pageViews += Number((p as any).pageViews || 0);
        acc.uniqueVisitors += Number((p as any).uniqueVisitors || 0);
        acc.activeUsers += Number((p as any).activeUsers || 0);
        acc.logins += Number((p as any).logins || 0);
        acc.newUsers += Number((p as any).newUsers || 0);
        acc.proPurchases += Number((p as any).proPurchases || 0);
        return acc;
      },
      { pageViews: 0, uniqueVisitors: 0, activeUsers: 0, logins: 0, newUsers: 0, proPurchases: 0 }
    );
  }, [selectedCreator, seriesData?.series?.data]);

  const metricMeta = useMemo(
    () => METRIC_OPTIONS.find((m) => m.value === metric) || METRIC_OPTIONS[0],
    [metric]
  );

  const leaderboard = useMemo(() => {
    return Array.isArray(baseData?.leaderboard) ? baseData!.leaderboard! : [];
  }, [baseData?.leaderboard]);

  const isLoading = loadingBase || loadingSeries;

  useEffect(() => {
    // Reset pagination when creator or query changes
    setUsersPage(1);
  }, [selectedCreator, usersQ, rangeDays]);

  useEffect(() => {
    if (!userIsOwner) return;
    if (selectedCreator === 'all') return;
    const t = setTimeout(() => {
      void loadCreatorUsers();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersQ]);

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

                {selectedCreator !== 'all' && creatorTotals && (
                  <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Views</div>
                      <div className="text-2xl font-black mt-2">{creatorTotals.pageViews}</div>
                    </div>
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Unique</div>
                      <div className="text-2xl font-black mt-2">{creatorTotals.uniqueVisitors}</div>
                    </div>
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Active</div>
                      <div className="text-2xl font-black mt-2">{creatorTotals.activeUsers}</div>
                    </div>
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Logins</div>
                      <div className="text-2xl font-black mt-2">{creatorTotals.logins}</div>
                    </div>
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">New</div>
                      <div className="text-2xl font-black mt-2">{creatorTotals.newUsers}</div>
                    </div>
                    <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Pro</div>
                      <div className="text-2xl font-black mt-2">{creatorTotals.proPurchases}</div>
                    </div>
                  </div>
                )}
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

                {!forcedCreator && (
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
                )}

                <Link
                  href="/creators"
                  className="px-4 py-2 bg-[#11141d] border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-white/5 inline-flex items-center gap-2"
                >
                  <ExternalLink size={14} />
                  Manage Creators
                </Link>

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
                <div className="mb-8 bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                      Admin Controls
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => void resetAnalytics('creator')}
                        className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/30 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        Reset Selected Creator
                      </button>
                      <button
                        onClick={() => void resetAnalytics('all')}
                        className="px-4 py-2 rounded-xl bg-red-600 border border-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        Reset All Creator Stats
                      </button>
                    </div>
                  </div>
                  {seriesData?.excludedSteamId ? (
                    <div className="mt-3 text-[10px] text-gray-500">
                      Excluding creator SteamID from stats: <span className="text-gray-300 font-black">{seriesData.excludedSteamId}</span>
                    </div>
                  ) : null}

                  <div className="mt-5 pt-5 border-t border-white/10">
                    <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-3">
                      Manual Referral Management
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        value={manualSteamId}
                        onChange={(e) => setManualSteamId(e.target.value)}
                        placeholder="SteamID64 (17 digits)"
                        className="px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-xs font-black tracking-widest text-white w-[280px]"
                      />
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 select-none">
                        <input
                          type="checkbox"
                          checked={manualPurge}
                          onChange={(e) => setManualPurge(e.target.checked)}
                        />
                        Purge events on remove
                      </label>
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 select-none">
                        <input
                          type="checkbox"
                          checked={manualBackfill}
                          onChange={(e) => setManualBackfill(e.target.checked)}
                        />
                        Backfill unattributed events on assign
                      </label>
                      <button
                        disabled={manualBusy}
                        onClick={() => void updateAttribution('set')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Assign to Creator
                      </button>
                      <button
                        disabled={manualBusy}
                        onClick={() => void updateAttribution('remove')}
                        className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/30 disabled:opacity-50"
                      >
                        Remove from Creator
                      </button>
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">
                      Select a creator above, then assign/remove a SteamID as their referral.
                    </div>
                  </div>
                </div>

                <div className="bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                      <TrendingUp size={14} />
                      Daily Trend
                    </div>
                    <div className="text-[10px] md:text-xs text-gray-500">
                      {seriesData?.series?.startDay ? `${seriesData.series.startDay} → ` : ''}{seriesData?.series?.endDay}
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
                          {leaderboard.slice(0, 50).map((r: LeaderboardRow) => (
                            <tr key={r.slug} className="border-t border-white/5 text-[11px] md:text-xs">
                              <td className="py-3 pr-4 font-black">
                                <Link
                                  href={`/admin/creator-stats/${encodeURIComponent(r.slug)}`}
                                  className="text-white hover:text-emerald-300"
                                >
                                  {r.slug}
                                </Link>
                              </td>
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

                {selectedCreator !== 'all' && (
                  <div className="mt-8 bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                      <div className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                        <Users size={14} />
                        Referred Users ({usersData?.total || 0})
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input
                            value={usersQ}
                            onChange={(e) => setUsersQ(e.target.value)}
                            placeholder="Search SteamID"
                            className="pl-9 pr-3 py-2 bg-black/20 border border-white/10 rounded-xl text-xs font-black tracking-widest text-white w-[220px]"
                          />
                        </div>
                        <button
                          disabled={usersLoading || usersPage <= 1}
                          onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 disabled:opacity-50"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          disabled={usersLoading || (usersData?.total ? usersPage * 50 >= usersData.total : true)}
                          onClick={() => setUsersPage((p) => p + 1)}
                          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 disabled:opacity-50"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    {usersLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="animate-spin text-emerald-400" size={26} />
                      </div>
                    ) : usersError ? (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm">
                        {usersError}
                      </div>
                    ) : (usersData?.users?.length || 0) === 0 ? (
                      <div className="text-gray-500 text-sm">No referred users yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-[980px] w-full text-left">
                          <thead>
                            <tr className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                              <th className="py-3 pr-4">SteamID</th>
                              <th className="py-3 pr-4">Views</th>
                              <th className="py-3 pr-4">Logins</th>
                              <th className="py-3 pr-4">New</th>
                              <th className="py-3 pr-4">Pro</th>
                              <th className="py-3 pr-4">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(usersData?.users || []).map((u) => (
                              <tr key={u.steamId} className="border-t border-white/5 text-[11px] md:text-xs">
                                <td className="py-3 pr-4 font-black text-white">{u.steamId}</td>
                                <td className="py-3 pr-4 text-gray-300">{u.pageViews}</td>
                                <td className="py-3 pr-4 text-gray-300">{u.logins}</td>
                                <td className="py-3 pr-4 text-gray-300">{u.newUsers}</td>
                                <td className="py-3 pr-4 text-gray-300">{u.proPurchases}</td>
                                <td className="py-3 pr-4">
                                  <div className="flex items-center gap-2">
                                    <Link
                                      href={`/admin/creator-stats/${encodeURIComponent(selectedCreator)}/user/${encodeURIComponent(u.steamId)}?range=${encodeURIComponent(String(rangeDays))}`}
                                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500"
                                    >
                                      Stats
                                    </Link>
                                    <Link
                                      href={`/inventory/${encodeURIComponent(u.steamId)}`}
                                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                                    >
                                      Inventory
                                    </Link>
                                    <Link
                                      href={`/admin/user/${encodeURIComponent(u.steamId)}`}
                                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                                    >
                                      Admin
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

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

export default function CreatorStatsAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
          <Sidebar />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-emerald-400" size={32} />
          </div>
        </div>
      }
    >
      <CreatorStatsAdminPageInner />
    </Suspense>
  );
}
