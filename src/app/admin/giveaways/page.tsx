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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<'winners' | 'entrants' | null>(null);
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
              const recommended = Math.min(100000, Math.max(100, Math.round(eur * 200)));
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
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Sign in first.</div>
      </div>
    );
  }

  if (!userIsOwner) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Access denied.</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 pb-24">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Owner</p>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Giveaways Admin</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Create giveaways, draw winners, and view trade URLs.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
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
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black" />
              <input
                value={prizeSearch}
                onChange={(e) => setPrizeSearch(e.target.value)}
                placeholder="Search prize skin (e.g. AK-47 | Redline)"
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black"
              />
              <input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Prize title (optional override)" className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black" />
              <input value={startAt} onChange={(e) => setStartAt(e.target.value)} type="datetime-local" className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black" />
              <input value={endAt} onChange={(e) => setEndAt(e.target.value)} type="datetime-local" className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black" />
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
              <input value={String(winnerCount)} onChange={(e) => setWinnerCount(Math.max(1, Math.floor(Number(e.target.value || '1'))))} type="number" min={1} className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black" />
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
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                onClick={save}
                disabled={creating}
                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${creating ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              >
                {creating ? (editingId ? 'Saving...' : 'Creating...') : (editingId ? 'Save' : 'Create')}
              </button>
              {editingId ? (
                <button
                  onClick={cancelEdit}
                  disabled={creating}
                  className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${creating ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => beginEdit(g)}
                          disabled={!!g.drawnAt}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${g.drawnAt ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteGiveaway(g.id)}
                          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-red-600 hover:bg-red-500 text-white"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => loadEntrants(g.id)}
                          disabled={entrantsLoading && selectedId === g.id}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(entrantsLoading && selectedId === g.id) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                          {(entrantsLoading && selectedId === g.id) ? 'Loading...' : 'Entrants'}
                        </button>
                        <button
                          onClick={() => loadWinners(g.id, !g.drawnAt)}
                          disabled={winnersLoading && selectedId === g.id}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(winnersLoading && selectedId === g.id) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                        >
                          {(winnersLoading && selectedId === g.id) ? 'Loading...' : (g.drawnAt ? 'View Winners' : 'Draw Winners')}
                        </button>
                        {g.drawnAt ? (
                          <button
                            onClick={() => rerollAll(g.id)}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-amber-600 hover:bg-amber-500 text-white"
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
