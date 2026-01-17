"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { useToast } from '@/app/components/Toast';
import { Coins, Loader2, Star, RefreshCw } from 'lucide-react';

type SpinsStatus = {
  ok: boolean;
  steamId: string;
  spins: number;
  pro: boolean;
  canClaim: boolean;
  nextEligibleAt: string;
  serverNow: string;
};

export default function SpinsPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SpinsStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/spins', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setStatus(json as SpinsStatus);
    } catch (e: any) {
      setStatus(null);
      toast.error(e?.message || 'Failed to load spins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const claimDaily = async () => {
    setClaiming(true);
    try {
      const res = await fetch('/api/spins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'daily_claim' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setStatus((prev) => (prev ? { ...prev, spins: Number(json?.spins || prev.spins), canClaim: false, nextEligibleAt: String(json?.nextEligibleAt || prev.nextEligibleAt) } : prev));
      toast.success(`Claimed ${json?.claimed || 0} spin(s)`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to claim');
    } finally {
      setClaiming(false);
    }
  };

  const rollSpin = async () => {
    setRolling(true);
    try {
      const res = await fetch('/api/spins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'roll' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setStatus((prev) => (prev ? { ...prev, spins: Number(json?.spins ?? prev.spins) } : prev));
      toast.success(`You won ${json?.rewardCredits || 0} credits!`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to roll');
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="w-full max-w-3xl mx-auto bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
              <Star className="text-yellow-400" size={20} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Daily Spins</p>
              <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">Spins</h1>
            </div>
            <button
              onClick={() => void loadStatus()}
              disabled={loading}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>

          {!user?.steamId ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-[11px] text-red-200">
              You must be signed in with Steam to use spins.
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-[11px]">
              <Loader2 className="animate-spin" size={18} /> Loading spins...
            </div>
          ) : status ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Spins</div>
                <div className="text-2xl font-black mt-2">{status.spins}</div>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Daily Claim</div>
                <div className="text-[11px] font-black mt-2">{status.canClaim ? 'AVAILABLE' : 'NOT AVAILABLE'}</div>
                <div className="text-[10px] text-gray-500 mt-1 break-all">Next: {status.nextEligibleAt}</div>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Rewards</div>
                <div className="text-[11px] font-black mt-2">Win credits</div>
                <div className="text-[10px] text-gray-500 mt-1">Roll a spin to win credits instantly.</div>
              </div>

              <div className="md:col-span-3 flex flex-col md:flex-row gap-3">
                <button
                  onClick={claimDaily}
                  disabled={claiming || !status.canClaim}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  {claiming ? <Loader2 className="animate-spin" size={16} /> : <Coins size={16} />}
                  Claim Daily Spins
                </button>
                <button
                  onClick={rollSpin}
                  disabled={rolling || status.spins <= 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  {rolling ? <Loader2 className="animate-spin" size={16} /> : <Star size={16} />}
                  Roll Spin
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-black/30 border border-white/10 rounded-2xl p-5 text-[11px] text-gray-400">
              No spins data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
