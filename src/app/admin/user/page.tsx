"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import { ArrowLeft, Loader2, Search, Shield, User } from 'lucide-react';

export default function AdminUserSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [steamId, setSteamId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const fromQuery = String(searchParams?.get('steamId') || '').trim();
    if (fromQuery && /^\d{17}$/.test(fromQuery)) {
      setSteamId(fromQuery);
    }
  }, [searchParams]);

  const go = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = String(steamId || '').trim();
    if (!/^\d{17}$/.test(id)) {
      toast.error('Enter a valid 17-digit SteamID64');
      return;
    }

    setBusy(true);
    try {
      router.push(`/admin/user/${id}`);
    } finally {
      setBusy(false);
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
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>

          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Owner</p>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">User Finder</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Open the user moderation page by SteamID64.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black mb-4">Lookup</div>
            <form onSubmit={go} className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3">
              <input
                value={steamId}
                onChange={(e) => setSteamId(e.target.value)}
                placeholder="SteamID64 (17 digits)"
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black"
              />
              <button
                type="submit"
                disabled={busy}
                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${busy ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    Opening
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Search size={16} />
                    Open
                  </span>
                )}
              </button>
            </form>

            <div className="mt-5 bg-black/40 border border-white/10 rounded-2xl p-4 text-[10px] text-gray-400">
              <div className="flex items-center gap-2 text-gray-300 font-black uppercase tracking-widest text-[9px]">
                <User size={14} />
                Tip
              </div>
              <div className="mt-2">You can paste a SteamID64 from the leaderboard, purchases, or chat reports.</div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
