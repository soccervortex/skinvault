"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { useToast } from '@/app/components/Toast';
import { isOwner } from '@/app/utils/owner-ids';
import { Bell, Check, CheckCheck, Loader2, RefreshCw, Trash2 } from 'lucide-react';

type NotificationRow = {
  id: string;
  steamId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string | null;
  readAt: string | null;
  meta: any;
};

export default function NotificationsPage() {
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [requestedSteamId, setRequestedSteamId] = useState('');

  useEffect(() => {
    const readQuery = () => {
      try {
        if (typeof window === 'undefined') return;
        const q = new URLSearchParams(window.location.search).get('steamId');
        setRequestedSteamId(String(q || '').trim());
      } catch {
        setRequestedSteamId('');
      }
    };

    readQuery();
    window.addEventListener('popstate', readQuery);
    return () => window.removeEventListener('popstate', readQuery);
  }, []);

  const targetSteamId = useMemo(() => {
    if (userIsOwner && /^\d{17}$/.test(requestedSteamId)) return requestedSteamId;
    return user?.steamId || null;
  }, [requestedSteamId, user?.steamId, userIsOwner]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const load = async () => {
    if (!targetSteamId) return;
    setLoading(true);
    try {
      const url = `/api/user/notifications?limit=100&steamId=${encodeURIComponent(String(targetSteamId))}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setRows(Array.isArray(json?.notifications) ? json.notifications : []);
      setUnreadCount(Number(json?.unreadCount || 0));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load notifications');
      setRows([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!targetSteamId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSteamId, requestedSteamId]);

  const markRead = async (id: string) => {
    if (!id || !targetSteamId) return;
    setMarkingId(id);
    try {
      const res = await fetch('/api/user/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: String(targetSteamId), ids: [id] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('user-notifications-updated'));
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to mark read');
    } finally {
      setMarkingId(null);
    }
  };

  const markAllRead = async () => {
    if (!targetSteamId) return;
    setMarkingAll(true);
    try {
      const res = await fetch('/api/user/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: String(targetSteamId), markAll: true }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('user-notifications-updated'));
      }
      await load();
      toast.success('Marked all as read');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!id || !targetSteamId) return;
    setDeletingId(id);
    try {
      const res = await fetch('/api/user/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: String(targetSteamId), ids: [id] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('user-notifications-updated'));
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  if (!user?.steamId) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            <div className="bg-[#11141d] p-8 rounded-[2rem] border border-white/5 shadow-xl">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                <Bell size={14} /> Notifications
              </div>
              <div className="mt-4 text-gray-400 text-[11px]">
                Sign in to view notifications.
              </div>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.href = '/api/auth/steam';
                }}
                className="mt-6 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition-all"
              >
                Sign In with Steam
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main id="main-content" className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8 pb-24">
          <header className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                  <Bell size={14} /> Notifications
                </div>
                <div className="mt-3 text-[11px] text-gray-400">
                  Unread: <span className="text-white font-black">{unreadCount}</span>
                  {userIsOwner && requestedSteamId && requestedSteamId !== user?.steamId ? (
                    <span className="text-gray-500"> • Viewing: {requestedSteamId}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void load()}
                  disabled={loading}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loading ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                >
                  <span className="inline-flex items-center gap-2">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Refresh
                  </span>
                </button>
                <button
                  onClick={markAllRead}
                  disabled={markingAll || unreadCount === 0}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(markingAll || unreadCount === 0) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                >
                  <span className="inline-flex items-center gap-2">
                    {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                    Mark All Read
                  </span>
                </button>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : rows.length === 0 ? (
              <div className="text-gray-500 text-[11px]">No notifications.</div>
            ) : (
              <div className="space-y-3">
                {rows.map((n) => {
                  const unread = !n.readAt;
                  return (
                    <div
                      key={n.id}
                      className={`border rounded-[1.5rem] p-4 ${unread ? 'bg-black/50 border-blue-500/20' : 'bg-black/40 border-white/5'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-widest truncate">
                            {n.title || n.type || 'Notification'}
                          </div>
                          <div className="mt-2 text-[11px] text-gray-300 whitespace-pre-wrap break-words">
                            {n.message || ''}
                          </div>
                          <div className="mt-3 text-[9px] text-gray-500">
                            {n.createdAt || ''}
                            {n.readAt ? ` • Read: ${n.readAt}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {unread ? (
                            <button
                              onClick={() => void markRead(n.id)}
                              disabled={markingId === n.id}
                              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${markingId === n.id ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                            >
                              <span className="inline-flex items-center gap-2">
                                {markingId === n.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                Read
                              </span>
                            </button>
                          ) : null}

                          <button
                            onClick={() => void deleteNotification(n.id)}
                            disabled={deletingId === n.id}
                            className={`p-2 rounded-xl border transition-all ${deletingId === n.id ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed' : 'bg-black/40 border-white/10 hover:border-white/20 text-gray-300'}`}
                            aria-label="Delete notification"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
