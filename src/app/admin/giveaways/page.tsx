"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { Loader2, Shield, Trophy, Users, Gift, Copy } from 'lucide-react';
import { useToast } from '@/app/components/Toast';

type GiveawayAdminRow = {
  id: string;
  title: string;
  description?: string;
  prize: string;
  claimMode: 'bot' | 'manual';
  prizeItem?: { id: string; name: string; market_hash_name: string; image: string | null } | null;
  startAt: string | null;
  endAt: string | null;
  creditsPerEntry: number;
  winnerCount: number;
  totalEntries: number;
  totalParticipants: number;
  drawnAt: string | null;
  archivedAt?: string | null;
};

type PrizeItem = {
  id: string;
  name: string;
  market_hash_name: string;
  image: string | null;
};

type EntrantRow = {
  steamId: string;
  entries: number;
  creditsSpent: number;
  tradeUrl: string;
};

type PrizeStockRow = {
  id: string;
  assetId: string;
  classId: string | null;
  instanceId: string | null;
  appId: number;
  contextId: string;
  market_hash_name: string | null;
  name: string | null;
  status: string;
  reservedBySteamId: string | null;
  steamTradeOfferId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type GiveawayClaimRow = {
  id: string;
  steamId: string;
  tradeStatus: string;
  steamTradeOfferId: string | null;
  lastError: string | null;
  botLockedAt: string | null;
  botLockId: string | null;
  prizeStockId: string | null;
  itemId: string | null;
  assetId: string | null;
  classId: string | null;
  instanceId: string | null;
  assetAppIdExact: number | null;
  assetContextIdExact: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sentAt: string | null;
  completedAt: string | null;
};

type ManualClaimRow = {
  id: string;
  giveawayId: string;
  steamId: string;
  discordUsername: string;
  discordId: string | null;
  discordProfileUrl: string | null;
  email: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  webhookSentAt: string | null;
  lastWebhookError: string | null;
};

function toLocalInputValue(d: Date): string {
  const dt = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return dt.toISOString().slice(0, 16);
}

function getGiveawayStatus(nowMs: number, g: GiveawayAdminRow): { label: string; className: string } {
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
  return { label: 'ACTIVE', className: 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300' };
}

export default function AdminGiveawaysPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GiveawayAdminRow[]>([]);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [prize, setPrize] = useState('');
  const [prizeSearch, setPrizeSearch] = useState('');
  const [prizeItem, setPrizeItem] = useState<PrizeItem | null>(null);
  const [prizeItemLoading, setPrizeItemLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [creditsPerEntry, setCreditsPerEntry] = useState(10);
  const [suggestedCreditsPerEntry, setSuggestedCreditsPerEntry] = useState<number | null>(null);
  const [winnerCount, setWinnerCount] = useState(1);
  const [claimMode, setClaimMode] = useState<'bot' | 'manual'>('bot');

  const applyPreset = (preset: 'day' | 'week' | 'month' | 'year') => {
    const start = new Date();
    const end = new Date(start);
    if (preset === 'day') end.setDate(end.getDate() + 1);
    if (preset === 'week') end.setDate(end.getDate() + 7);
    if (preset === 'month') end.setMonth(end.getMonth() + 1);
    if (preset === 'year') end.setFullYear(end.getFullYear() + 1);
    setStartAt(toLocalInputValue(start));
    setEndAt(toLocalInputValue(end));
  };

  const loadManualClaims = async (id: string) => {
    setManualClaimsLoading(true);
    setSelectedId(id);
    setSelectedPanel('manualClaims');
    setManualClaims([]);
    setWinners([]);
    setEntrants([]);
    setStockRows([]);
    setClaims([]);
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(id)}/manual-claims`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load manual claims');
      setManualClaims(Array.isArray(json?.claims) ? json.claims : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load manual claims');
      setManualClaims([]);
    } finally {
      setManualClaimsLoading(false);
    }
  };

  const setManualClaimStatus = async (giveawayId: string, claimId: string, status: string) => {
    if (!giveawayId || !claimId) return;
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(giveawayId)}/manual-claims`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update manual claim');
      toast.success('Updated');
      await loadManualClaims(giveawayId);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update manual claim');
    }
  };

  const loadStock = async (id: string) => {
    setStockLoading(true);
    setSelectedId(id);
    setSelectedPanel('stock');
    setStockRows([]);
    setWinners([]);
    setEntrants([]);
    setClaims([]);
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(id)}/prize-stock`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load prize stock');
      setStockRows(Array.isArray(json?.stock) ? json.stock : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load prize stock');
      setStockRows([]);
    } finally {
      setStockLoading(false);
    }
  };

  const addStock = async (giveawayId: string) => {
    const raw = String(stockInput || '').trim();
    if (!raw) {
      toast.error('Paste at least 1 assetId');
      return;
    }

    const lines = raw
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    const items = lines
      .map((line) => {
        const parts = line.split(/\s*,\s*|\s+\|\s+|\s*;\s*/).map((p) => p.trim()).filter(Boolean);
        const assetId = parts[0] ? String(parts[0]) : '';
        const classId = parts[1] ? String(parts[1]) : '';
        const instanceId = parts[2] ? String(parts[2]) : '';
        return {
          assetId,
          classId: classId || undefined,
          instanceId: instanceId || undefined,
        };
      })
      .filter((x) => String(x.assetId || '').trim().length > 0);

    if (!items.length) {
      toast.error('No valid assetIds');
      return;
    }

    setStockAdding(true);
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(giveawayId)}/prize-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to add stock');
      toast.success(`Added ${Number(json?.inserted || 0)} assets`);
      setStockInput('');
      await loadStock(giveawayId);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add stock');
    } finally {
      setStockAdding(false);
    }
  };

  const loadClaims = async (id: string) => {
    setClaimsLoading(true);
    setSelectedId(id);
    setSelectedPanel('claims');
    setClaims([]);
    setWinners([]);
    setEntrants([]);
    setStockRows([]);
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(id)}/claims`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load claims');
      setClaims(Array.isArray(json?.claims) ? json.claims : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load claims');
      setClaims([]);
    } finally {
      setClaimsLoading(false);
    }
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<'winners' | 'entrants' | 'stock' | 'claims' | 'manualClaims' | null>(null);
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [winners, setWinners] = useState<
    Array<{
      steamId: string;
      entries: number;
      tradeUrl: string;
      claimStatus?: string;
      claimDeadlineAt?: string | null;
      claimedAt?: string | null;
      forfeitedAt?: string | null;
    }>
  >([]);
  const [entrantsLoading, setEntrantsLoading] = useState(false);
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);

  const [stockLoading, setStockLoading] = useState(false);
  const [stockRows, setStockRows] = useState<PrizeStockRow[]>([]);
  const [stockInput, setStockInput] = useState('');
  const [stockAdding, setStockAdding] = useState(false);

  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claims, setClaims] = useState<GiveawayClaimRow[]>([]);

  const [manualClaimsLoading, setManualClaimsLoading] = useState(false);
  const [manualClaims, setManualClaims] = useState<ManualClaimRow[]>([]);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/giveaways', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setRows(Array.isArray(json?.giveaways) ? json.giveaways : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load giveaways');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  useEffect(() => {
    if (!userIsOwner) return;
    const q = String(prizeSearch || '').trim();
    if (!q || q.length < 3) {
      setPrizeItem(null);
      setSuggestedCreditsPerEntry(null);
      return;
    }

    const controller = new AbortController();
    const t = window.setTimeout(() => {
      setPrizeItemLoading(true);
      fetch(`/api/item/info?market_hash_name=${encodeURIComponent(q)}`, { cache: 'no-store', signal: controller.signal })
        .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
        .then(async ({ ok, j }) => {
          if (!ok) throw new Error(j?.error || 'Failed');
          const item: PrizeItem = {
            id: String(j?.id || ''),
            name: String(j?.name || j?.market_hash_name || q),
            market_hash_name: String(j?.market_hash_name || q),
            image: j?.image ? String(j.image) : null,
          };
          setPrizeItem(item);
          if (!prize.trim()) {
            setPrize(item.name);
          }

          try {
            const pr = await fetch(`/api/item/price?market_hash_name=${encodeURIComponent(item.market_hash_name)}`, { cache: 'no-store' });
            const pj = await pr.json().catch(() => null);
            const eur = Number(pj?.priceEur);
            if (pr.ok && Number.isFinite(eur) && eur > 0) {
              const whalePackCredits = 30000;
              const whalePackAmountCents = 4999;
              const eurPerCredit = (whalePackAmountCents / 100) / whalePackCredits;
              const profitAndFeesMultiplier = 1.25;
              const totalPrizeEur = eur * Math.max(1, Math.floor(Number(winnerCount || 1)));
              const recommended = Math.min(
                100000,
                Math.max(100, Math.ceil((totalPrizeEur / eurPerCredit) * profitAndFeesMultiplier))
              );
              setSuggestedCreditsPerEntry(recommended);
              if (!editingId) {
                setCreditsPerEntry(recommended);
              }
            } else {
              setSuggestedCreditsPerEntry(null);
            }
          } catch {
            setSuggestedCreditsPerEntry(null);
          }
        })
        .catch(() => {
          setPrizeItem(null);
          setSuggestedCreditsPerEntry(null);
        })
        .finally(() => {
          setPrizeItemLoading(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prizeSearch, userIsOwner]);

  const save = async () => {
    if (!title.trim()) {
      toast.error('Missing title');
      return;
    }
    if (!startAt || !endAt) {
      toast.error('Missing start/end');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        title,
        prize,
        prizeItem,
        description,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        creditsPerEntry,
        winnerCount,
        claimMode,
      };

      if (editingId) {
        const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to update');
        toast.success('Updated giveaway');
      } else {
        const res = await fetch('/api/admin/giveaways', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to create');
        toast.success('Created giveaway');
      }

      setEditingId(null);
      setTitle('');
      setPrize('');
      setPrizeSearch('');
      setPrizeItem(null);
      setDescription('');
      setStartAt('');
      setEndAt('');
      setCreditsPerEntry(10);
      setWinnerCount(1);
      setClaimMode('bot');
      await load();
    } catch (e: any) {
      toast.error(e?.message || (editingId ? 'Failed to update' : 'Failed to create'));
    } finally {
      setCreating(false);
    }
  };

  const beginEdit = (g: GiveawayAdminRow) => {
    if (g.drawnAt) {
      toast.error('Cannot edit a drawn giveaway');
      return;
    }
    setEditingId(g.id);
    setTitle(String(g.title || ''));
    setPrize(String(g.prize || ''));
    setPrizeSearch('');
    setPrizeItem(
      g.prizeItem
        ? {
            id: String(g.prizeItem.id || ''),
            name: String(g.prizeItem.name || ''),
            market_hash_name: String(g.prizeItem.market_hash_name || ''),
            image: g.prizeItem.image || null,
          }
        : null
    );
    setDescription(String(g.description || ''));
    setStartAt(g.startAt ? toLocalInputValue(new Date(g.startAt)) : '');
    setEndAt(g.endAt ? toLocalInputValue(new Date(g.endAt)) : '');
    setCreditsPerEntry(Number(g.creditsPerEntry || 10));
    setSuggestedCreditsPerEntry(null);
    setWinnerCount(Number(g.winnerCount || 1));
    setClaimMode(String((g as any)?.claimMode || 'bot') === 'manual' ? 'manual' : 'bot');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setPrize('');
    setPrizeSearch('');
    setPrizeItem(null);
    setDescription('');
    setStartAt('');
    setEndAt('');
    setCreditsPerEntry(10);
    setSuggestedCreditsPerEntry(null);
    setWinnerCount(1);
    setClaimMode('bot');
  };

  const setGiveawayClaimMode = async (id: string, mode: 'bot' | 'manual') => {
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimMode: mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success('Updated claim mode');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update claim mode');
    }
  };

  const deleteGiveaway = async (id: string) => {
    if (!id) return;
    const ok = window.confirm('Delete this giveaway? This will also remove entries and winners.');
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success('Deleted giveaway');
      if (editingId === id) cancelEdit();
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedPanel(null);
        setWinners([]);
        setEntrants([]);
        setStockRows([]);
        setClaims([]);
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    }
  };

  const rerollAll = async (id: string) => {
    if (!id) return;
    const ok = window.confirm('Reroll all winners?');
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(id)}/reroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success('Rerolled winners');
      await loadWinners(id, false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reroll');
    }
  };

  const rerollWinner = async (giveawayId: string, winnerSteamId: string) => {
    if (!giveawayId || !winnerSteamId) return;
    const ok = window.confirm(`Reroll winner ${winnerSteamId}?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(giveawayId)}/reroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'replace', replaceSteamId: winnerSteamId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success('Rerolled winner');
      await loadWinners(giveawayId, false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reroll');
    }
  };

  const loadWinners = async (id: string, shouldDraw: boolean) => {
    setWinnersLoading(true);
    setSelectedId(id);
    setSelectedPanel('winners');
    setWinners([]);
    setEntrants([]);
    setStockRows([]);
    setClaims([]);
    try {
      if (shouldDraw) {
        const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(id)}/draw`, { method: 'POST' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to draw');
        toast.success('Winners selected');
        await load();
      }

      const res2 = await fetch(`/api/admin/giveaways/${encodeURIComponent(id)}/winners`, { cache: 'no-store' });
      const json2 = await res2.json();
      if (!res2.ok) throw new Error(json2?.error || 'Failed to load winners');
      setWinners(Array.isArray(json2?.winners) ? json2.winners : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load winners');
    } finally {
      setWinnersLoading(false);
    }
  };

  const loadEntrants = async (id: string) => {
    setEntrantsLoading(true);
    setSelectedId(id);
    setSelectedPanel('entrants');
    setEntrants([]);
    setWinners([]);
    setStockRows([]);
    setClaims([]);
    try {
      const res = await fetch(`/api/admin/giveaways/${encodeURIComponent(id)}/entries`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load entrants');
      setEntrants(Array.isArray(json?.entrants) ? json.entrants : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load entrants');
    } finally {
      setEntrantsLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex items-center justify-center text-gray-500 text-[11px]">Sign in first.</div>
      </div>
    );
  }

  if (!userIsOwner) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex items-center justify-center text-gray-500 text-[11px]">Access denied.</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 pb-24">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Owner</p>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Giveaways Admin</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Create giveaways, draw winners, and view trade URLs.</p>
              </div>
              <div className="w-full sm:w-auto flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-5 md:p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-4">Create Giveaway</div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <button onClick={() => applyPreset('day')} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all">
                1 Day
              </button>
              <button onClick={() => applyPreset('week')} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all">
                1 Week
              </button>
              <button onClick={() => applyPreset('month')} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all">
                1 Month
              </button>
              <button onClick={() => applyPreset('year')} className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all">
                1 Year
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 md:py-3 text-[11px] font-black" />
              <select value={claimMode} onChange={(e) => setClaimMode(e.target.value === 'manual' ? 'manual' : 'bot')} className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 md:py-3 text-[11px] font-black">
                <option value="bot">Claim Mode: Bot</option>
                <option value="manual">Claim Mode: Manual</option>
              </select>
              <input
                value={prizeSearch}
                onChange={(e) => setPrizeSearch(e.target.value)}
                placeholder="Search prize skin (e.g. AK-47 | Redline)"
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 md:py-3 text-[11px] font-black"
              />
              <input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Prize title (optional override)" className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 md:py-3 text-[11px] font-black" />
              <input value={startAt} onChange={(e) => setStartAt(e.target.value)} type="datetime-local" className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 md:py-3 text-[11px] font-black" />
              <input value={endAt} onChange={(e) => setEndAt(e.target.value)} type="datetime-local" className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 md:py-3 text-[11px] font-black" />
              <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <input value={String(creditsPerEntry)} onChange={(e) => setCreditsPerEntry(Math.max(1, Math.floor(Number(e.target.value || '10'))))} type="number" min={1} className="bg-transparent outline-none w-full text-[11px] font-black" />
                  {typeof suggestedCreditsPerEntry === 'number' ? (
                    <button
                      type="button"
                      onClick={() => setCreditsPerEntry(suggestedCreditsPerEntry)}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-gray-300"
                    >
                      Use {suggestedCreditsPerEntry}
                    </button>
                  ) : null}
                </div>
                <div className="mt-1 text-[9px] text-gray-500 font-black uppercase tracking-widest">Credits / Entry</div>
              </div>
              <input value={String(winnerCount)} onChange={(e) => setWinnerCount(Math.max(1, Math.floor(Number(e.target.value || '1'))))} type="number" min={1} className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 md:py-3 text-[11px] font-black" />
              <div className="md:col-span-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase tracking-widest font-black text-gray-500">Prize preview</div>
                    <div className="text-[11px] font-black mt-1 truncate">
                      {prizeItemLoading ? 'Loading...' : (prizeItem?.name || '—')}
                    </div>
                    <div className="text-[9px] text-gray-500 truncate">{prizeItem?.market_hash_name || ''}</div>
                  </div>
                  {prizeItem?.image ? (
                    <img src={prizeItem.image} alt={prizeItem.name} className="w-20 h-16 object-contain rounded-lg bg-white/5 border border-white/10" />
                  ) : (
                    <div className="w-20 h-16 rounded-lg bg-white/5 border border-white/10" />
                  )}
                </div>
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="md:col-span-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px]" rows={4} />
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                onClick={save}
                disabled={creating}
                className={`w-full sm:w-auto px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${creating ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              >
                {creating ? (editingId ? 'Saving...' : 'Creating...') : (editingId ? 'Save' : 'Create')}
              </button>
              {editingId ? (
                <button
                  onClick={cancelEdit}
                  disabled={creating}
                  className={`w-full sm:w-auto px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${creating ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </section>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Giveaways</div>
              <button onClick={load} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300">Refresh</button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={18} />
                <span className="text-[11px] uppercase tracking-widest font-black">Loading</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-gray-500 text-[11px]">No giveaways yet.</div>
            ) : (
              <div className="space-y-3">
                {rows.map((g) => (
                  <div key={g.id} className="bg-black/40 border border-white/5 rounded-[1.5rem] p-4">
                    {(() => {
                      const status = getGiveawayStatus(Date.now(), g);
                      return (
                        <div className={`inline-flex items-center px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest mb-3 ${status.className}`}>
                          {status.label}
                        </div>
                      );
                    })()}
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex items-start gap-3">
                        {g.prizeItem?.image ? (
                          <img src={g.prizeItem.image} alt={g.prizeItem.name || g.prize} className="w-14 h-12 object-contain rounded-lg bg-white/5 border border-white/10" />
                        ) : null}
                        <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-widest truncate">{g.title}</div>
                        <div className="text-[10px] text-gray-500 mt-1">{g.prize || 'Prize TBA'}</div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px] text-gray-500">
                          <div className="flex items-center gap-1"><Users size={12} /> Participants: {g.totalParticipants}</div>
                          <div className="flex items-center gap-1"><Gift size={12} /> Entries: {g.totalEntries}</div>
                          <div className="flex items-center gap-1"><Trophy size={12} /> Winners: {g.winnerCount}</div>
                          <div className="flex items-center gap-1"><Gift size={12} /> Credits/Entry: {g.creditsPerEntry}</div>
                        </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                        <button
                          onClick={() => setGiveawayClaimMode(g.id, String((g as any)?.claimMode || 'bot') === 'manual' ? 'bot' : 'manual')}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white/5 hover:bg-white/10 text-white"
                        >
                          {String((g as any)?.claimMode || 'bot') === 'manual' ? 'Manual' : 'Bot'}
                        </button>
                        <button
                          onClick={() => beginEdit(g)}
                          disabled={!!g.drawnAt}
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${g.drawnAt ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => loadStock(g.id)}
                          disabled={stockLoading && selectedId === g.id}
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(stockLoading && selectedId === g.id) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                          {(stockLoading && selectedId === g.id) ? 'Loading...' : 'Prize Stock'}
                        </button>
                        <button
                          onClick={() => deleteGiveaway(g.id)}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-red-600 hover:bg-red-500 text-white"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => loadEntrants(g.id)}
                          disabled={entrantsLoading && selectedId === g.id}
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(entrantsLoading && selectedId === g.id) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                          {(entrantsLoading && selectedId === g.id) ? 'Loading...' : 'Entrants'}
                        </button>
                        <button
                          onClick={() => loadClaims(g.id)}
                          disabled={claimsLoading && selectedId === g.id}
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(claimsLoading && selectedId === g.id) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                          {(claimsLoading && selectedId === g.id) ? 'Loading...' : 'Claims'}
                        </button>
                        <button
                          onClick={() => loadManualClaims(g.id)}
                          disabled={manualClaimsLoading && selectedId === g.id}
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(manualClaimsLoading && selectedId === g.id) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                          {(manualClaimsLoading && selectedId === g.id) ? 'Loading...' : 'Manual Claims'}
                        </button>
                        <button
                          onClick={() => loadWinners(g.id, !g.drawnAt)}
                          disabled={winnersLoading && selectedId === g.id}
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(winnersLoading && selectedId === g.id) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                        >
                          {(winnersLoading && selectedId === g.id) ? 'Loading...' : (g.drawnAt ? 'View Winners' : 'Draw Winners')}
                        </button>
                        {g.drawnAt ? (
                          <button
                            onClick={() => rerollAll(g.id)}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-amber-600 hover:bg-amber-500 text-white"
                          >
                            Reroll
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {selectedId === g.id && selectedPanel === 'winners' && winnersLoading && (
                      <div className="mt-4 text-gray-500 text-[11px]">Loading winners...</div>
                    )}

                    {selectedId === g.id && selectedPanel === 'entrants' && entrantsLoading && (
                      <div className="mt-4 text-gray-500 text-[11px]">Loading entrants...</div>
                    )}

                    {selectedId === g.id && selectedPanel === 'stock' && stockLoading && (
                      <div className="mt-4 text-gray-500 text-[11px]">Loading prize stock...</div>
                    )}

                    {selectedId === g.id && selectedPanel === 'claims' && claimsLoading && (
                      <div className="mt-4 text-gray-500 text-[11px]">Loading claims...</div>
                    )}

                    {selectedId === g.id && selectedPanel === 'manualClaims' && manualClaimsLoading && (
                      <div className="mt-4 text-gray-500 text-[11px]">Loading manual claims...</div>
                    )}

                    {selectedId === g.id && selectedPanel === 'winners' && !winnersLoading && (
                      <div className="mt-4 bg-[#11141d] border border-white/5 rounded-[1.5rem] p-4">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Winners</div>
                        {winners.length === 0 ? (
                          <div className="text-gray-500 text-[11px]">No winners yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {winners.map((w) => (
                              <div key={w.steamId} className="flex items-center justify-between gap-3 bg-black/40 border border-white/5 rounded-xl p-3">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-black uppercase tracking-widest">{w.steamId}</div>
                                  <div className="text-[9px] text-gray-500">Entries: {w.entries}</div>
                                  <div className="text-[9px] text-gray-500">
                                    Status: {w.claimStatus || '—'}
                                    {w.claimDeadlineAt ? ` • Deadline: ${w.claimDeadlineAt}` : ''}
                                    {w.claimedAt ? ` • Claimed: ${w.claimedAt}` : ''}
                                    {w.forfeitedAt ? ` • Forfeited: ${w.forfeitedAt}` : ''}
                                  </div>
                                  {w.tradeUrl ? (
                                    <div className="text-[9px] text-blue-400 break-all">{w.tradeUrl}</div>
                                  ) : (
                                    <div className="text-[9px] text-gray-600">No trade URL set</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {w.tradeUrl ? (
                                    <button onClick={() => copy(w.tradeUrl)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10" aria-label="Copy trade url">
                                      <Copy size={14} className="text-gray-300" />
                                    </button>
                                  ) : null}
                                  <button
                                    onClick={() => rerollWinner(g.id, w.steamId)}
                                    className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all bg-amber-600 hover:bg-amber-500 text-white"
                                  >
                                    Reroll
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedId === g.id && selectedPanel === 'entrants' && !entrantsLoading && (
                      <div className="mt-4 bg-[#11141d] border border-white/5 rounded-[1.5rem] p-4">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Entrants</div>
                        {entrants.length === 0 ? (
                          <div className="text-gray-500 text-[11px]">No entrants yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {entrants.map((x) => (
                              <div key={x.steamId} className="flex items-center justify-between gap-3 bg-black/40 border border-white/5 rounded-xl p-3">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-black uppercase tracking-widest">{x.steamId}</div>
                                  <div className="text-[9px] text-gray-500">Entries: {x.entries} • Spent: {x.creditsSpent}</div>
                                  {x.tradeUrl ? (
                                    <div className="text-[9px] text-blue-400 break-all">{x.tradeUrl}</div>
                                  ) : (
                                    <div className="text-[9px] text-gray-600">No trade URL set</div>
                                  )}
                                </div>
                                {x.tradeUrl && (
                                  <button onClick={() => copy(x.tradeUrl)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10" aria-label="Copy trade url">
                                    <Copy size={14} className="text-gray-300" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedId === g.id && selectedPanel === 'stock' && !stockLoading && (
                      <div className="mt-4 bg-[#11141d] border border-white/5 rounded-[1.5rem] p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Prize Stock</div>
                          <button
                            onClick={() => loadStock(g.id)}
                            className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300"
                          >
                            Refresh
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          <textarea
                            value={stockInput}
                            onChange={(e) => setStockInput(e.target.value)}
                            placeholder="Paste assetIds (one per line). Optional: assetId,classId,instanceId"
                            className="md:col-span-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px]"
                            rows={4}
                          />
                          <button
                            onClick={() => addStock(g.id)}
                            disabled={stockAdding}
                            className={`w-full md:w-auto px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${stockAdding ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                          >
                            {stockAdding ? 'Adding...' : 'Add Stock'}
                          </button>
                        </div>

                        {stockRows.length === 0 ? (
                          <div className="text-gray-500 text-[11px]">No stock for this giveaway.</div>
                        ) : (
                          <div className="space-y-2">
                            {stockRows.map((s) => (
                              <div key={s.id} className="flex items-start justify-between gap-3 bg-black/40 border border-white/5 rounded-xl p-3">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-black uppercase tracking-widest break-all">{s.assetId}</div>
                                  <div className="text-[9px] text-gray-500">
                                    Status: {s.status}
                                    {s.reservedBySteamId ? ` • Reserved: ${s.reservedBySteamId}` : ''}
                                    {s.steamTradeOfferId ? ` • Offer: ${s.steamTradeOfferId}` : ''}
                                  </div>
                                  <div className="text-[9px] text-gray-600">
                                    {s.market_hash_name ? s.market_hash_name : (s.name ? s.name : '')}
                                  </div>
                                </div>
                                <button onClick={() => copy(s.assetId)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10" aria-label="Copy asset id">
                                  <Copy size={14} className="text-gray-300" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedId === g.id && selectedPanel === 'claims' && !claimsLoading && (
                      <div className="mt-4 bg-[#11141d] border border-white/5 rounded-[1.5rem] p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Claims</div>
                          <button
                            onClick={() => loadClaims(g.id)}
                            className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300"
                          >
                            Refresh
                          </button>
                        </div>

                        {claims.length === 0 ? (
                          <div className="text-gray-500 text-[11px]">No claims for this giveaway.</div>
                        ) : (
                          <div className="space-y-2">
                            {claims.map((c) => (
                              <div key={c.id} className="flex items-start justify-between gap-3 bg-black/40 border border-white/5 rounded-xl p-3">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-black uppercase tracking-widest">{c.steamId}</div>
                                  <div className="text-[9px] text-gray-500">
                                    Status: {c.tradeStatus}
                                    {c.steamTradeOfferId ? ` • Offer: ${c.steamTradeOfferId}` : ''}
                                  </div>
                                  {c.lastError ? (
                                    <div className="text-[9px] text-red-400 break-all">{c.lastError}</div>
                                  ) : null}
                                  <div className="text-[9px] text-gray-600 break-all">
                                    {c.assetId ? `assetId: ${c.assetId}` : (c.itemId ? `itemId: ${c.itemId}` : '')}
                                  </div>
                                  <div className="text-[9px] text-gray-700">
                                    {c.botLockId ? `Lock: ${c.botLockId}` : ''}
                                    {c.botLockedAt ? ` • ${c.botLockedAt}` : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {c.steamTradeOfferId ? (
                                    <button onClick={() => copy(String(c.steamTradeOfferId || ''))} className="p-2 rounded-lg bg-white/5 hover:bg-white/10" aria-label="Copy offer id">
                                      <Copy size={14} className="text-gray-300" />
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedId === g.id && selectedPanel === 'manualClaims' && !manualClaimsLoading && (
                      <div className="mt-4 bg-[#11141d] border border-white/5 rounded-[1.5rem] p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Manual Claims</div>
                          <button
                            onClick={() => loadManualClaims(g.id)}
                            className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300"
                          >
                            Refresh
                          </button>
                        </div>

                        {manualClaims.length === 0 ? (
                          <div className="text-gray-500 text-[11px]">No manual claims for this giveaway.</div>
                        ) : (
                          <div className="space-y-2">
                            {manualClaims.map((c) => (
                              <div key={c.id} className="bg-black/40 border border-white/5 rounded-xl p-3">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-black uppercase tracking-widest">{c.steamId}</div>
                                    <div className="text-[9px] text-gray-500">Status: {String(c.status || '').toUpperCase()}</div>
                                    <div className="text-[9px] text-gray-500 break-all">Discord: {c.discordUsername}{c.discordId ? ` (${c.discordId})` : ''}</div>
                                    {c.discordProfileUrl ? (
                                      <a href={c.discordProfileUrl} target="_blank" rel="noreferrer" className="text-[9px] text-blue-400 break-all">
                                        {c.discordProfileUrl}
                                      </a>
                                    ) : null}
                                    {c.email ? <div className="text-[9px] text-gray-500 break-all">Email: {c.email}</div> : null}
                                    {c.lastWebhookError ? <div className="text-[9px] text-red-400 break-all">{c.lastWebhookError}</div> : null}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {(['pending', 'contacted', 'awaiting_user', 'sent', 'completed', 'rejected'] as const).map((st) => (
                                      <button
                                        key={st}
                                        onClick={() => setManualClaimStatus(g.id, c.id, st)}
                                        className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${String(c.status || '') === st ? 'bg-emerald-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                                      >
                                        {st.replace('_', ' ')}
                                      </button>
                                    ))}
                                    <button onClick={() => copy(c.steamId)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10" aria-label="Copy steam id">
                                      <Copy size={14} className="text-gray-300" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
