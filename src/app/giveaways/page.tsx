"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Link from 'next/link';
import { Loader2, Sparkles, Ticket, Wallet } from 'lucide-react';
import { useToast } from '@/app/components/Toast';

type PrizeItem = {
  id?: string;
  name?: string;
  market_hash_name?: string;
  image?: string | null;
} | null;

type GiveawaySummary = {
  id: string;
  title: string;
  prize: string;
  prizeItem?: PrizeItem;
  startAt: string | null;
  endAt: string | null;
  creditsPerEntry: number;
  winnerCount: number;
  totalEntries: number;
  totalParticipants: number;
  isActive: boolean;
  drawnAt: string | null;
};

type GiveawayDetail = GiveawaySummary & {
  description: string;
};

type ItemInfo = {
  name: string;
  image: string | null;
  market_hash_name: string;
  rarityName: string | null;
  rarityColor: string | null;
};

type MyWinnerStatus = {
  isWinner: boolean;
  claimStatus: string | null;
  claimDeadlineAt: string | null;
  claimedAt: string | null;
  forfeitedAt: string | null;
};

type DailyClaimStatus = {
  canClaim: boolean;
  nextEligibleAt: string;
  serverNow: string;
};

function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function getGiveawayStatus(nowMs: number, g: GiveawaySummary): { label: string; className: string } {
  const drawnAtMs = g.drawnAt ? new Date(g.drawnAt).getTime() : NaN;
  if (Number.isFinite(drawnAtMs)) {
    return { label: 'DRAWN', className: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' };
  }

  const startMs = g.startAt ? new Date(g.startAt).getTime() : NaN;
  const endMs = g.endAt ? new Date(g.endAt).getTime() : NaN;

  if (Number.isFinite(startMs) && nowMs < startMs) {
    return { label: 'UPCOMING', className: 'bg-blue-500/10 border-blue-500/40 text-blue-300' };
  }

  if (Number.isFinite(endMs) && nowMs >= endMs) {
    return { label: 'ENDED (NOT DRAWN)', className: 'bg-amber-500/10 border-amber-500/40 text-amber-300' };
  }

  if (g.isActive) {
    return { label: 'ACTIVE', className: 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300' };
  }

  return { label: 'ENDED', className: 'bg-white/5 border-white/10 text-gray-300' };
}

function rarityColorFallback(name: string | null | undefined): string {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return '#4b5563';
  if (n.includes('covert')) return '#eb4b4b';
  if (n.includes('extraordinary')) return '#eb4b4b';
  if (n.includes('classified')) return '#d32ce6';
  if (n.includes('restricted')) return '#8847ff';
  if (n.includes('mil-spec') || n.includes('milspec')) return '#4b69ff';
  if (n.includes('industrial')) return '#5e98d9';
  if (n.includes('consumer') || n.includes('base')) return '#b0c3d9';
  if (n.includes('high grade')) return '#4b69ff';
  return '#4b5563';
}

function hexToRgba(hex: string, alpha: number): string {
  const h = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return `rgba(75,85,99,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatShortTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

export default function GiveawaysPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [giveaways, setGiveaways] = useState<GiveawaySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GiveawayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimStatusLoading, setClaimStatusLoading] = useState(false);
  const [claimStatus, setClaimStatus] = useState<DailyClaimStatus | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowTick, setNowTick] = useState(0);

  const [entriesToBuy, setEntriesToBuy] = useState<number>(1);
  const [entering, setEntering] = useState(false);
  const [myEntries, setMyEntries] = useState<number>(0);
  const [myEntryLoading, setMyEntryLoading] = useState(false);

  const [itemInfoByKey, setItemInfoByKey] = useState<Record<string, ItemInfo | null>>({});
  const [myWinner, setMyWinner] = useState<MyWinnerStatus | null>(null);
  const [myWinnerLoading, setMyWinnerLoading] = useState(false);
  const [claimingPrize, setClaimingPrize] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const nowMs = Date.now();
  const active = useMemo(() => giveaways.filter((g) => g.isActive), [giveaways]);
  const upcoming = useMemo(() => {
    return giveaways.filter((g) => {
      if (g.isActive) return false;
      if (g.drawnAt) return false;
      const startMs = g.startAt ? new Date(g.startAt).getTime() : NaN;
      return Number.isFinite(startMs) && startMs > nowMs;
    });
  }, [giveaways, nowMs]);
  const past = useMemo(() => {
    return giveaways.filter((g) => {
      if (g.isActive) return false;
      if (g.drawnAt) return true;
      const endMs = g.endAt ? new Date(g.endAt).getTime() : NaN;
      return Number.isFinite(endMs) ? endMs <= nowMs : true;
    });
  }, [giveaways, nowMs]);

  const loadGiveaways = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/giveaways', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setGiveaways(Array.isArray(json?.giveaways) ? json.giveaways : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load giveaways');
      setGiveaways([]);
    } finally {
      setLoading(false);
    }
  };

  const ensureItemInfo = async (key: string) => {
    const k = String(key || '').trim();
    if (!k) return;
    if (Object.prototype.hasOwnProperty.call(itemInfoByKey, k)) return;

    setItemInfoByKey((prev) => ({ ...prev, [k]: null }));

    try {
      const res = await fetch(`/api/item/info?market_hash_name=${encodeURIComponent(k)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      const info: ItemInfo = {
        name: String(json?.name || json?.market_hash_name || k),
        image: json?.image ? String(json.image) : null,
        market_hash_name: String(json?.market_hash_name || k),
        rarityName: json?.rarity?.name ? String(json.rarity.name) : (typeof json?.rarity === 'string' ? String(json.rarity) : null),
        rarityColor: (json?.rarity?.color ? String(json.rarity.color) : null) || null,
      };

      setItemInfoByKey((prev) => ({ ...prev, [k]: info }));
    } catch {
      setItemInfoByKey((prev) => ({ ...prev, [k]: null }));
    }
  };

  const loadMyWinner = async (id: string) => {
    if (!user?.steamId) {
      setMyWinner(null);
      return;
    }
    setMyWinnerLoading(true);
    try {
      const res = await fetch(`/api/giveaways/${encodeURIComponent(id)}/my-winner`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      const st: MyWinnerStatus = {
        isWinner: !!json?.isWinner,
        claimStatus: json?.claimStatus ? String(json.claimStatus) : null,
        claimDeadlineAt: json?.claimDeadlineAt ? String(json.claimDeadlineAt) : null,
        claimedAt: json?.claimedAt ? String(json.claimedAt) : null,
        forfeitedAt: json?.forfeitedAt ? String(json.forfeitedAt) : null,
      };
      setMyWinner(st);
    } catch {
      setMyWinner(null);
    } finally {
      setMyWinnerLoading(false);
    }
  };

  const loadDailyClaimStatus = async () => {
    if (!user?.steamId) {
      setClaimStatus(null);
      setServerOffsetMs(0);
      return;
    }
    setClaimStatusLoading(true);
    try {
      const res = await fetch('/api/credits/daily-claim', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      const st: DailyClaimStatus = {
        canClaim: !!json?.canClaim,
        nextEligibleAt: String(json?.nextEligibleAt || ''),
        serverNow: String(json?.serverNow || ''),
      };
      setClaimStatus(st);
      const offset = Date.parse(st.serverNow) - Date.now();
      setServerOffsetMs(Number.isFinite(offset) ? offset : 0);
    } catch {
      setClaimStatus(null);
      setServerOffsetMs(0);
    } finally {
      setClaimStatusLoading(false);
    }
  };

  const loadCredits = async () => {
    if (!user?.steamId) {
      setCreditsBalance(null);
      return;
    }
    setCreditsLoading(true);
    try {
      const res = await fetch('/api/credits/balance', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setCreditsBalance(Number(json?.balance || 0));
    } catch {
      setCreditsBalance(null);
    } finally {
      setCreditsLoading(false);
    }
  };

  useEffect(() => {
    loadGiveaways();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const keys = giveaways
      .slice(0, 30)
      .map((g) => String(g?.prizeItem?.market_hash_name || g?.prizeItem?.id || '').trim())
      .filter(Boolean);
    keys.forEach((k) => {
      void ensureItemInfo(k);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giveaways]);

  useEffect(() => {
    loadCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.steamId]);

  useEffect(() => {
    loadDailyClaimStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.steamId]);

  useEffect(() => {
    if (!user?.steamId) return;
    if (!claimStatus || claimStatus.canClaim) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [user?.steamId, claimStatus?.canClaim, claimStatus?.nextEligibleAt]);

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setMyEntries(0);
    setMyWinner(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/giveaways/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setDetail(json?.giveaway || null);

      const key = String(json?.giveaway?.prizeItem?.market_hash_name || json?.giveaway?.prizeItem?.id || '').trim();
      if (key) void ensureItemInfo(key);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load giveaway');
    } finally {
      setDetailLoading(false);
    }

    if (user?.steamId) {
      setMyEntryLoading(true);
      try {
        const r2 = await fetch(`/api/giveaways/${encodeURIComponent(id)}/my-entry`, { cache: 'no-store' });
        const j2 = await r2.json();
        if (r2.ok) setMyEntries(Number(j2?.entries || 0));
      } catch {
        setMyEntries(0);
      } finally {
        setMyEntryLoading(false);
      }

      void loadMyWinner(id);
    }
  };

  const claimPrize = async () => {
    if (!detail?.id) return;
    if (!user?.steamId) {
      toast.error('Sign in with Steam first');
      return;
    }
    setClaimingPrize(true);
    try {
      const res = await fetch(`/api/giveaways/${encodeURIComponent(detail.id)}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success('Prize claimed');
      await loadMyWinner(detail.id);
      await loadGiveaways();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to claim');
      await loadMyWinner(detail.id);
    } finally {
      setClaimingPrize(false);
    }
  };

  const doDailyClaim = async () => {
    if (!user?.steamId) {
      toast.error('Sign in first');
      return;
    }
    setClaiming(true);
    try {
      const res = await fetch('/api/credits/daily-claim', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setCreditsBalance(Number(json?.balance || 0));
      if (json?.nextEligibleAt && json?.serverNow) {
        const st: DailyClaimStatus = {
          canClaim: false,
          nextEligibleAt: String(json?.nextEligibleAt || ''),
          serverNow: String(json?.serverNow || ''),
        };
        setClaimStatus(st);
        const offset = Date.parse(st.serverNow) - Date.now();
        setServerOffsetMs(Number.isFinite(offset) ? offset : 0);
      } else {
        loadDailyClaimStatus();
      }
      toast.success(`Claimed ${json?.claimed || 0} credits!`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to claim');
      loadDailyClaimStatus();
    } finally {
      setClaiming(false);
    }
  };

  const claimRemainingSeconds = useMemo(() => {
    if (!claimStatus || claimStatus.canClaim) return 0;
    const nextMs = Date.parse(claimStatus.nextEligibleAt);
    if (!Number.isFinite(nextMs)) return 0;
    const nowMsLocal = Date.now() + serverOffsetMs;
    const remainingMs = nextMs - nowMsLocal;
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }, [claimStatus, serverOffsetMs, nowTick]);

  const canClaim = !!user?.steamId && !!claimStatus?.canClaim;

  const enterGiveaway = async () => {
    if (!detail?.id) return;
    if (!user?.steamId) {
      toast.error('Sign in with Steam to enter');
      return;
    }
    const entries = Math.max(1, Math.floor(Number(entriesToBuy || 1)));
    setEntering(true);
    try {
      const res = await fetch(`/api/giveaways/${encodeURIComponent(detail.id)}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');

      setCreditsBalance(Number(json?.balance || creditsBalance || 0));
      setMyEntries(Number(json?.entry?.entries || 0));
      toast.success('Entered giveaway!');
      loadGiveaways();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to enter');
    } finally {
      setEntering(false);
    }
  };

  const selectedCost = useMemo(() => {
    if (!detail) return 0;
    const entries = Math.max(1, Math.floor(Number(entriesToBuy || 1)));
    return entries * Math.max(1, Math.floor(Number(detail.creditsPerEntry || 10)));
  }, [detail, entriesToBuy]);

  const detailItemKey = String(detail?.prizeItem?.market_hash_name || detail?.prizeItem?.id || '').trim();
  const detailItemInfo = detailItemKey ? itemInfoByKey[detailItemKey] : null;
  const detailRarityColor = detailItemInfo?.rarityColor || rarityColorFallback(detailItemInfo?.rarityName);
  const detailPrizeImage = (detail?.prizeItem?.image ? String(detail.prizeItem.image) : null) || detailItemInfo?.image || null;

  const winnerCanClaim = useMemo(() => {
    if (!myWinner?.isWinner) return false;
    if (String(myWinner.claimStatus || '') !== 'pending') return false;
    const deadlineMs = myWinner.claimDeadlineAt ? new Date(myWinner.claimDeadlineAt).getTime() : NaN;
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) return false;
    return true;
  }, [myWinner]);

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 pb-24">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Giveaways</p>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Win Skins</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2 max-w-xl">
                  Enter giveaways using credits. Claim free credits daily. Pro users get more.
                </p>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-[1.5rem] px-5 py-4 flex items-center gap-4">
                <Wallet className="text-blue-400" size={18} />
                <div>
                  <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Credits</div>
                  <div className="text-xl font-black italic tracking-tighter">
                    {creditsLoading ? <Loader2 className="animate-spin" size={18} /> : (creditsBalance ?? '—')}
                  </div>
                </div>
                <button
                  onClick={doDailyClaim}
                  disabled={claiming || claimStatusLoading || !user?.steamId || !canClaim}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${claiming || claimStatusLoading || !user?.steamId || !canClaim ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                >
                  {claiming
                    ? 'Claiming...'
                    : claimStatusLoading
                      ? 'Loading...'
                      : !user?.steamId
                        ? 'Daily Claim'
                        : canClaim
                          ? 'Daily Claim'
                          : `Next in ${formatHms(claimRemainingSeconds)}`}
                </button>
              </div>
            </div>

            {!user?.steamId && (
              <div className="mt-6 bg-blue-600/10 border border-blue-500/30 rounded-[1.5rem] px-5 py-4 text-[11px] text-gray-300">
                Sign in with Steam to enter giveaways and claim credits.
                <Link href="/inventory" className="ml-2 text-blue-400 hover:text-blue-300 font-black uppercase tracking-widest text-[10px]">Go to Vault</Link>
              </div>
            )}
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-gray-500">
              <Loader2 className="animate-spin" size={22} />
              <span className="ml-2 text-[11px] uppercase tracking-widest font-black">Loading</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.2fr] gap-6">
              <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Active</div>
                  <Sparkles className="text-yellow-400" size={18} />
                </div>

                {active.length === 0 ? (
                  <div className="text-gray-500 text-[11px]">No active giveaways right now.</div>
                ) : (
                  <div className="space-y-3">
                    {active.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => loadDetail(g.id)}
                        className={`w-full text-left p-4 rounded-[1.5rem] border transition-all ${selectedId === g.id ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 bg-black/40 hover:border-white/10'}`}
                      >
                        {(() => {
                          const st = getGiveawayStatus(Date.now(), g);

                          const key = String(g?.prizeItem?.market_hash_name || g?.prizeItem?.id || '').trim();
                          const info = key ? itemInfoByKey[key] : null;
                          const rarityColor = (info?.rarityColor || rarityColorFallback(info?.rarityName)) as string;
                          const img = (g?.prizeItem?.image ? String(g.prizeItem.image) : null) || info?.image || null;

                          return (
                            <>
                              <div className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest mb-3 ${st.className}`}>
                                {st.label}
                              </div>

                              <div className="flex items-start gap-4">
                                <div
                                  className="w-12 h-12 rounded-[1.25rem] bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
                                  style={{ boxShadow: `0 0 0 1px ${hexToRgba(rarityColor, 0.25)} inset` }}
                                >
                                  {img ? (
                                    <img src={img} alt={g.prize || 'Prize'} className="w-full h-full object-contain" />
                                  ) : (
                                    <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">—</div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-black uppercase tracking-widest truncate">{g.title}</div>
                                  <div className="text-[10px] mt-1 truncate" style={{ color: hexToRgba(rarityColor, 0.95) }}>
                                    {g.prize || info?.name || 'Prize TBA'}
                                  </div>
                                  <div className="mt-3 grid grid-cols-3 gap-2 text-[9px] text-gray-500">
                                    <div>
                                      <div className="uppercase tracking-widest">Entry</div>
                                      <div className="text-[10px] font-black text-white">{g.creditsPerEntry}</div>
                                    </div>
                                    <div>
                                      <div className="uppercase tracking-widest">Players</div>
                                      <div className="text-[10px] font-black text-white">{g.totalParticipants}</div>
                                    </div>
                                    <div>
                                      <div className="uppercase tracking-widest">Winners</div>
                                      <div className="text-[10px] font-black text-white">{g.winnerCount}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-white/5">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Upcoming</div>
                  {upcoming.length === 0 ? (
                    <div className="text-gray-500 text-[11px]">No upcoming giveaways.</div>
                  ) : (
                    <div className="space-y-2">
                      {upcoming.slice(0, 12).map((g) => (
                        <button
                          key={g.id}
                          onClick={() => loadDetail(g.id)}
                          className={`w-full text-left p-3 rounded-[1.5rem] border transition-all ${selectedId === g.id ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 bg-black/20 hover:border-white/10'}`}
                        >
                          {(() => {
                            const key = String(g?.prizeItem?.market_hash_name || g?.prizeItem?.id || '').trim();
                            const info = key ? itemInfoByKey[key] : null;
                            const rarityColor = (info?.rarityColor || rarityColorFallback(info?.rarityName)) as string;
                            const img = (g?.prizeItem?.image ? String(g.prizeItem.image) : null) || info?.image || null;
                            return (
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-9 h-9 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
                                  style={{ boxShadow: `0 0 0 1px ${hexToRgba(rarityColor, 0.25)} inset` }}
                                >
                                  {img ? (
                                    <img src={img} alt={g.prize || 'Prize'} className="w-full h-full object-contain" />
                                  ) : (
                                    <div className="text-[8px] text-gray-600 font-black uppercase">—</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest truncate">{g.title}</div>
                                    <div className="text-[9px] text-gray-600">Starts {formatShortDate(g.startAt)}</div>
                                  </div>
                                  <div className="mt-1 text-[9px] truncate" style={{ color: hexToRgba(rarityColor, 0.9) }}>
                                    {g.prize || info?.name || 'Prize TBA'}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Past</div>
                  {past.length === 0 ? (
                    <div className="text-gray-500 text-[11px]">No past giveaways yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {past.slice(0, 12).map((g) => (
                        <button
                          key={g.id}
                          onClick={() => loadDetail(g.id)}
                          className={`w-full text-left p-3 rounded-[1.5rem] border transition-all ${selectedId === g.id ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 bg-black/20 hover:border-white/10'}`}
                        >
                          {(() => {
                            const key = String(g?.prizeItem?.market_hash_name || g?.prizeItem?.id || '').trim();
                            const info = key ? itemInfoByKey[key] : null;
                            const rarityColor = (info?.rarityColor || rarityColorFallback(info?.rarityName)) as string;
                            const img = (g?.prizeItem?.image ? String(g.prizeItem.image) : null) || info?.image || null;
                            return (
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-9 h-9 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
                                  style={{ boxShadow: `0 0 0 1px ${hexToRgba(rarityColor, 0.25)} inset` }}
                                >
                                  {img ? (
                                    <img src={img} alt={g.prize || 'Prize'} className="w-full h-full object-contain" />
                                  ) : (
                                    <div className="text-[8px] text-gray-600 font-black uppercase">—</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest truncate">{g.title}</div>
                                    <div className="text-[9px] text-gray-600">{g.drawnAt ? 'Drawn' : 'Ended'}</div>
                                  </div>
                                  <div className="mt-1 text-[9px] truncate" style={{ color: hexToRgba(rarityColor, 0.9) }}>
                                    {g.prize || info?.name || 'Prize TBA'}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
                {!selectedId ? (
                  <div className="text-gray-500 text-[11px]">Select a giveaway to see details.</div>
                ) : detailLoading ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="animate-spin" size={18} />
                    <span className="text-[11px] uppercase tracking-widest font-black">Loading details</span>
                  </div>
                ) : detail ? (
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Giveaway</div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter">{detail.title}</h2>
                        {(() => {
                          const st = getGiveawayStatus(Date.now(), detail);
                          return (
                            <div className={`inline-flex items-center px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest mt-3 ${st.className}`}>
                              {st.label}
                            </div>
                          );
                        })()}
                        <p className="text-[11px] text-gray-400 mt-2 whitespace-pre-wrap">{detail.description || 'No description provided.'}</p>
                      </div>
                      <Ticket className="text-yellow-400" size={22} />
                    </div>

                    <div
                      className="rounded-[2rem] border overflow-hidden"
                      style={{ borderColor: hexToRgba(detailRarityColor, 0.35), backgroundColor: 'rgba(0,0,0,0.2)' }}
                    >
                      <div
                        className="p-5 md:p-6"
                        style={{ background: `linear-gradient(135deg, ${hexToRgba(detailRarityColor, 0.20)} 0%, rgba(0,0,0,0.25) 65%)` }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-[1.5rem] bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                            {detailPrizeImage ? (
                              <img src={detailPrizeImage} alt={detail.prize || 'Prize'} className="w-full h-full object-contain" />
                            ) : (
                              <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">No image</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Prize</div>
                            <div className="text-lg md:text-xl font-black italic tracking-tighter break-words" style={{ color: detailRarityColor }}>
                              {detail.prize || detailItemInfo?.name || 'Prize TBA'}
                            </div>
                            {detailItemInfo?.rarityName && (
                              <div className="mt-1 text-[9px] font-black uppercase tracking-widest" style={{ color: hexToRgba(detailRarityColor, 0.95) }}>
                                {detailItemInfo.rarityName}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                          <div className="bg-black/30 border border-white/5 rounded-[1.5rem] p-3">
                            <div className="text-gray-500 uppercase tracking-widest font-black">Entry</div>
                            <div className="text-[12px] font-black mt-1">{detail.creditsPerEntry} credits</div>
                          </div>
                          <div className="bg-black/30 border border-white/5 rounded-[1.5rem] p-3">
                            <div className="text-gray-500 uppercase tracking-widest font-black">Winners</div>
                            <div className="text-[12px] font-black mt-1">{detail.winnerCount}</div>
                          </div>
                          <div className="bg-black/30 border border-white/5 rounded-[1.5rem] p-3">
                            <div className="text-gray-500 uppercase tracking-widest font-black">Ends</div>
                            <div className="text-[12px] font-black mt-1">{formatShortDate(detail.endAt)}</div>
                            <div className="text-[9px] text-gray-500">{formatShortTime(detail.endAt)}</div>
                          </div>
                          <div className="bg-black/30 border border-white/5 rounded-[1.5rem] p-3">
                            <div className="text-gray-500 uppercase tracking-widest font-black">Players</div>
                            <div className="text-[12px] font-black mt-1">{detail.totalParticipants}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {user?.steamId && detail.drawnAt && (
                      <div className="bg-black/40 border border-white/5 rounded-[2rem] p-5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Winner Status</div>
                            {myWinnerLoading ? (
                              <div className="mt-2 flex items-center gap-2 text-gray-500 text-[11px]">
                                <Loader2 className="animate-spin" size={16} /> Loading
                              </div>
                            ) : myWinner?.isWinner ? (
                              <div className="mt-2 text-[11px] text-gray-300">
                                Status: <span className="text-white font-black">{String(myWinner.claimStatus || 'pending').toUpperCase()}</span>
                                {myWinner.claimDeadlineAt ? (
                                  <span className="text-gray-500"> • Deadline: {formatShortDate(myWinner.claimDeadlineAt)} {formatShortTime(myWinner.claimDeadlineAt)}</span>
                                ) : null}
                              </div>
                            ) : (
                              <div className="mt-2 text-[11px] text-gray-500">You did not win this giveaway.</div>
                            )}
                          </div>

                          {winnerCanClaim ? (
                            <button
                              onClick={claimPrize}
                              disabled={claimingPrize}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${claimingPrize ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                            >
                              {claimingPrize ? 'Claiming...' : 'Claim Prize'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}

                    <div className="bg-black/40 border border-white/5 rounded-[2rem] p-5">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Your Entries</div>
                        {myEntryLoading ? <Loader2 className="animate-spin" size={16} /> : <div className="text-[11px] font-black">{user?.steamId ? myEntries : '—'}</div>}
                      </div>

                      <div className="mt-4 flex items-center gap-3 flex-wrap">
                        <input
                          value={String(entriesToBuy)}
                          onChange={(e) => setEntriesToBuy(Math.max(1, Math.floor(Number(e.target.value || '1'))))}
                          className="w-24 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                          type="number"
                          min={1}
                        />
                        <button
                          onClick={enterGiveaway}
                          disabled={entering || !detail.isActive}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${entering || !detail.isActive ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                          {entering ? 'Entering...' : (detail.isActive ? `Enter (${selectedCost} credits)` : 'Closed')}
                        </button>
                        {typeof creditsBalance === 'number' && (
                          <div className="text-[10px] text-gray-500">
                            Balance: <span className="text-white font-black">{creditsBalance}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-[11px]">Giveaway not found.</div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
