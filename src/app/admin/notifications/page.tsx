"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import { ArrowLeft, Bell, Loader2, Shield } from 'lucide-react';

export default function AdminNotificationsPage() {
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [adminNotificationTarget, setAdminNotificationTarget] = useState<'user' | 'all'>('user');
  const [adminNotificationSteamId, setAdminNotificationSteamId] = useState('');
  const [adminNotificationType, setAdminNotificationType] = useState('info');
  const [adminNotificationTitle, setAdminNotificationTitle] = useState('');
  const [adminNotificationMessage, setAdminNotificationMessage] = useState('');
  const [adminNotificationMaxUsers, setAdminNotificationMaxUsers] = useState('5000');
  const [sendingAdminNotification, setSendingAdminNotification] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const handleSendAdminNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIsOwner) return;

    const title = String(adminNotificationTitle || '').trim();
    const msg = String(adminNotificationMessage || '').trim();
    const type = String(adminNotificationType || 'info').trim() || 'info';
    const steamId = String(adminNotificationSteamId || '').trim();
    const target = adminNotificationTarget;

    if (!title) {
      toast.error('Missing title');
      return;
    }
    if (!msg) {
      toast.error('Missing message');
      return;
    }
    if (target === 'user' && !/^\d{17}$/.test(steamId)) {
      toast.error('Invalid SteamID64');
      return;
    }

    setSendingAdminNotification(true);
    try {
      const payload: any = { type, title, message: msg };
      if (target === 'all') {
        payload.target = 'all';
        const max = Math.max(1, Math.min(5000, Math.floor(Number(adminNotificationMaxUsers || 5000))));
        payload.maxUsers = max;
      } else {
        payload.steamId = steamId;
      }

      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json as any)?.error || 'Failed to send notification');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('user-notifications-updated'));
      }

      const sent = Number((json as any)?.sent || 0);
      toast.success(`Notification sent (${sent || 1})`);
      setAdminNotificationTitle('');
      setAdminNotificationMessage('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send notification');
    } finally {
      setSendingAdminNotification(false);
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
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Notifications</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Send user notifications to a specific user or broadcast.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/40 shrink-0">
                <Bell className="text-blue-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Notifications</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Send Notification</h2>
              </div>
            </div>

            <form onSubmit={handleSendAdminNotification} className="space-y-3 md:space-y-4 text-[10px] md:text-[11px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Target</label>
                  <select
                    value={adminNotificationTarget}
                    onChange={(e) => setAdminNotificationTarget(e.target.value === 'all' ? 'all' : 'user')}
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-white outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="user">Specific user</option>
                    <option value="all">All users</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Type</label>
                  <select
                    value={adminNotificationType}
                    onChange={(e) => setAdminNotificationType(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-white outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="info">info</option>
                    <option value="success">success</option>
                    <option value="warning">warning</option>
                    <option value="error">error</option>
                  </select>
                </div>

                {adminNotificationTarget === 'user' ? (
                  <div className="md:col-span-2">
                    <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">SteamID64</label>
                    <input
                      value={adminNotificationSteamId}
                      onChange={(e) => setAdminNotificationSteamId(e.target.value)}
                      placeholder="7656119..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Max Users</label>
                    <input
                      value={adminNotificationMaxUsers}
                      onChange={(e) => setAdminNotificationMaxUsers(e.target.value)}
                      placeholder="5000"
                      className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                    />
                    <div className="mt-2 text-[9px] text-gray-500">Broadcast uses the most complete list of known SteamIDs from active collections.</div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Title</label>
                  <input
                    value={adminNotificationTitle}
                    onChange={(e) => setAdminNotificationTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Message</label>
                  <textarea
                    value={adminNotificationMessage}
                    onChange={(e) => setAdminNotificationMessage(e.target.value)}
                    placeholder="Message"
                    rows={4}
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={sendingAdminNotification}
                className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendingAdminNotification && <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />}
                {sendingAdminNotification ? 'Sending...' : adminNotificationTarget === 'all' ? 'Broadcast Notification' : 'Send Notification'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
