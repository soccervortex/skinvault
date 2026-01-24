"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { ArrowLeft, Loader2, Star, Users, Gift, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

type ReferralRow = {
  referredSteamId: string;
  createdAt: string | null;
  landing: string | null;
};

type ClaimRow = {
  milestoneId: string;
  referralsRequired: number;
  reward: any;
  createdAt: string | null;
};

type ApiResponse = {
  ok?: boolean;
  steamId?: string;
  totals?: {
    referrals: number;
    claims: number;
    creditsGranted: number;
  };
  referrals?: {
    page: number;
    limit: number;
    total: number;
    rows: ReferralRow[];
  };
  claims?: ClaimRow[];
  error?: string;
};

function safeInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function getRewardLabel(reward: any): string {
  const type = String(reward?.type || '').trim();
  if (type === 'credits') return `+${Number(reward?.amount || 0)} credits`;
  if (type === 'spins') return `+${Number(reward?.amount || 0)} spins`;
  if (type === 'discord_access') return 'Discord access';
  if (type === 'wishlist_slot') return '+1 wishlist slot';
  if (type === 'price_tracker_slot') return '+1 price tracker slot';
  if (type === 'price_scan_boost') return 'Price scan boost';
  if (type === 'cache_boost') return 'Cache boost';
  return type || 'Reward';
}

export default function AffiliateUserAdminPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const steamId = String((params as any)?.steamId || '').trim();

  const [user, setUser] = useState<any>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const [manualReferredSteamId, setManualReferredSteamId] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualOk, setManualOk] = useState<string | null>(null);

  const page = safeInt(searchParams.get('page'), 1, 1, 100000);
  const limit = safeInt(searchParams.get('limit'), 100, 1, 500);

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

  const load = useCallback(async () => {
    if (!userLoaded) return;
    if (!userIsOwner) return;
    if (!/^\d{17}$/.test(steamId)) {
      setError('Invalid Steam ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('steamId', steamId);
      qs.set('page', String(page));
      qs.set('limit', String(limit));

      const res = await fetch(`/api/admin/affiliate-user?${qs.toString()}`, {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok || !json) {
        setError((json as any)?.error || 'Failed to load affiliate');
        setData(null);
      } else {
        setData(json);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load affiliate');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [limit, page, steamId, userIsOwner, userLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals || null;
  const referralsRows = useMemo(() => {
    return Array.isArray(data?.referrals?.rows) ? (data!.referrals!.rows as ReferralRow[]) : [];
  }, [data?.referrals?.rows]);

  const claimsRows = useMemo(() => {
    return Array.isArray(data?.claims) ? (data!.claims as ClaimRow[]) : [];
  }, [data?.claims]);

  const totalReferrals = Number(data?.referrals?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalReferrals / Math.max(1, limit)));

  const setPage = (nextPage: number) => {
    const qp = new URLSearchParams(searchParams.toString());
    qp.set('page', String(nextPage));
    qp.set('limit', String(limit));
    router.replace(`${window.location.pathname}?${qp.toString()}`);
  };

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

  const manageReferral = async (action: 'add' | 'delete', referredSteamId: string) => {
    setManualLoading(true);
    setManualError(null);
    setManualOk(null);
    try {
      const ref = String(referredSteamId || '').trim();
      if (!/^\d{17}$/.test(ref)) throw new Error('Invalid referred Steam ID');
      if (ref === steamId) throw new Error('Cannot refer self');

      const res = await fetch('/api/admin/affiliate-referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action, referrerSteamId: steamId, referredSteamId: ref }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Request failed'));

      if (action === 'delete' && Number(json?.deleted || 0) <= 0) {
        throw new Error('Referral not found');
      }

      if (action === 'add') {
        setManualOk('Referral added');
        setManualReferredSteamId('');
      } else {
        setManualOk('Referral removed');
      }

      await load();
    } catch (e: any) {
      setManualError(String(e?.message || 'Failed'));
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-12 custom-scrollbar">
          <div className="w-full max-w-7xl mx-auto">
            <Link
              href="/admin/affiliate-stats"
              className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Affiliate Stats
            </Link>

            <div className="flex items-start justify-between gap-4 flex-wrap mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/40 shrink-0">
                  <Star className="text-blue-400" size={18} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                    Affiliate
                  </p>
                  <h1 className="text-xl md:text-3xl font-black italic uppercase tracking-tighter">{steamId}</h1>
                </div>
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
                {totals ? (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
                      <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Referrals</div>
                        <div className="text-2xl font-black mt-2">{totals.referrals}</div>
                      </div>
                      <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Milestone Claims</div>
                        <div className="text-2xl font-black mt-2">{totals.claims}</div>
                      </div>
                      <div className="bg-[#11141d] border border-white/5 rounded-2xl p-4">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Credits Granted</div>
                        <div className="text-2xl font-black mt-2">{totals.creditsGranted}</div>
                      </div>
                    </div>

                    {manualError && (
                      <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-[11px]">{manualError}</div>
                    )}
                    {manualOk && (
                      <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-300 text-[11px]">{manualOk}</div>
                    )}
                  </div>
                ) : null}

                <div className="bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                      <Users size={14} />
                      Referred Users
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2">
                        <input
                          value={manualReferredSteamId}
                          onChange={(e) => setManualReferredSteamId(e.target.value)}
                          placeholder="Add referred SteamID..."
                          className="w-[220px] max-w-[70vw] bg-transparent text-[11px] font-black text-white placeholder-gray-500 outline-none"
                        />
                        <button
                          disabled={manualLoading}
                          onClick={() => manageReferral('add', manualReferredSteamId)}
                          className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            manualLoading ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          Add
                        </button>
                      </div>

                      <button
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          page <= 1 ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Page {page} / {totalPages}
                      </div>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          page >= totalPages ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {referralsRows.length === 0 ? (
                    <div className="text-gray-500 text-sm">No referrals found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full text-left">
                        <thead>
                          <tr className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                            <th className="py-3 pr-4">Referred Steam ID</th>
                            <th className="py-3 pr-4">Created</th>
                            <th className="py-3 pr-4">Landing</th>
                            <th className="py-3 pr-4">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referralsRows.map((r) => (
                            <tr key={r.referredSteamId} className="border-t border-white/5">
                              <td className="py-3 pr-4 text-[11px] font-black text-gray-300">{r.referredSteamId}</td>
                              <td className="py-3 pr-4 text-[11px] text-gray-400">{r.createdAt ? new Date(r.createdAt).toLocaleString('en-US') : '—'}</td>
                              <td className="py-3 pr-4 text-[11px] text-gray-400 truncate max-w-[520px]">{r.landing || '—'}</td>
                              <td className="py-3 pr-4">
                                <button
                                  disabled={manualLoading}
                                  onClick={async () => {
                                    const ok = window.confirm(`Remove referral ${r.referredSteamId} from ${steamId}?`);
                                    if (!ok) return;
                                    await manageReferral('delete', r.referredSteamId);
                                  }}
                                  className={`inline-flex items-center justify-center px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    manualLoading ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white'
                                  }`}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-8 bg-[#11141d] border border-white/5 rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-xl">
                  <div className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-4">
                    <Gift size={14} />
                    Milestone Claims
                  </div>

                  {claimsRows.length === 0 ? (
                    <div className="text-gray-500 text-sm">No milestone claims found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full text-left">
                        <thead>
                          <tr className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                            <th className="py-3 pr-4">Milestone</th>
                            <th className="py-3 pr-4">Required</th>
                            <th className="py-3 pr-4">Reward</th>
                            <th className="py-3 pr-4">Claimed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {claimsRows.map((c) => (
                            <tr key={c.milestoneId} className="border-t border-white/5">
                              <td className="py-3 pr-4 text-[11px] font-black text-gray-300">{c.milestoneId}</td>
                              <td className="py-3 pr-4 text-[11px] font-black">{c.referralsRequired}</td>
                              <td className="py-3 pr-4 text-[11px] font-black">{getRewardLabel(c.reward)}</td>
                              <td className="py-3 pr-4 text-[11px] text-gray-400">{c.createdAt ? new Date(c.createdAt).toLocaleString('en-US') : '—'}</td>
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
