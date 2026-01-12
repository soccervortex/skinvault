"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { ArrowLeft, BarChart3, Calendar, ExternalLink, Loader2, TrendingUp, User, Trash2 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

type RangeKey = '1' | '7' | '30' | '90' | '365' | 'all';

type ApiResponse = {
  ok?: boolean;
  slug?: string;
  steamId?: string;
  range?: any;
  bucketFormat?: string;
  attribution?: {
    refSlug: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
  };
  totals?: {
    pageViews: number;
    logins: number;
    newUsers: number;
    proPurchases: number;
  };
  series?: Array<{
    bucket: string;
    pageViews: number;
    logins: number;
    newUsers: number;
    proPurchases: number;
  }>;
  error?: string;
};

const RANGE_OPTIONS: Array<{ label: string; value: RangeKey }> = [
  { label: '24H', value: '1' },
  { label: '7D', value: '7' },
  { label: '30D', value: '30' },
  { label: '90D', value: '90' },
  { label: '365D', value: '365' },
  { label: 'All', value: 'all' },
];

function formatBucketLabel(bucket: string) {
  // bucket: YYYY-MM-DD or YYYY-MM
  if (!bucket) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
    const [y, m, d] = bucket.split('-').map((x) => Number(x));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  }
  if (/^\d{4}-\d{2}$/.test(bucket)) {
    const [y, m] = bucket.split('-').map((x) => Number(x));
    const dt = new Date(y, (m || 1) - 1, 1);
    return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return bucket;
}

export default function CreatorUserStatsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<any>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const slug = String((params as any)?.slug || '').toLowerCase();
  const steamId = String((params as any)?.steamId || '');

  const range = (searchParams.get('range') as RangeKey | null) || '30';

  const [manageBusy, setManageBusy] = useState(false);
  const [purgeOnRemove, setPurgeOnRemove] = useState(true);
  const [backfillOnAssign, setBackfillOnAssign] = useState(true);

  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteAttribution, setDeleteAttribution] = useState(true);
  const [deleteAnalytics, setDeleteAnalytics] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

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

  useEffect(() => {
    if (!userIsOwner) return;
    if (!slug || !/^\d{17}$/.test(steamId)) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set('slug', slug);
        qs.set('steamId', steamId);
        qs.set('range', range);

        const res = await fetch(`/api/admin/creator-user-stats?${qs.toString()}`, {
          headers: {
            'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
          },
          cache: 'no-store',
        });

        const json = (await res.json().catch(() => null)) as ApiResponse | null;
        if (!res.ok || !json) {
          setError((json as any)?.error || 'Failed to load user stats');
          setData(null);
        } else {
          setData(json);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load user stats');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [userIsOwner, slug, steamId, range]);

  const manageReferral = async (mode: 'set' | 'remove') => {
    if (!userIsOwner) return;
    if (!slug || !/^\d{17}$/.test(steamId)) return;

    const extra = mode === 'remove'
      ? (purgeOnRemove ? ' (purge events)' : '')
      : (backfillOnAssign ? ' (backfill unattributed events)' : '');
    const ok = window.confirm(`${mode === 'set' ? 'Assign' : 'Remove'} referral for ${steamId} → ${slug}${extra}?`);
    if (!ok) return;

    setManageBusy(true);
    try {
      const res = await fetch('/api/admin/creator-attribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          mode,
          steamId,
          slug,
          purgeEvents: mode === 'remove' ? purgeOnRemove : false,
          backfillEvents: mode === 'set' ? backfillOnAssign : false,
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
        window.alert(`Assigned referral. Backfilled events: ${Number(json?.backfilledEvents || 0)}`);
      }

      // reload
      router.refresh();
    } catch (e: any) {
      window.alert(e?.message || 'Failed');
    } finally {
      setManageBusy(false);
    }
  };

  const deleteUserTracking = async () => {
    if (!userIsOwner) return;
    if (!/^\d{17}$/.test(steamId)) return;
    if (!deleteAttribution && !deleteAnalytics) {
      window.alert('Select at least one delete option.');
      return;
    }

    setDeleteBusy(true);
    try {
      const dryRes = await fetch('/api/admin/user-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          steamId,
          dryRun: true,
          deleteAttribution,
          deleteAnalytics,
        }),
      });

      const dryJson = await dryRes.json().catch(() => null);
      if (!dryRes.ok) {
        window.alert(dryJson?.error || 'Failed to compute delete size');
        return;
      }

      const a = Number(dryJson?.counts?.attributionDocs || 0);
      const e = Number(dryJson?.counts?.analyticsEvents || 0);
      const typed = window.prompt(
        `This will delete for SteamID ${steamId}:\n- attribution docs: ${a}\n- analytics events: ${e}\n\nType DELETE to confirm.`,
        ''
      );
      if (typed !== 'DELETE') return;

      const res = await fetch('/api/admin/user-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          steamId,
          dryRun: false,
          deleteAttribution,
          deleteAnalytics,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        window.alert(json?.error || 'Failed to delete user data');
        return;
      }

      window.alert(
        `Deleted. Attribution: ${Number(json?.deletedAttribution || 0)}, Analytics: ${Number(json?.deletedAnalytics || 0)}`
      );
      router.refresh();
    } catch (err: any) {
      window.alert(err?.message || 'Failed to delete user data');
    } finally {
      setDeleteBusy(false);
    }
  };

  const series = useMemo(() => {
    const arr = Array.isArray(data?.series) ? data!.series! : [];
    return arr.map((p: any) => ({
      ...p,
      label: formatBucketLabel(p.bucket),
    }));
  }, [data?.series]);

  const totals = data?.totals || { pageViews: 0, logins: 0, newUsers: 0, proPurchases: 0 };

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

  if (!userIsOwner) return null;

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-12 custom-scrollbar">
          <div className="w-full max-w-7xl mx-auto">
            <Link
              href="/admin/creator-stats"
              className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Creator Stats
            </Link>

            <div className="flex items-start justify-between gap-4 flex-wrap mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl md:rounded-2xl bg-emerald-500/10 border border-emerald-500/40 shrink-0">
                  <BarChart3 className="text-emerald-400" size={18} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Referral User</p>
                  <h1 className="text-xl md:text-3xl font-black italic uppercase tracking-tighter">
                    {slug} / {steamId}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-1 flex items-center">
                  {RANGE_OPTIONS.map((r) => (
                    <Link
                      key={r.value}
                      href={`/admin/creator-stats/${encodeURIComponent(slug)}/user/${encodeURIComponent(steamId)}?range=${encodeURIComponent(r.value)}`}
                      className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        range === r.value ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Calendar size={12} className="inline mr-2" />
                      {r.label}
                    </Link>
                  ))}
                </div>

                <Link
                  href={`/inventory/${encodeURIComponent(steamId)}`}
                  className="px-4 py-2 bg-[#11141d] border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-white/5 inline-flex items-center gap-2"
                >
                  <ExternalLink size={14} />
                  Inventory
                </Link>

                <Link
                  href={`/admin/user/${encodeURIComponent(steamId)}`}
                  className="px-4 py-2 bg-[#11141d] border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-white/5 inline-flex items-center gap-2"
                >
                  <User size={14} />
                  Admin User
                </Link>

                <div className="flex items-center gap-2 bg-[#11141d] border border-white/10 rounded-xl p-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 select-none">
                    <input
                      type="checkbox"
                      checked={purgeOnRemove}
                      onChange={(e) => setPurgeOnRemove(e.target.checked)}
                    />
                    Purge
                  </label>
                  <button
                    disabled={manageBusy}
                    onClick={() => void manageReferral('remove')}
                    className="px-3 py-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/30 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-[#11141d] border border-white/10 rounded-xl p-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 select-none">
                    <input
                      type="checkbox"
                      checked={backfillOnAssign}
                      onChange={(e) => setBackfillOnAssign(e.target.checked)}
                    />
                    Backfill
                  </label>
                  <button
                    disabled={manageBusy}
                    onClick={() => void manageReferral('set')}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-emerald-400" size={32} />
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm">{error}</div>
            ) : (
              <>
                <div className="mb-8 bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-3">
                    Delete User Tracking
                  </div>
                  <div className="text-[10px] text-gray-500 mb-4">
                    This removes the user from referral tracking. Optionally wipe all their analytics events.
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 select-none">
                      <input
                        type="checkbox"
                        checked={deleteAttribution}
                        onChange={(e) => setDeleteAttribution(e.target.checked)}
                      />
                      Delete attribution
                    </label>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 select-none">
                      <input
                        type="checkbox"
                        checked={deleteAnalytics}
                        onChange={(e) => setDeleteAnalytics(e.target.checked)}
                      />
                      Delete analytics
                    </label>
                    <button
                      disabled={deleteBusy}
                      onClick={() => void deleteUserTracking()}
                      className="ml-auto px-4 py-2 rounded-xl bg-red-600 border border-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
                  <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Views</div>
                    <div className="text-2xl font-black mt-2">{totals.pageViews}</div>
                  </div>
                  <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Logins</div>
                    <div className="text-2xl font-black mt-2">{totals.logins}</div>
                  </div>
                  <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">New</div>
                    <div className="text-2xl font-black mt-2">{totals.newUsers}</div>
                  </div>
                  <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Pro</div>
                    <div className="text-2xl font-black mt-2">{totals.proPurchases}</div>
                  </div>
                </div>

                <div className="bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                      <TrendingUp size={14} />
                      Trend
                    </div>
                    <div className="text-[10px] md:text-xs text-gray-500">
                      Bucket: {data?.bucketFormat === '%Y-%m' ? 'Monthly' : 'Daily'}
                    </div>
                  </div>

                  <div className="h-[280px] md:h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
                        <CartesianGrid stroke="#1f2430" strokeDasharray="3 3" />
                        <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 10, fontWeight: 800 }} />
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
                        <Line type="monotone" dataKey="pageViews" stroke="#3b82f6" strokeWidth={3} dot={false} name="Views" />
                        <Line type="monotone" dataKey="logins" stroke="#f59e0b" strokeWidth={2} dot={false} name="Logins" />
                        <Line type="monotone" dataKey="newUsers" stroke="#ef4444" strokeWidth={2} dot={false} name="New" />
                        <Line type="monotone" dataKey="proPurchases" stroke="#06b6d4" strokeWidth={2} dot={false} name="Pro" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-6 text-[10px] text-gray-500">
                  Attribution: {data?.attribution?.refSlug || 'none'}
                  {data?.attribution?.firstSeenAt ? ` • firstSeen ${String(data.attribution.firstSeenAt).slice(0, 10)}` : ''}
                  {data?.attribution?.lastSeenAt ? ` • lastSeen ${String(data.attribution.lastSeenAt).slice(0, 10)}` : ''}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
