"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import { Copy, Loader2, Shield, Wallet } from 'lucide-react';

type LedgerEntry = {
  id?: string;
  steamId: string;
  delta: number;
  type: string;
  createdAt: string | null;
  meta: any;
};

type CreditsRestriction = {
  banned: boolean;
  timeoutUntil: string | null;
  timeoutActive: boolean;
};

export default function AdminCreditsPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [steamId, setSteamId] = useState('');

  const [loadingUser, setLoadingUser] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [lastDailyClaimAt, setLastDailyClaimAt] = useState<string | null>(null);

  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const [granting, setGranting] = useState(false);
  const [grantAmount, setGrantAmount] = useState('100');
  const [grantReason, setGrantReason] = useState('');

  const [adjusting, setAdjusting] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('100');
  const [adjustMode, setAdjustMode] = useState<'add' | 'remove'>('add');
  const [adjustReason, setAdjustReason] = useState('');

  const [settingBalance, setSettingBalance] = useState(false);
  const [setBalanceValue, setSetBalanceValue] = useState('0');
  const [setBalanceReason, setSetBalanceReason] = useState('');

  const [restrictionsLoading, setRestrictionsLoading] = useState(false);
  const [restrictions, setRestrictions] = useState<CreditsRestriction | null>(null);
  const [timeoutMinutes, setTimeoutMinutes] = useState('60');
  const [updatingRestrictions, setUpdatingRestrictions] = useState(false);

  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadUser = async (targetSteamId: string) => {
    const id = String(targetSteamId || '').trim();
    if (!/^\d{17}$/.test(id)) {
      toast.error('Enter a valid 17-digit SteamID64');
      return;
    }

    setLoadingUser(true);
    try {
      const res = await fetch(`/api/admin/credits/user?steamId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setBalance(Number(json?.balance || 0));
      setLastDailyClaimAt(json?.lastDailyClaimAt ? String(json.lastDailyClaimAt) : null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load credits');
      setBalance(null);
      setLastDailyClaimAt(null);
    } finally {
      setLoadingUser(false);
    }
  };

  const loadRestrictions = async (targetSteamId: string) => {
    const id = String(targetSteamId || '').trim();
    if (!/^\d{17}$/.test(id)) {
      setRestrictions(null);
      return;
    }

    setRestrictionsLoading(true);
    try {
      const res = await fetch(`/api/admin/credits/restrictions?steamId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setRestrictions({
        banned: !!json?.banned,
        timeoutUntil: json?.timeoutUntil ? String(json.timeoutUntil) : null,
        timeoutActive: !!json?.timeoutActive,
      });
    } catch (e: any) {
      setRestrictions(null);
      toast.error(e?.message || 'Failed to load restrictions');
    } finally {
      setRestrictionsLoading(false);
    }
  };

  const updateRestrictions = async (action: 'ban' | 'unban' | 'timeout' | 'clear_timeout') => {
    const id = String(steamId || '').trim();
    if (!/^\d{17}$/.test(id)) {
      toast.error('Enter a valid 17-digit SteamID64');
      return;
    }

    setUpdatingRestrictions(true);
    try {
      const payload: any = { steamId: id, action };
      if (action === 'timeout') {
        payload.minutes = Math.floor(Number(timeoutMinutes || 0));
      }
      const res = await fetch('/api/admin/credits/restrictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setRestrictions({
        banned: !!json?.banned,
        timeoutUntil: json?.timeoutUntil ? String(json.timeoutUntil) : null,
        timeoutActive: !!json?.timeoutActive,
      });
      toast.success('Updated credits restrictions');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update restrictions');
    } finally {
      setUpdatingRestrictions(false);
    }
  };

  const adjust = async () => {
    const id = String(steamId || '').trim();
    if (!/^\d{17}$/.test(id)) {
      toast.error('Enter a valid 17-digit SteamID64');
      return;
    }

    const amount = Math.floor(Number(adjustAmount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const delta = adjustMode === 'remove' ? -amount : amount;

    setAdjusting(true);
    try {
      const res = await fetch('/api/admin/credits/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: id, delta, reason: adjustReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setBalance(Number(json?.balance || 0));
      toast.success(delta > 0 ? `Added ${Math.abs(delta)} credits` : `Removed ${Math.abs(delta)} credits`);
      await loadLedger(id);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to adjust');
    } finally {
      setAdjusting(false);
    }
  };

  const setBalanceAction = async () => {
    const id = String(steamId || '').trim();
    if (!/^\d{17}$/.test(id)) {
      toast.error('Enter a valid 17-digit SteamID64');
      return;
    }

    const newBalance = Math.floor(Number(setBalanceValue || 0));
    if (!Number.isFinite(newBalance) || newBalance < 0) {
      toast.error('Enter a valid balance');
      return;
    }

    setSettingBalance(true);
    try {
      const res = await fetch('/api/admin/credits/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: id, balance: newBalance, reason: setBalanceReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setBalance(Number(json?.balance || 0));
      toast.success('Balance updated');
      await loadLedger(id);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to set balance');
    } finally {
      setSettingBalance(false);
    }
  };

  const rollbackEntry = async (entry: LedgerEntry, applyBalance: boolean) => {
    const id = String(steamId || '').trim();
    if (!/^\d{17}$/.test(id)) {
      toast.error('Enter a valid 17-digit SteamID64');
      return;
    }

    const entryId = String(entry?.id || '').trim();
    if (!entryId) {
      toast.error('This ledger entry has no id');
      return;
    }

    const reason = window.prompt('Rollback reason (optional)') || '';
    const ok = window.confirm(applyBalance ? 'Rollback and apply balance change?' : 'Mark rollback without changing balance?');
    if (!ok) return;

    setRollingBackId(entryId);
    try {
      const res = await fetch('/api/admin/credits/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: id, entryId, applyBalance, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setBalance(Number(json?.balance || 0));
      toast.success('Rollback applied');
      await loadLedger(id);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to rollback');
    } finally {
      setRollingBackId(null);
    }
  };

  const loadLedger = async (targetSteamId: string) => {
    const id = String(targetSteamId || '').trim();
    if (!/^\d{17}$/.test(id)) {
      toast.error('Enter a valid 17-digit SteamID64');
      return;
    }

    setLoadingLedger(true);
    try {
      const res = await fetch(`/api/admin/credits/ledger?steamId=${encodeURIComponent(id)}&limit=200`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setLedger(Array.isArray(json?.entries) ? json.entries : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load ledger');
      setLedger([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  const loadAll = async () => {
    const id = String(steamId || '').trim();
    await loadUser(id);
    await loadLedger(id);
    await loadRestrictions(id);
  };

  const grant = async () => {
    const id = String(steamId || '').trim();
    if (!/^\d{17}$/.test(id)) {
      toast.error('Enter a valid 17-digit SteamID64');
      return;
    }

    const amount = Math.floor(Number(grantAmount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setGranting(true);
    try {
      const res = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: id, amount, reason: grantReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setBalance(Number(json?.balance || 0));
      toast.success(`Granted ${json?.granted || amount} credits`);
      await loadLedger(id);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to grant');
    } finally {
      setGranting(false);
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
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Credits Manager</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Search a user, view their ledger, and grant credits.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-4">Lookup</div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3">
              <input
                value={steamId}
                onChange={(e) => setSteamId(e.target.value)}
                placeholder="SteamID64 (17 digits)"
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black"
              />
              <button
                onClick={loadAll}
                disabled={loadingUser || loadingLedger || restrictionsLoading}
                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loadingUser || loadingLedger || restrictionsLoading ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              >
                {loadingUser || loadingLedger || restrictionsLoading ? 'Loading...' : 'Load'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px]">
              <div className="bg-black/40 border border-white/5 rounded-[1.5rem] p-4">
                <div className="text-gray-500 uppercase tracking-widest font-black flex items-center gap-2"><Wallet size={14} /> Balance</div>
                <div className="text-2xl font-black mt-2 italic tracking-tighter">{loadingUser ? '—' : (balance ?? '—')}</div>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-[1.5rem] p-4 md:col-span-2">
                <div className="text-gray-500 uppercase tracking-widest font-black">Last Daily Claim</div>
                <div className="text-[11px] font-black mt-2 break-all">{lastDailyClaimAt || '—'}</div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Grant Credits</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  type="number"
                  min={1}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black"
                />
                <input
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px]"
                />
                <button
                  onClick={grant}
                  disabled={granting}
                  className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${granting ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                >
                  {granting ? 'Granting...' : 'Grant'}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Adjust Credits</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={adjustMode}
                  onChange={(e) => setAdjustMode(e.target.value as any)}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black"
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                </select>
                <input
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  type="number"
                  min={1}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black"
                />
                <input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px]"
                />
                <button
                  onClick={adjust}
                  disabled={adjusting}
                  className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${adjusting ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                >
                  {adjusting ? 'Updating...' : 'Apply'}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Set Balance</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={setBalanceValue}
                  onChange={(e) => setSetBalanceValue(e.target.value)}
                  type="number"
                  min={0}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black"
                />
                <input
                  value={setBalanceReason}
                  onChange={(e) => setSetBalanceReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px]"
                />
                <button
                  onClick={setBalanceAction}
                  disabled={settingBalance}
                  className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingBalance ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                >
                  {settingBalance ? 'Updating...' : 'Set'}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-3">Credits Restrictions</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px]">
                <div className="bg-black/40 border border-white/5 rounded-[1.5rem] p-4">
                  <div className="text-gray-500 uppercase tracking-widest font-black">Credits Ban</div>
                  <div className="text-[11px] font-black mt-2">{restrictionsLoading ? '—' : (restrictions?.banned ? 'BANNED' : 'OK')}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => updateRestrictions('ban')}
                      disabled={updatingRestrictions}
                      className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${updatingRestrictions ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                    >
                      Ban
                    </button>
                    <button
                      onClick={() => updateRestrictions('unban')}
                      disabled={updatingRestrictions}
                      className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${updatingRestrictions ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/15 text-white'}`}
                    >
                      Unban
                    </button>
                  </div>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-[1.5rem] p-4 md:col-span-2">
                  <div className="text-gray-500 uppercase tracking-widest font-black">Credits Timeout</div>
                  <div className="text-[11px] font-black mt-2 break-all">
                    {restrictionsLoading ? '—' : (restrictions?.timeoutActive ? (restrictions?.timeoutUntil || '—') : 'OK')}
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-2">
                    <input
                      value={timeoutMinutes}
                      onChange={(e) => setTimeoutMinutes(e.target.value)}
                      type="number"
                      min={1}
                      className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black"
                      placeholder="Minutes"
                    />
                    <button
                      onClick={() => updateRestrictions('timeout')}
                      disabled={updatingRestrictions}
                      className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${updatingRestrictions ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}
                    >
                      Timeout
                    </button>
                    <button
                      onClick={() => updateRestrictions('clear_timeout')}
                      disabled={updatingRestrictions}
                      className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${updatingRestrictions ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/15 text-white'}`}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Ledger</div>
              <button
                onClick={() => {
                  void loadLedger(steamId);
                  void loadRestrictions(steamId);
                }}
                disabled={loadingLedger}
                className={`text-[10px] font-black uppercase tracking-widest transition-all ${loadingLedger ? 'text-gray-600 cursor-not-allowed' : 'text-blue-400 hover:text-blue-300'}`}
              >
                Refresh
              </button>
            </div>

            {loadingLedger ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={18} />
                <span className="text-[11px] uppercase tracking-widest font-black">Loading</span>
              </div>
            ) : ledger.length === 0 ? (
              <div className="text-gray-500 text-[11px]">No ledger entries.</div>
            ) : (
              <div className="space-y-2">
                {ledger.map((e, idx) => (
                  <div key={`${e.id || e.createdAt || 'x'}_${idx}`} className="bg-black/40 border border-white/5 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest">{e.type || 'entry'}</div>
                        <div className="text-[9px] text-gray-500 mt-1">{e.createdAt || '—'}</div>
                      </div>
                      <div className={`text-[12px] font-black ${e.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{e.delta >= 0 ? `+${e.delta}` : `${e.delta}`}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => rollbackEntry(e, true)}
                        disabled={rollingBackId === String(e.id || '')}
                        className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${rollingBackId === String(e.id || '') ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                      >
                        {rollingBackId === String(e.id || '') ? 'Rolling...' : 'Rollback'}
                      </button>
                      <button
                        onClick={() => rollbackEntry(e, false)}
                        disabled={rollingBackId === String(e.id || '')}
                        className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${rollingBackId === String(e.id || '') ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/15 text-white'}`}
                      >
                        No Balance
                      </button>
                      {e.id ? (
                        <button
                          onClick={() => copy(String(e.id))}
                          className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10"
                        >
                          Copy ID
                        </button>
                      ) : null}
                    </div>
                    {e.meta ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <pre className="text-[9px] text-gray-500 overflow-x-auto max-w-full">{JSON.stringify(e.meta, null, 2)}</pre>
                        <button
                          onClick={() => copy(JSON.stringify(e.meta))}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
                          aria-label="Copy meta"
                        >
                          <Copy size={14} className="text-gray-300" />
                        </button>
                      </div>
                    ) : null}
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
