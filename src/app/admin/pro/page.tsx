"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import { AlertTriangle, ArrowLeft, CheckCircle2, Edit, Loader2, Shield, Trash2 } from 'lucide-react';

type ProEntry = {
  steamId: string;
  proUntil: string;
  isActive: boolean;
  daysRemaining: number;
};

export default function AdminProPage() {
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [steamId, setSteamId] = useState('');
  const [months, setMonths] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ProEntry[]>([]);
  const [totals, setTotals] = useState<{ total: number; active: number; expired: number }>({
    total: 0,
    active: 0,
    expired: 0,
  });

  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');

  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [loadingUserCount, setLoadingUserCount] = useState(true);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const res = await fetch('/api/admin/pro/stats');
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatsError(String((data as any)?.error || 'Failed to load stats.'));
      } else {
        setEntries(Array.isArray((data as any)?.entries) ? (data as any).entries : []);
        setTotals({
          total: Number((data as any)?.total ?? 0),
          active: Number((data as any)?.active ?? 0),
          expired: Number((data as any)?.expired ?? 0),
        });
      }
    } catch (e: any) {
      setStatsError(String(e?.message || 'Failed to load stats.'));
    } finally {
      setLoadingStats(false);
    }
  };

  const loadUserCount = async () => {
    setLoadingUserCount(true);
    try {
      const res = await fetch('/api/admin/user-count');
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setTotalUsers(Number((data as any)?.totalUsers || 0));
      }
    } catch {
    } finally {
      setLoadingUserCount(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadStats();
    void loadUserCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const id = String(steamId || '').trim();
    const m = Math.floor(Number(months || 0));

    if (!/^\d{17}$/.test(id) || !Number.isFinite(m) || m <= 0) {
      setError('Please enter a valid SteamID64 and positive months.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/pro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ steamId: id, months: m }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((data as any)?.error || 'Failed to update Pro status.'));
      } else {
        setMessage(`Updated Pro for ${String((data as any)?.steamId || id)}, new expiry: ${String((data as any)?.proUntil || '')}`);
        toast.success('Pro updated');
        await loadStats();
      }
    } catch (e: any) {
      setError(String(e?.message || 'Request failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePro = async (steamIdToDelete: string) => {
    if (!confirm(`Are you sure you want to remove Pro status for ${steamIdToDelete}?`)) return;
    try {
      const res = await fetch(`/api/admin/pro?steamId=${encodeURIComponent(String(steamIdToDelete || ''))}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(String((data as any)?.error || 'Failed to delete Pro status'));
        return;
      }
      toast.success('Pro removed');
      await loadStats();
    } catch (e: any) {
      toast.error(String(e?.message || 'Request failed.'));
    }
  };

  const handleEditPro = async (steamIdToEdit: string, newDate: string) => {
    try {
      const res = await fetch('/api/admin/pro', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ steamId: steamIdToEdit, proUntil: newDate }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(String((data as any)?.error || 'Failed to edit Pro status'));
        return;
      }
      toast.success('Pro expiry updated');
      setEditingEntry(null);
      setEditDate('');
      await loadStats();
    } catch (e: any) {
      toast.error(String(e?.message || 'Request failed.'));
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
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Pro Manager</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Grant, extend, and manage Pro expiration dates.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 text-[10px] md:text-[11px]">
            <div className="bg-black/40 border border-blue-500/30 rounded-xl md:rounded-2xl p-3 md:p-4">
              <p className="text-blue-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">Total Users</p>
              <p className="text-xl md:text-2xl font-black text-blue-400">
                {loadingUserCount ? <Loader2 className="animate-spin inline" size={20} /> : totalUsers}
              </p>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4">
              <p className="text-gray-500 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">Total Pro users</p>
              <p className="text-xl md:text-2xl font-black">{totals.total}</p>
            </div>
            <div className="bg-black/40 border border-emerald-500/30 rounded-xl md:rounded-2xl p-3 md:p-4">
              <p className="text-emerald-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">Active</p>
              <p className="text-xl md:text-2xl font-black text-emerald-400">{totals.active}</p>
            </div>
            <div className="bg-black/40 border border-red-500/30 rounded-xl md:rounded-2xl p-3 md:p-4">
              <p className="text-red-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">Expired</p>
              <p className="text-xl md:text-2xl font-black text-red-400">{totals.expired}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.1fr,1.5fr] gap-6 md:gap-8 items-start">
            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4 text-[10px] md:text-[11px]">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Grant / extend Pro</div>

              <div>
                <label htmlFor="admin-pro-steam-id" className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                  SteamID64
                </label>
                <input
                  id="admin-pro-steam-id"
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  placeholder="7656119..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                />
              </div>

              <div>
                <label htmlFor="admin-pro-months" className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                  Months to add
                </label>
                <input
                  id="admin-pro-months"
                  type="number"
                  min={1}
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />}
                {submitting ? 'Saving...' : 'Save Pro Status'}
              </button>

              {message ? (
                <div className="mt-2 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
                  <CheckCircle2 size={12} /> <span>{message}</span>
                </div>
              ) : null}

              {error ? (
                <div className="mt-2 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                  <AlertTriangle size={12} /> <span>{error}</span>
                </div>
              ) : null}
            </form>

            <div className="space-y-3 text-[10px] md:text-[11px]">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Pro users dashboard</div>
                <button
                  onClick={() => void loadStats()}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300"
                >
                  Refresh
                </button>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 max-h-72 overflow-y-auto">
                {loadingStats ? (
                  <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading stats...
                  </div>
                ) : statsError ? (
                  <div className="text-red-400 text-[11px]">{statsError}</div>
                ) : entries.length === 0 ? (
                  <div className="text-gray-500 text-[11px]">No Pro users yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[9px] md:text-[10px] min-w-[520px]">
                      <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                        <tr>
                          <th className="py-2 pr-2">SteamID</th>
                          <th className="py-2 pr-2">Expires</th>
                          <th className="py-2 pr-2">Status</th>
                          <th className="py-2 pr-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr key={e.steamId} className="border-b border-white/5 last:border-b-0">
                            <td className="py-2 pr-2 font-mono text-[9px] break-all">{e.steamId}</td>
                            <td className="py-2 pr-2 text-[9px]">
                              {editingEntry === e.steamId ? (
                                <input
                                  type="datetime-local"
                                  value={editDate}
                                  onChange={(ev) => setEditDate(ev.target.value)}
                                  className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[9px] text-blue-500"
                                />
                              ) : (
                                <>
                                  {new Date(e.proUntil).toLocaleDateString()} {e.isActive && `(${e.daysRemaining}d)`}
                                </>
                              )}
                            </td>
                            <td className="py-2 pr-2">
                              {e.isActive ? (
                                <span className="text-emerald-400 text-[9px]">Active</span>
                              ) : (
                                <span className="text-gray-500 text-[9px]">Expired</span>
                              )}
                            </td>
                            <td className="py-2 pr-2">
                              <div className="flex items-center gap-1">
                                {editingEntry === e.steamId ? (
                                  <>
                                    <button
                                      onClick={() => handleEditPro(e.steamId, editDate || e.proUntil)}
                                      className="p-1 text-emerald-400 hover:text-emerald-300"
                                      title="Save"
                                    >
                                      <CheckCircle2 size={12} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingEntry(null);
                                        setEditDate('');
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-300"
                                      title="Cancel"
                                    >
                                      <AlertTriangle size={12} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingEntry(e.steamId);
                                        setEditDate(new Date(e.proUntil).toISOString().slice(0, 16));
                                      }}
                                      className="p-1 text-blue-400 hover:text-blue-300"
                                      title="Edit"
                                    >
                                      <Edit size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePro(e.steamId)}
                                      className="p-1 text-red-400 hover:text-red-300"
                                      title="Delete"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
