"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Link from 'next/link';
import Image from 'next/image';
import { HelpCircle, Loader2, Sparkles, Ticket, Wallet, X } from 'lucide-react';
import { useToast } from '@/app/components/Toast';
import SpinWheel from '@/app/components/SpinWheel';

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
  claimMode?: 'bot' | 'manual';
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
  id: string | null;
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

type SpinHistoryItem = {
  reward: number;
  createdAt: string | null;
  day: string;
  role: string;
};

type SpinHistorySummary = {
  totalSpins: number;
  totalCredits: number;
  bestReward: number;
};

const SPIN_TIERS = [
  { reward: 10, label: 'Consumer Grade', color: '#b0c3d9', odds: '19.5%' },
  { reward: 25, label: 'Industrial Grade', color: '#5e98d9', odds: '17.5%' },
  { reward: 50, label: 'Mil-Spec', color: '#4b69ff', odds: '22%' },
  { reward: 100, label: 'Restricted', color: '#8847ff', odds: '18%' },
  { reward: 500, label: 'Classified', color: '#d32ce6', odds: '12%' },
  { reward: 1000, label: 'Covert', color: '#eb4b4b', odds: '6.5%' },
  { reward: 2000, label: 'Extraordinary', color: '#eb4b4b', odds: '2.5%' },
  { reward: 5000, label: 'Extraordinary', color: '#eb4b4b', odds: '1%' },
  { reward: 10000, label: 'Contraband', color: '#ffd700', odds: '0.5%' },
  { reward: 30000, label: 'Contraband', color: '#ffd700', odds: '0.25%' },
  { reward: 50000, label: 'Contraband', color: '#ffd700', odds: '0.12%' },
  { reward: 75000, label: 'Contraband', color: '#ffd700', odds: '0.08%' },
  { reward: 150000, label: 'Contraband', color: '#ffd700', odds: '0.05%' },
];

type MyClaimRow = {
  giveawayId: string;
  title: string;
  prize: string;
  claimMode?: 'bot' | 'manual';
  prizeItem?: PrizeItem;
  entries: number;
  claimStatus: string;
  claimDeadlineAt: string | null;
};

function formatWinnerClaimStatus(raw: string | null | undefined): string {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'PENDING';
  if (s === 'pending_trade') return 'QUEUED';
  if (s === 'manual_pending') return 'PENDING';
  if (s === 'manual_contacted') return 'CONTACTED';
  if (s === 'manual_awaiting_user') return 'AWAITING USER';
  if (s === 'manual_sent') return 'SENT';
  return s.toUpperCase();
}

function isManualQueueStatus(raw: string | null | undefined): boolean {
  const s = String(raw || '').trim().toLowerCase();
  return s === 'manual_pending' || s === 'manual_contacted' || s === 'manual_awaiting_user' || s === 'manual_sent';
}

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
  const detailSectionRef = useRef<HTMLElement | null>(null);
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

  const [spinStatusLoading, setSpinStatusLoading] = useState(false);
  const [spinStatus, setSpinStatus] = useState<{
    canSpin: boolean;
    nextEligibleAt: string;
    role?: string;
    dailyLimit?: number | null;
    usedSpins?: number;
    remainingSpins?: number | null;
  } | null>(null);

  const [spinModalOpen, setSpinModalOpen] = useState(false);
  const [spinWheelOpen, setSpinWheelOpen] = useState(false);
  const [spinOpening, setSpinOpening] = useState(false);
  const [spinWheelReward, setSpinWheelReward] = useState<number | null>(null);
  const [spinResultOpen, setSpinResultOpen] = useState(false);
  const [spinResultReward, setSpinResultReward] = useState<number | null>(null);
  const [lastSpinReward, setLastSpinReward] = useState<number | null>(null);

  const [turboEnabled, setTurboEnabled] = useState(false);
  const [autoSpinEnabled, setAutoSpinEnabled] = useState(false);

  const [spinHistoryLoading, setSpinHistoryLoading] = useState(false);
  const [spinHistorySummary, setSpinHistorySummary] = useState<SpinHistorySummary | null>(null);
  const [spinHistoryAllTimeSummary, setSpinHistoryAllTimeSummary] = useState<SpinHistorySummary | null>(null);
  const [spinHistory, setSpinHistory] = useState<SpinHistoryItem[]>([]);

  const spinHistoryRequestSeqRef = useRef(0);

  const autoSpinTimerRef = useRef<number | null>(null);

  const canSpin = !!user?.steamId && !!spinStatus?.canSpin;

  const spinModalOpenRef = useRef(spinModalOpen);
  const spinWheelOpenRef = useRef(spinWheelOpen);
  const spinResultOpenRef = useRef(spinResultOpen);
  const spinOpeningRef = useRef(spinOpening);
  const canSpinRef = useRef(canSpin);
  const autoSpinEnabledRef = useRef(autoSpinEnabled);
  const turboEnabledRef = useRef(turboEnabled);
  const startSpinRef = useRef<null | (() => Promise<void>)>(null);
  const closeAllSpinModalsRef = useRef<null | (() => void)>(null);

  const [entriesToBuy, setEntriesToBuy] = useState<number>(1);
  const [entering, setEntering] = useState(false);
  const [myEntries, setMyEntries] = useState<number>(0);
  const [myEntryLoading, setMyEntryLoading] = useState(false);

  const [itemInfoByKey, setItemInfoByKey] = useState<Record<string, ItemInfo | null>>({});
  const [myWinner, setMyWinner] = useState<MyWinnerStatus | null>(null);
  const [myWinnerLoading, setMyWinnerLoading] = useState(false);
  const [claimingPrize, setClaimingPrize] = useState(false);

  const [myClaims, setMyClaims] = useState<MyClaimRow[]>([]);
  const [myClaimsLoading, setMyClaimsLoading] = useState(false);

  const [tradeUrlModalOpen, setTradeUrlModalOpen] = useState(false);
  const [tradeUrlModalClaimId, setTradeUrlModalClaimId] = useState<string | null>(null);
  const [tradeUrlInput, setTradeUrlInput] = useState('');
  const [tradeUrlLoading, setTradeUrlLoading] = useState(false);
  const [tradeUrlSaving, setTradeUrlSaving] = useState(false);

  const [manualClaimModalOpen, setManualClaimModalOpen] = useState(false);
  const [manualClaimGiveawayId, setManualClaimGiveawayId] = useState<string | null>(null);
  const [manualDiscordUsername, setManualDiscordUsername] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualClaimSending, setManualClaimSending] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const openTradeUrlModal = (giveawayId: string | null) => {
    setTradeUrlModalClaimId(giveawayId);
    setTradeUrlModalOpen(true);
    setTradeUrlInput('');
    if (!user?.steamId) return;

    setTradeUrlLoading(true);
    fetch('/api/user/trade-url', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const t = String(j?.tradeUrl || '').trim();
        setTradeUrlInput(t);
      })
      .catch(() => {
        setTradeUrlInput('');
      })
      .finally(() => {
        setTradeUrlLoading(false);
      });
  };

  const openManualClaimModal = (giveawayId: string | null) => {
    setManualClaimGiveawayId(giveawayId);
    setManualDiscordUsername('');
    setManualEmail('');
    setManualClaimModalOpen(true);
  };

  const submitManualClaim = async () => {
    const id = String(manualClaimGiveawayId || '').trim();
    if (!id) return;
    if (!user?.steamId) {
      toast.error('Sign in with Steam first');
      return;
    }
    if (!String(manualDiscordUsername || '').trim()) {
      toast.error('Discord username is required');
      return;
    }

    setManualClaimSending(true);
    try {
      const res = await fetch(`/api/giveaways/${encodeURIComponent(id)}/manual-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamId: String(user?.steamId || ''),
          discordUsername: String(manualDiscordUsername || '').trim(),
          email: String(manualEmail || '').trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success('Claim submitted');
      setManualClaimModalOpen(false);
      const gid = manualClaimGiveawayId;
      setManualClaimGiveawayId(null);
      if (gid) {
        await loadMyWinner(gid);
      }
      await loadGiveaways();
      await loadMyClaims();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit claim');
      const gid = manualClaimGiveawayId;
      if (gid) {
        await loadMyWinner(gid);
      }
    } finally {
      setManualClaimSending(false);
    }
  };

  const scrollToDetail = () => {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      const el = detailSectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inView = rect.top >= 0 && rect.top <= window.innerHeight * 0.25;
      const shouldScroll = window.innerWidth < 1024 || !inView;
      if (!shouldScroll) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const saveTradeUrlFromModal = async () => {
    if (!user?.steamId) {
      toast.error('Sign in with Steam first');
      return;
    }

    setTradeUrlSaving(true);
    try {
      const res = await fetch('/api/user/trade-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeUrl: tradeUrlInput }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success('Trade URL saved');
      setTradeUrlModalOpen(false);
      const gid = tradeUrlModalClaimId;
      setTradeUrlModalClaimId(null);
      if (gid) {
        await claimPrizeById(gid);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save trade URL');
    } finally {
      setTradeUrlSaving(false);
    }
  };

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

  const loadMyClaims = async () => {
    if (!user?.steamId) {
      setMyClaims([]);
      return;
    }
    setMyClaimsLoading(true);
    try {
      const res = await fetch('/api/giveaways/my-claims', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setMyClaims(Array.isArray(json?.claims) ? (json.claims as MyClaimRow[]) : []);
    } catch {
      setMyClaims([]);
    } finally {
      setMyClaimsLoading(false);
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
        id: json?.id ? String(json.id) : null,
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

  const loadDailySpinStatus = useCallback(async () => {
    if (!user?.steamId) {
      setSpinStatus(null);
      return;
    }
    setSpinStatusLoading(true);
    try {
      const res = await fetch('/api/spins', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setSpinStatus({
        canSpin: !!json.canSpin,
        nextEligibleAt: String(json.nextEligibleAt || ''),
        role: json.role,
        dailyLimit: typeof json.dailyLimit === 'number' ? json.dailyLimit : (json.dailyLimit === null ? null : undefined),
        usedSpins: typeof json.usedSpins === 'number' ? json.usedSpins : undefined,
        remainingSpins: typeof json.remainingSpins === 'number' ? json.remainingSpins : (json.remainingSpins === null ? null : undefined),
      });
    } catch {
      setSpinStatus(null);
    } finally {
      setSpinStatusLoading(false);
    }
  }, [user?.steamId]);

  const loadSpinHistory = useCallback(async () => {
    const seq = ++spinHistoryRequestSeqRef.current;
    if (!user?.steamId) {
      setSpinHistory([]);
      setSpinHistorySummary(null);
      setSpinHistoryAllTimeSummary(null);
      return;
    }

    setSpinHistoryLoading(true);
    try {
      const res = await fetch('/api/spins/history?days=30&limit=15', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed'));
      if (seq !== spinHistoryRequestSeqRef.current) return;
      setSpinHistory(Array.isArray(json?.items) ? (json.items as SpinHistoryItem[]) : []);
      setSpinHistorySummary(json?.summary ? (json.summary as SpinHistorySummary) : null);
      setSpinHistoryAllTimeSummary(json?.allTimeSummary ? (json.allTimeSummary as SpinHistorySummary) : null);
    } catch {
      if (seq !== spinHistoryRequestSeqRef.current) return;
      setSpinHistory([]);
      setSpinHistorySummary(null);
      setSpinHistoryAllTimeSummary(null);
    } finally {
      if (seq !== spinHistoryRequestSeqRef.current) return;
      setSpinHistoryLoading(false);
    }
  }, [user?.steamId]);

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

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setMyEntries(0);
    setMyWinner(null);
    setTradeUrlModalClaimId(null);
    let didLoad = false;

    setDetailLoading(true);
    try {
      const res = await fetch(`/api/giveaways/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setDetail((json?.giveaway as GiveawayDetail) || null);
      didLoad = true;

      const key = String(json?.giveaway?.prizeItem?.market_hash_name || json?.giveaway?.prizeItem?.id || '').trim();
      if (key) void ensureItemInfo(key);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load giveaway');
    } finally {
      setDetailLoading(false);
      if (didLoad) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToDetail();
          });
        });
      }
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
    void loadMyClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.steamId]);

  useEffect(() => {
    loadDailyClaimStatus();
    loadDailySpinStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.steamId]);

  const openSpinModal = () => {
    if (!user?.steamId) {
      toast.error('Sign in with Steam first');
      return;
    }
    void loadSpinHistory();
    setLastSpinReward(null);
    setSpinResultOpen(false);
    setSpinResultReward(null);
    setSpinWheelOpen(false);
    setSpinWheelReward(null);
    setSpinModalOpen(true);
  };

  const handleSpinComplete = async (reward: number) => {
    setSpinWheelOpen(false);
    setSpinWheelReward(null);
    if (reward > 0) setLastSpinReward(reward);
    if (reward > 0) {
      setSpinResultReward(reward);
      setSpinResultOpen(true);
    }
    void loadCredits();
    void loadDailySpinStatus();
    void loadSpinHistory();
  };

  const startSpin = useCallback(async () => {
    if (!user?.steamId) {
      toast.error('Sign in with Steam first');
      return;
    }
    if (!canSpin || spinWheelOpen || spinOpening) return;

    setSpinOpening(true);
    try {
      const res = await fetch('/api/spins', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed to spin'));
      const reward = Number(json?.reward);
      if (!Number.isFinite(reward)) throw new Error('Invalid reward');

      // Invalidate any in-flight history fetch (important for Auto/Turbo back-to-back spins)
      spinHistoryRequestSeqRef.current += 1;

      setSpinWheelReward(reward);
      setSpinWheelOpen(true);
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed to spin'));
      void loadDailySpinStatus();
    } finally {
      setSpinOpening(false);
    }
  }, [user?.steamId, canSpin, spinWheelOpen, spinOpening, toast, loadDailySpinStatus, spinStatus?.role]);

  const closeAllSpinModals = useCallback(() => {
    if (autoSpinTimerRef.current) {
      window.clearTimeout(autoSpinTimerRef.current);
      autoSpinTimerRef.current = null;
    }
    setSpinWheelOpen(false);
    setSpinWheelReward(null);
    setSpinResultOpen(false);
    setSpinResultReward(null);
    setSpinModalOpen(false);
  }, []);

  useEffect(() => {
    spinModalOpenRef.current = spinModalOpen;
  }, [spinModalOpen]);

  useEffect(() => {
    spinWheelOpenRef.current = spinWheelOpen;
  }, [spinWheelOpen]);

  useEffect(() => {
    spinResultOpenRef.current = spinResultOpen;
  }, [spinResultOpen]);

  useEffect(() => {
    spinOpeningRef.current = spinOpening;
  }, [spinOpening]);

  useEffect(() => {
    canSpinRef.current = canSpin;
  }, [canSpin]);

  useEffect(() => {
    autoSpinEnabledRef.current = autoSpinEnabled;
  }, [autoSpinEnabled]);

  useEffect(() => {
    turboEnabledRef.current = turboEnabled;
  }, [turboEnabled]);

  useEffect(() => {
    startSpinRef.current = startSpin;
  }, [startSpin]);

  useEffect(() => {
    closeAllSpinModalsRef.current = closeAllSpinModals;
  }, [closeAllSpinModals]);

  useEffect(() => {
    if (autoSpinTimerRef.current) {
      window.clearTimeout(autoSpinTimerRef.current);
      autoSpinTimerRef.current = null;
    }

    if (!autoSpinEnabled) return;
    if (!spinModalOpenRef.current && !spinResultOpenRef.current) return;
    if (!canSpinRef.current || spinWheelOpenRef.current || spinOpeningRef.current) return;

    autoSpinTimerRef.current = window.setTimeout(() => {
      autoSpinTimerRef.current = null;
      if (!autoSpinEnabledRef.current) return;
      if (!spinModalOpenRef.current && !spinResultOpenRef.current) return;
      if (!canSpinRef.current || spinWheelOpenRef.current || spinOpeningRef.current) return;
      if (spinResultOpenRef.current) setSpinResultOpen(false);
      void startSpinRef.current?.();
    }, turboEnabledRef.current ? 350 : 900);
  }, [autoSpinEnabled, turboEnabled, spinModalOpen, spinResultOpen, canSpin, spinWheelOpen, spinOpening]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSpace = e.code === 'Space' || e.key === ' ';
      const isEsc = e.code === 'Escape' || e.key === 'Escape';
      const key = String(e.key || '').toLowerCase();
      const isToggleAuto = key === 'a';
      const isToggleTurbo = key === 't';
      if (!isSpace && !isEsc && !isToggleAuto && !isToggleTurbo) return;

      const target = e.target as HTMLElement | null;
      const tag = String(target?.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable;
      if (isTyping) return;

      const anySpinOverlayOpen =
        !!spinModalOpenRef.current || !!spinWheelOpenRef.current || !!spinResultOpenRef.current;

      if (anySpinOverlayOpen && (isToggleAuto || isToggleTurbo)) {
        e.preventDefault();
        if (isToggleAuto) setAutoSpinEnabled((v) => !v);
        if (isToggleTurbo) setTurboEnabled((v) => !v);
        return;
      }

      if (isEsc && anySpinOverlayOpen) {
        e.preventDefault();
        closeAllSpinModalsRef.current?.();
        return;
      }

      if (!isSpace) return;
      if (!anySpinOverlayOpen) return;

      e.preventDefault();
      if (spinResultOpenRef.current) {
        if (!canSpinRef.current || spinWheelOpenRef.current || spinOpeningRef.current) return;
        setSpinResultOpen(false);
        void startSpinRef.current?.();
        return;
      }

      if (!spinModalOpenRef.current) return;
      if (!canSpinRef.current || spinWheelOpenRef.current || spinOpeningRef.current) return;
      void startSpinRef.current?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const anySpinOverlayOpen = spinModalOpen || spinWheelOpen || spinResultOpen;
    if (!anySpinOverlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [spinModalOpen, spinWheelOpen, spinResultOpen]);

  useEffect(() => {
    if (!user?.steamId) return;
    const can = !!claimStatus?.canClaim;
    const next = String(claimStatus?.nextEligibleAt || '');
    if (can || !next) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [user?.steamId, claimStatus?.canClaim, claimStatus?.nextEligibleAt]);

  const claimPrize = async () => {
    if (!detail?.id) return;
    if (String((detail as any)?.claimMode || 'bot') === 'manual') {
      openManualClaimModal(detail.id);
      return;
    }
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
      toast.success('Claim queued');
      await loadMyWinner(detail.id);
      await loadGiveaways();
      await loadMyClaims();
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to claim');
      if (msg.toLowerCase().includes('invalid trade url')) {
        openTradeUrlModal(detail.id);
        toast.error('Set your Steam trade URL to claim prizes');
      } else {
        toast.error(msg);
      }
      await loadMyWinner(detail.id);
    } finally {
      setClaimingPrize(false);
    }
  };

  const claimPrizeById = async (giveawayId: string) => {
    const id = String(giveawayId || '').trim();
    if (!id) return;
    const mode = myClaims.find((c) => String(c.giveawayId || '') === id)?.claimMode;
    if (String(mode || 'bot') === 'manual') {
      openManualClaimModal(id);
      return;
    }
    if (!user?.steamId) {
      toast.error('Sign in with Steam first');
      return;
    }
    setClaimingPrize(true);
    try {
      const res = await fetch(`/api/giveaways/${encodeURIComponent(id)}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success('Claim queued');
      await loadMyClaims();
      if (detail?.id && String(detail.id) === id) {
        await loadMyWinner(id);
      }
      await loadGiveaways();
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to claim');
      if (msg.toLowerCase().includes('invalid trade url')) {
        openTradeUrlModal(id);
        toast.error('Set your Steam trade URL to claim prizes');
      } else {
        toast.error(msg);
      }
      await loadMyClaims();
      if (detail?.id && String(detail.id) === id) {
        await loadMyWinner(id);
      }
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
    const nowMsLocal = Number(nowTick || 0) + serverOffsetMs;
    const remainingMs = nextMs - nowMsLocal;
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }, [claimStatus, serverOffsetMs, nowTick]);

  const canClaim = !!user?.steamId && !!claimStatus?.canClaim;

  const spinRemainingSeconds = useMemo(() => {
    if (!spinStatus || spinStatus.canSpin) return 0;
    const nextMs = Date.parse(spinStatus.nextEligibleAt);
    if (!Number.isFinite(nextMs)) return 0;
    const nowMsLocal = Number(nowTick || 0) + serverOffsetMs;
    const remainingMs = nextMs - nowMsLocal;
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }, [spinStatus, serverOffsetMs, nowTick]);

  const spinResultTier = useMemo(() => {
    const r = Number(spinResultReward);
    if (!Number.isFinite(r)) return SPIN_TIERS[0];
    return SPIN_TIERS.find((t) => t.reward === r) || SPIN_TIERS[0];
  }, [spinResultReward]);

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
  const detailItemHref = detailItemInfo?.id
    ? `/item/${encodeURIComponent(detailItemInfo.id)}`
    : (detailItemKey ? `/item/${encodeURIComponent(detailItemKey)}` : null);

  const winnerCanClaim = useMemo(() => {
    if (!myWinner?.isWinner) return false;
    if (String(myWinner.claimStatus || '') !== 'pending') return false;
    const deadlineMs = myWinner.claimDeadlineAt ? new Date(myWinner.claimDeadlineAt).getTime() : NaN;
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) return false;
    return true;
  }, [myWinner]);

  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar />
      <main
        className={`flex-1 p-6 md:p-10 custom-scrollbar ${spinModalOpen || spinWheelOpen || spinResultOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
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
                <button
                  type="button"
                  onClick={openSpinModal}
                  disabled={spinStatusLoading || !user?.steamId}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${spinStatusLoading || !user?.steamId ? 'bg-white/5 text-gray-500 cursor-not-allowed' : (canSpin ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-white/10 hover:bg-white/15 text-white')}`}
                >
                  {spinStatusLoading
                    ? 'Loading...'
                    : !user?.steamId
                      ? 'Daily Spin'
                      : canSpin
                        ? 'Daily Spin'
                        : `Next in ${formatHms(spinRemainingSeconds)}`}
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

          {spinModalOpen && (
            <div
              className="fixed inset-0 z-[10004] bg-[#08090d] flex items-center justify-center overscroll-contain overflow-hidden p-0 md:p-4"
              onClick={() => {
                setSpinModalOpen(false);
                setSpinWheelOpen(false);
              }}
            >
              <div
                className="w-full h-full max-w-5xl max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-4rem)] bg-[#0f111a] border border-white/10 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 border-b border-white/10 px-5 md:px-8 py-5 bg-[#0f111a]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Daily Spin</div>
                      <div className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter mt-1">Open Your Reward</div>
                      <div className="text-[11px] text-gray-400 mt-2">Once every 24h (UTC). Odds are shown below.</div>
                    </div>
                    <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all" onClick={() => { setSpinModalOpen(false); setSpinWheelOpen(false); }} aria-label="Close">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 md:px-8 py-5 bg-[#0f111a]">
                  {(spinHistorySummary || spinHistoryAllTimeSummary || spinHistoryLoading) && (
                    <div className="mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                          <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Best win (30d)</div>
                          <div className="mt-2 text-2xl font-black italic tracking-tighter text-yellow-300">
                            {Number(spinHistorySummary?.bestReward || 0).toLocaleString()}
                            <span className="text-[12px] text-gray-400 ml-1">CR</span>
                          </div>
                        </div>
                        <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                          <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Spins (30d)</div>
                          <div className="mt-2 text-2xl font-black italic tracking-tighter text-white">
                            {Number(spinHistorySummary?.totalSpins || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                          <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Credits won (30d)</div>
                          <div className="mt-2 text-2xl font-black italic tracking-tighter text-emerald-300">
                            {Number(spinHistorySummary?.totalCredits || 0).toLocaleString()}
                            <span className="text-[12px] text-gray-400 ml-1">CR</span>
                          </div>
                        </div>
                      </div>
                      {spinHistoryAllTimeSummary && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                            <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Best win (all time)</div>
                            <div className="mt-2 text-2xl font-black italic tracking-tighter text-yellow-300">
                              {Number(spinHistoryAllTimeSummary?.bestReward || 0).toLocaleString()}
                              <span className="text-[12px] text-gray-400 ml-1">CR</span>
                            </div>
                          </div>
                          <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                            <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Spins (all time)</div>
                            <div className="mt-2 text-2xl font-black italic tracking-tighter text-white">
                              {Number(spinHistoryAllTimeSummary?.totalSpins || 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                            <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Credits won (all time)</div>
                            <div className="mt-2 text-2xl font-black italic tracking-tighter text-emerald-300">
                              {Number(spinHistoryAllTimeSummary?.totalCredits || 0).toLocaleString()}
                              <span className="text-[12px] text-gray-400 ml-1">CR</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {SPIN_TIERS.map((t) => (
                      <div key={t.reward} className="rounded-2xl border border-white/10 bg-[#0b0d14] p-4 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-15" style={{ background: `radial-gradient(circle at 30% 20%, ${t.color}, transparent 55%)` }} />
                        <div className="relative">
                          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: t.color }}>{t.label}</div>
                          <div className="mt-2 text-2xl font-black italic tracking-tighter">{t.reward} <span className="text-[12px] text-gray-400">CREDITS</span></div>
                          <div className="mt-1 text-[9px] text-gray-500 font-black uppercase tracking-widest">Odds: {t.odds}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 border-t border-white/10 px-5 md:px-8 py-5 bg-[#0f111a]">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-[11px] text-gray-400">
                      {canSpin ? 'Spin available now.' : `Next spin in ${formatHms(spinRemainingSeconds)}.`}
                      {lastSpinReward !== null && lastSpinReward > 0 && (
                        <span className="ml-2 text-emerald-300 font-black uppercase tracking-widest text-[10px]">Last win: {lastSpinReward} credits</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setAutoSpinEnabled((v) => !v)}
                        className={`px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${autoSpinEnabled ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                      >
                        Auto (A)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTurboEnabled((v) => !v)}
                        className={`px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${turboEnabled ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                      >
                        Turbo (T)
                      </button>
                      <button
                        type="button"
                        onClick={startSpin}
                        disabled={!canSpin || spinWheelOpen || spinOpening}
                        className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${!canSpin || spinWheelOpen || spinOpening ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500 text-white'}`}
                      >
                        {spinOpening || spinWheelOpen ? 'Opening...' : 'Open Case'}
                      </button>
                    </div>
                  </div>
                </div>

                {spinWheelOpen && spinWheelReward !== null && (
                  <SpinWheel
                    reward={spinWheelReward}
                    onSpinComplete={handleSpinComplete}
                    durationSeconds={turboEnabled ? 1.6 : 5}
                    historyItems={spinHistory}
                    historySummary={spinHistorySummary}
                    historyAllTimeSummary={spinHistoryAllTimeSummary}
                    historyLoading={spinHistoryLoading}
                    onClose={() => {
                      setSpinWheelOpen(false);
                      setSpinWheelReward(null);
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {spinResultOpen && (
            <div
              className="fixed inset-0 z-[10004] bg-[#08090d] flex items-center justify-center overscroll-contain overflow-hidden p-0 md:p-4"
              onClick={() => setSpinResultOpen(false)}
            >
              <div
                className="w-full h-full max-w-4xl max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-4rem)] bg-[#0f111a] border border-white/10 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 border-b border-white/10 px-5 md:px-8 py-5 bg-[#0f111a]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Daily Spin</div>
                      <div className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter mt-1">You opened</div>
                    </div>
                    <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all" onClick={() => setSpinResultOpen(false)} aria-label="Close">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 md:px-8 py-5 bg-[#0f111a]">
                  <div className="rounded-[2rem] border border-white/10 bg-[#0b0d14] relative overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{ background: `radial-gradient(circle at 30% 20%, ${spinResultTier.color}, transparent 60%)` }}
                    />
                    <div className="relative p-6">
                      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: spinResultTier.color }}>
                        {spinResultTier.label}
                      </div>
                      <div className="mt-2 flex items-end gap-3 flex-wrap">
                        <div className="text-5xl md:text-6xl font-black italic tracking-tighter text-white">
                          {spinResultReward ?? 0}
                        </div>
                        <div className="pb-2 text-[12px] md:text-[13px] text-gray-300 font-black uppercase tracking-widest">
                          CREDITS
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3 flex-wrap">
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
                          <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Odds</div>
                          <div className="text-[10px] text-white font-black uppercase tracking-widest">{spinResultTier.odds}</div>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
                          <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Shortcut</div>
                          <div className="text-[10px] text-white font-black uppercase tracking-widest">Space</div>
                        </div>
                      </div>
                      <div className="mt-4 text-[11px] text-gray-400">
                        {spinStatus?.dailyLimit === null
                          ? 'Unlimited spins available.'
                          : typeof spinStatus?.remainingSpins === 'number'
                            ? `Spins left today: ${spinStatus.remainingSpins}`
                            : (!canSpin ? `Next spin in ${formatHms(spinRemainingSeconds)}.` : 'Spin available now.')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-white/10 px-5 md:px-8 py-5 bg-[#0f111a]">
                  <div className="flex items-center justify-end gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSpinResultOpen(false)}
                      className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all bg-white/5 hover:bg-white/10 text-white"
                    >
                      Go back
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setSpinResultOpen(false);
                        await startSpin();
                      }}
                      disabled={!canSpin || spinWheelOpen || spinOpening}
                      className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${!canSpin || spinWheelOpen || spinOpening ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500 text-white'}`}
                    >
                      {canSpin ? 'Open case again' : `Next in ${formatHms(spinRemainingSeconds)}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!!user?.steamId && (
            <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Claimable prizes</div>
                <Ticket className="text-emerald-400" size={18} />
              </div>

              {myClaimsLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-[11px] uppercase tracking-widest font-black">Loading</span>
                </div>
              ) : myClaims.length === 0 ? (
                <div className="text-gray-500 text-[11px]">No claimable prizes right now.</div>
              ) : (
                <div className="space-y-2">
                  {myClaims.slice(0, 10).map((c) => (
                    <div key={c.giveawayId} className="bg-black/40 border border-white/5 rounded-[1.5rem] p-4 flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-widest truncate">{c.title}</div>
                        <div className="text-[10px] text-gray-500 mt-1 truncate">{c.prize || 'Prize'}</div>
                        <div className="mt-2 text-[9px] text-emerald-300 font-black uppercase tracking-widest">
                          Deadline: {c.claimDeadlineAt ? new Date(c.claimDeadlineAt).toLocaleString() : '—'}
                        </div>
                        {String(c.claimStatus || '') === 'pending_trade' && (
                          <div className="mt-1 text-[9px] text-blue-300 font-black uppercase tracking-widest">
                            Claim queued
                          </div>
                        )}
                        {isManualQueueStatus(c.claimStatus) && (
                          <div className="mt-1 text-[9px] text-blue-300 font-black uppercase tracking-widest">
                            Manual claim submitted
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadDetail(c.giveawayId)}
                          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white/5 hover:bg-white/10 text-white"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => claimPrizeById(c.giveawayId)}
                          disabled={claimingPrize || String(c.claimStatus || '') !== 'pending'}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${claimingPrize || String(c.claimStatus || '') !== 'pending' ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                        >
                          {String(c.claimStatus || '') === 'pending_trade'
                            ? 'Queued'
                            : isManualQueueStatus(c.claimStatus)
                              ? 'Submitted'
                              : (String(c.claimMode || 'bot') === 'manual' ? 'Submit' : 'Claim')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24 text-gray-500">
              <Loader2 className="animate-spin" size={22} />
              <span className="ml-2 text-[11px] uppercase tracking-widest font-black">Loading</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr,1fr] gap-6">
              <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl min-h-[520px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Active</div>
                  <Sparkles className="text-yellow-400" size={18} />
                </div>

                {active.length === 0 ? (
                  <div className="text-gray-500 text-[11px]">No active giveaways right now.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                    {active.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => loadDetail(g.id)}
                        className={`w-full text-left bg-[#11141d] p-3 md:p-3.5 rounded-[1.25rem] md:rounded-[1.75rem] transition-[border-color,transform] duration-300 group relative flex flex-col border ${selectedId === g.id ? 'border-blue-500/40' : 'border-white/5 hover:border-blue-500/40'}`}
                      >
                        {(() => {
                          const st = getGiveawayStatus(Date.now(), g);

                          const key = String(g?.prizeItem?.market_hash_name || g?.prizeItem?.id || '').trim();
                          const info = key ? itemInfoByKey[key] : null;
                          const rarityColor = (info?.rarityColor || rarityColorFallback(info?.rarityName)) as string;
                          const img = (g?.prizeItem?.image ? String(g.prizeItem.image) : null) || info?.image || null;
                          const href = info?.id ? `/item/${encodeURIComponent(info.id)}` : (key ? `/item/${encodeURIComponent(key)}` : null);

                          return (
                            <>
                              <div className="absolute top-2 md:top-3 lg:top-4 left-2 md:left-3 lg:left-4 z-20">
                                <div className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${st.className}`}>
                                  {st.label}
                                </div>
                              </div>

                              {href ? (
                                <div className="absolute top-2 md:top-3 lg:top-4 right-2 md:right-3 lg:right-4 z-20">
                                  <Link
                                    href={href}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-black/60 border border-white/10 hover:bg-white/5 transition-all text-[9px] font-black uppercase tracking-widest"
                                  >
                                    View
                                  </Link>
                                </div>
                              ) : null}

                              <div className="aspect-square bg-black/20 rounded-[1.25rem] md:rounded-[1.75rem] flex items-center justify-center p-2.5 md:p-3 mb-3 relative overflow-hidden">
                                <div className="absolute inset-0 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: rarityColor }} />
                                {img ? (
                                  <Image
                                    src={img}
                                    alt={g.prize || info?.name || 'Prize'}
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                                    className="object-contain relative z-10 group-hover:scale-110 transition-transform duration-500"
                                    style={{ transform: 'translateZ(0)' }}
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 relative z-10" />
                                )}

                                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/35 to-transparent">
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-black/40 border border-white/10 rounded-xl px-2 py-1">
                                      <div className="text-[8px] font-black uppercase tracking-widest text-gray-400">Entry</div>
                                      <div className="text-[9px] font-black text-white/90 truncate">{g.creditsPerEntry}</div>
                                    </div>
                                    <div className="bg-black/40 border border-white/10 rounded-xl px-2 py-1">
                                      <div className="text-[8px] font-black uppercase tracking-widest text-gray-400">Players</div>
                                      <div className="text-[9px] font-black text-white/90 truncate">{g.totalParticipants}</div>
                                    </div>
                                    <div className="bg-black/40 border border-white/10 rounded-xl px-2 py-1">
                                      <div className="text-[8px] font-black uppercase tracking-widest text-gray-400">Winners</div>
                                      <div className="text-[9px] font-black text-white/90 truncate">{g.winnerCount}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <p className="text-[10px] font-black uppercase truncate tracking-widest text-white/90">{g.title}</p>
                              <p className="text-[9px] font-black mt-1 opacity-80 truncate" style={{ color: hexToRgba(rarityColor, 0.95) }}>
                                {g.prize || info?.name || 'Prize TBA'}
                              </p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {upcoming.slice(0, 12).map((g) => (
                        <button
                          key={g.id}
                          onClick={() => loadDetail(g.id)}
                          className={`w-full text-left bg-[#11141d] p-3 md:p-3.5 rounded-[1.25rem] md:rounded-[1.75rem] border transition-[border-color,transform] duration-300 group ${selectedId === g.id ? 'border-blue-500/40' : 'border-white/5 hover:border-blue-500/40'}`}
                        >
                          {(() => {
                            const key = String(g?.prizeItem?.market_hash_name || g?.prizeItem?.id || '').trim();
                            const info = key ? itemInfoByKey[key] : null;
                            const rarityColor = (info?.rarityColor || rarityColorFallback(info?.rarityName)) as string;
                            const img = (g?.prizeItem?.image ? String(g.prizeItem.image) : null) || info?.image || null;
                            return (
                              <>
                                <div className="aspect-square bg-black/20 rounded-[1.25rem] md:rounded-[1.75rem] flex items-center justify-center p-2.5 md:p-3 mb-3 relative overflow-hidden">
                                  <div className="absolute inset-0 blur-3xl opacity-10" style={{ backgroundColor: rarityColor }} />
                                  {img ? (
                                    <Image
                                      src={img}
                                      alt={g.prize || info?.name || 'Prize'}
                                      fill
                                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                                      className="object-contain relative z-10"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 relative z-10" />
                                  )}

                                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/35 to-transparent">
                                    <div className="bg-black/40 border border-white/10 rounded-xl px-2 py-1.5">
                                      <div className="text-[8px] font-black uppercase tracking-widest text-gray-400">Starts</div>
                                      <div className="text-[9px] font-black text-white/90 truncate">{formatShortDate(g.startAt)}</div>
                                    </div>
                                  </div>
                                </div>

                                <p className="text-[10px] font-black uppercase truncate tracking-widest text-white/90">{g.title}</p>
                                <p className="text-[9px] font-black mt-1 opacity-80 truncate" style={{ color: hexToRgba(rarityColor, 0.9) }}>
                                  {g.prize || info?.name || 'Prize TBA'}
                                </p>
                              </>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {past.slice(0, 12).map((g) => (
                        <button
                          key={g.id}
                          onClick={() => loadDetail(g.id)}
                          className={`w-full text-left bg-[#11141d] p-3 md:p-3.5 rounded-[1.25rem] md:rounded-[1.75rem] border transition-[border-color,transform] duration-300 group ${selectedId === g.id ? 'border-blue-500/40' : 'border-white/5 hover:border-blue-500/40'}`}
                        >
                          {(() => {
                            const key = String(g?.prizeItem?.market_hash_name || g?.prizeItem?.id || '').trim();
                            const info = key ? itemInfoByKey[key] : null;
                            const rarityColor = (info?.rarityColor || rarityColorFallback(info?.rarityName)) as string;
                            const img = (g?.prizeItem?.image ? String(g.prizeItem.image) : null) || info?.image || null;
                            return (
                              <>
                                <div className="aspect-square bg-black/20 rounded-[1.25rem] md:rounded-[1.75rem] flex items-center justify-center p-2.5 md:p-3 mb-3 relative overflow-hidden">
                                  <div className="absolute inset-0 blur-3xl opacity-10" style={{ backgroundColor: rarityColor }} />
                                  {img ? (
                                    <Image
                                      src={img}
                                      alt={g.prize || info?.name || 'Prize'}
                                      fill
                                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                                      className="object-contain relative z-10"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 relative z-10" />
                                  )}

                                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/35 to-transparent">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-[8px] font-black uppercase tracking-widest text-gray-400">Status</div>
                                      <div className="text-[9px] font-black text-white/90 truncate">{g.drawnAt ? 'Drawn' : 'Ended'}</div>
                                    </div>
                                  </div>
                                </div>

                                <p className="text-[10px] font-black uppercase truncate tracking-widest text-white/90">{g.title}</p>
                                <p className="text-[9px] font-black mt-1 opacity-80 truncate" style={{ color: hexToRgba(rarityColor, 0.9) }}>
                                  {g.prize || info?.name || 'Prize TBA'}
                                </p>
                              </>
                            );
                          })()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section ref={detailSectionRef} className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
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
                          <div className="w-16 h-16 rounded-[1.5rem] bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0 relative">
                            {detailPrizeImage ? (
                              <Image
                                src={detailPrizeImage}
                                alt={detail.prize || 'Prize'}
                                fill
                                sizes="64px"
                                className="object-contain"
                              />
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

                          {detailItemHref && (
                            <Link
                              href={detailItemHref}
                              className="ml-auto shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-black/40 border border-white/10 hover:bg-white/5 transition-all text-[10px] font-black uppercase tracking-widest"
                            >
                              View
                            </Link>
                          )}
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
                                Status: <span className="text-white font-black">{formatWinnerClaimStatus(myWinner.claimStatus)}</span>
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
                              {claimingPrize ? 'Submitting...' : (String((detail as any)?.claimMode || 'bot') === 'manual' ? 'Submit Claim' : 'Claim Prize')}
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

      {tradeUrlModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-[#08090d] min-h-screen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trade-url-modal-title"
          onClick={() => {
            setTradeUrlModalOpen(false);
          }}
        >
          <div
            className="bg-[#11141d] border border-white/10 p-6 md:p-8 rounded-[2rem] w-full max-w-lg shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setTradeUrlModalOpen(false);
                setTradeUrlModalClaimId(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              aria-label="Close trade URL modal"
            >
              <X size={20} />
            </button>

            <div className="flex items-center justify-between gap-3">
              <h2 id="trade-url-modal-title" className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">
                Set your Trade URL
              </h2>
              <a
                href="https://steamcommunity.com/id/xottikmw/tradeoffers/privacy"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white"
              >
                <HelpCircle size={16} />
                Help
              </a>
            </div>

            <p className="text-[11px] text-gray-400 mt-3">
              You need a valid Steam trade URL to receive giveaway prizes.
            </p>

            <div className="mt-4">
              <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Trade URL</div>
              <input
                value={tradeUrlInput}
                onChange={(e) => setTradeUrlInput(e.target.value)}
                placeholder="https://steamcommunity.com/tradeoffer/new/?partner=...&token=..."
                className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                disabled={tradeUrlLoading || tradeUrlSaving}
              />
              {tradeUrlLoading && (
                <div className="mt-2 flex items-center gap-2 text-gray-500 text-[11px]">
                  <Loader2 className="animate-spin" size={16} /> Loading
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setTradeUrlModalOpen(false);
                  setTradeUrlModalClaimId(null);
                }}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white/5 hover:bg-white/10 text-white"
                disabled={tradeUrlSaving}
              >
                Cancel
              </button>
              <button
                onClick={saveTradeUrlFromModal}
                disabled={tradeUrlSaving}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tradeUrlSaving ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
              >
                {tradeUrlSaving ? 'Saving...' : 'Save & Claim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {manualClaimModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-[#08090d] min-h-screen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-claim-modal-title"
          onClick={() => {
            setManualClaimModalOpen(false);
          }}
        >
          <div
            className="bg-[#11141d] border border-white/10 p-6 md:p-8 rounded-[2rem] w-full max-w-lg shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setManualClaimModalOpen(false);
                setManualClaimGiveawayId(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              aria-label="Close manual claim modal"
            >
              <X size={20} />
            </button>

            <h2 id="manual-claim-modal-title" className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">
              Manual Claim
            </h2>

            <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-[1.5rem] px-5 py-4 text-[11px] text-gray-300">
              Make sure your Discord profile/DMs allow messages from server members. If your privacy settings are too strict, staff may not be able to contact you.
            </div>

            <div className="mt-4">
              <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Steam ID</div>
              <input
                value={String(user?.steamId || '')}
                readOnly
                className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black text-gray-300"
              />
            </div>

            <div className="mt-4">
              <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Discord Username</div>
              <input
                value={manualDiscordUsername}
                onChange={(e) => setManualDiscordUsername(e.target.value)}
                placeholder="Your Discord username"
                className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                disabled={manualClaimSending}
              />
            </div>

            <div className="mt-4">
              <div className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Email (optional)</div>
              <input
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full mt-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-black"
                disabled={manualClaimSending}
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setManualClaimModalOpen(false);
                  setManualClaimGiveawayId(null);
                }}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white/5 hover:bg-white/10 text-white"
                disabled={manualClaimSending}
              >
                Cancel
              </button>
              <button
                onClick={submitManualClaim}
                disabled={manualClaimSending}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${manualClaimSending ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
              >
                {manualClaimSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
