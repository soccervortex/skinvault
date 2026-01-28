"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import HelpTooltip from '@/app/components/HelpTooltip';
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Clock, Loader2, Search, Shield, X } from 'lucide-react';

export default function AdminModerationPage() {
  const router = useRouter();
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [banSteamId, setBanSteamId] = useState('');
  const [banning, setBanning] = useState(false);
  const [banStatus, setBanStatus] = useState<{ steamId: string; banned: boolean } | null>(null);
  const [loadingBanStatus, setLoadingBanStatus] = useState(false);

  const [timeouts, setTimeouts] = useState<Array<{ steamId: string; timeoutUntil: string; minutesRemaining: number }>>([]);
  const [loadingTimeouts, setLoadingTimeouts] = useState(true);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadTimeouts = async () => {
    if (!userIsOwner) return;
    setLoadingTimeouts(true);
    try {
      const res = await fetch('/api/admin/timeouts');
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setTimeouts(Array.isArray((data as any)?.timeouts) ? (data as any).timeouts : []);
      }
    } catch {
    } finally {
      setLoadingTimeouts(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadTimeouts();
    const id = window.setInterval(() => {
      void loadTimeouts();
    }, 30000);
    return () => {
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const handleCheckBanStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = String(banSteamId || '').trim();
    if (!id || !/^\d{17}$/.test(id)) {
      toast.error('Invalid SteamID64 format');
      return;
    }

    setLoadingBanStatus(true);
    setBanStatus(null);
    try {
      const res = await fetch(`/api/admin/ban?steamId=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setBanStatus({ steamId: id, banned: (data as any)?.banned === true });
      } else {
        toast.error(String((data as any)?.error || 'Failed to check ban status'));
      }
    } catch (e: any) {
      toast.error(String(e?.message || 'Request failed.'));
    } finally {
      setLoadingBanStatus(false);
    }
  };

  const handleBanUser = async () => {
    if (!banStatus?.steamId) return;
    setBanning(true);
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ steamId: banStatus.steamId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toast.success('User banned');
        setBanStatus({ steamId: banStatus.steamId, banned: true });
      } else {
        toast.error(String((data as any)?.error || 'Failed to ban Steam ID'));
      }
    } catch (e: any) {
      toast.error(String(e?.message || 'Request failed.'));
    } finally {
      setBanning(false);
    }
  };

  const handleUnbanUser = async () => {
    if (!banStatus?.steamId) return;
    setBanning(true);
    try {
      const res = await fetch(`/api/admin/ban?steamId=${encodeURIComponent(banStatus.steamId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toast.success('User unbanned');
        setBanStatus({ steamId: banStatus.steamId, banned: false });
      } else {
        toast.error(String((data as any)?.error || 'Failed to unban Steam ID'));
      }
    } catch (e: any) {
      toast.error(String(e?.message || 'Request failed.'));
    } finally {
      setBanning(false);
    }
  };

  const removeTimeout = async (steamId: string) => {
    const sid = String(steamId || '').trim();
    if (!sid) return;
    try {
      const res = await fetch(`/api/chat/timeout?steamId=${encodeURIComponent(sid)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Timeout removed');
        setTimeouts((prev) => prev.filter((t) => String(t?.steamId || '') !== sid));
      } else {
        const data = await res.json().catch(() => null);
        toast.error(String((data as any)?.error || 'Failed to remove timeout'));
      }
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed to remove timeout'));
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
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Moderation</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Ban management and active timeouts.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl md:rounded-2xl bg-red-500/10 border border-red-500/40 shrink-0">
                <Ban className="text-red-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">User Management</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Ban Steam ID</h2>
              </div>
            </div>

            <div className="flex items-start justify-between gap-2 mb-4">
              <p className="text-[10px] md:text-[11px] text-gray-400">Enter a Steam ID to check their ban status and ban or unban them.</p>
              <HelpTooltip
                title="Ban Management"
                content={
                  <>
                    <p className="mb-2">Manage user bans:</p>
                    <p className="mb-1">• Enter a 17-digit Steam64 ID</p>
                    <p className="mb-1">• Check current ban status</p>
                    <p className="mb-1">• Ban or unban users as needed</p>
                    <p className="text-blue-400 mt-2">💡 Tip: Banned users cannot access the site and will see a ban notification</p>
                  </>
                }
                position="left"
              />
            </div>

            <form onSubmit={handleCheckBanStatus} className="space-y-3 md:space-y-4 text-[10px] md:text-[11px] mb-6">
              <div>
                <label htmlFor="admin-ban-steam-id" className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">SteamID64 to check</label>
                <input
                  id="admin-ban-steam-id"
                  value={banSteamId}
                  onChange={(e) => {
                    setBanSteamId(e.target.value);
                    setBanStatus(null);
                  }}
                  placeholder="7656119..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-red-500 outline-none focus:border-red-500 transition-all placeholder:text-gray-700"
                />
              </div>
              <button
                type="submit"
                disabled={loadingBanStatus}
                className="w-full bg-red-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingBanStatus && <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />}
                {loadingBanStatus ? 'Checking...' : 'Check Status'}
              </button>
            </form>

            {banStatus ? (
              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-gray-500">Status for {banStatus.steamId}</p>
                  <button
                    onClick={() => {
                      setBanStatus(null);
                      setBanSteamId('');
                    }}
                    className="text-gray-500 hover:text-white transition-colors"
                    aria-label="Clear"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] md:text-[11px] text-gray-400 mb-1">Ban Status:</p>
                    <p className={`text-[11px] md:text-[12px] font-black ${banStatus.banned ? 'text-red-400' : 'text-emerald-400'}`}>
                      {banStatus.banned ? '❌ Banned' : '✅ Not Banned'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    onClick={() => router.push(`/admin/user/${banStatus.steamId}`)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Search size={12} /> View User
                  </button>

                  {banStatus.banned ? (
                    <button
                      onClick={handleUnbanUser}
                      disabled={banning}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {banning ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 size={12} />} Unban
                    </button>
                  ) : (
                    <button
                      onClick={handleBanUser}
                      disabled={banning}
                      className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {banning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban size={12} />} Ban
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl md:rounded-2xl bg-amber-500/10 border border-amber-500/40 shrink-0">
                  <Clock className="text-amber-400" size={16} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">User Management</p>
                  <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Active Timeouts</h2>
                </div>
              </div>

              <button
                onClick={loadTimeouts}
                className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-black uppercase"
              >
                Refresh
              </button>
            </div>

            {loadingTimeouts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-amber-400" size={24} />
              </div>
            ) : timeouts.length === 0 ? (
              <p className="text-[10px] md:text-[11px] text-gray-400">No active timeouts</p>
            ) : (
              <div className="space-y-2">
                {timeouts.map((timeout) => (
                  <div
                    key={timeout.steamId}
                    className="bg-black/40 border border-amber-500/30 rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] md:text-[11px] font-black text-white mb-1 break-all">{timeout.steamId}</p>
                      <p className="text-[9px] md:text-[10px] text-gray-400">{timeout.minutesRemaining} minute(s) remaining</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/admin/user/${timeout.steamId}`)}
                        className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors flex items-center gap-1"
                      >
                        <Search size={12} /> View
                      </button>
                      <button
                        onClick={() => void removeTimeout(timeout.steamId)}
                        className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors"
                      >
                        Remove
                      </button>
                    </div>
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
