"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import type { ChatAutomodSettings } from '@/app/utils/chat-automod';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, MessageSquare, Shield } from 'lucide-react';

export default function AdminChatPage() {
  const router = useRouter();
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [globalChatDisabled, setGlobalChatDisabled] = useState(false);
  const [dmChatDisabled, setDmChatDisabled] = useState(false);
  const [loadingChatControl, setLoadingChatControl] = useState(true);
  const [chatControlMessage, setChatControlMessage] = useState<string | null>(null);
  const [chatControlError, setChatControlError] = useState<string | null>(null);

  const [automodLoading, setAutomodLoading] = useState(true);
  const [automodSaving, setAutomodSaving] = useState(false);
  const [automodError, setAutomodError] = useState<string | null>(null);
  const [automodSettings, setAutomodSettings] = useState<ChatAutomodSettings | null>(null);
  const [automodAllowDomainsText, setAutomodAllowDomainsText] = useState('');
  const [automodBannedWordsText, setAutomodBannedWordsText] = useState('');
  const [automodBannedRegexText, setAutomodBannedRegexText] = useState('');

  const [chatFeedLoading, setChatFeedLoading] = useState(false);
  const [chatFeedError, setChatFeedError] = useState<string | null>(null);
  const [chatFeedMessages, setChatFeedMessages] = useState<any[]>([]);

  const [automodEventsLoading, setAutomodEventsLoading] = useState(false);
  const [automodEventsError, setAutomodEventsError] = useState<string | null>(null);
  const [automodEvents, setAutomodEvents] = useState<any[]>([]);

  const [quickTimeoutDuration, setQuickTimeoutDuration] = useState<'1min' | '5min' | '30min' | '60min' | '1day'>('5min');

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;

    if (!userIsOwner) {
      router.push('/admin');
      return;
    }

    let cancelled = false;

    const loadChatControl = async () => {
      setLoadingChatControl(true);
      try {
        const res = await fetch('/api/admin/chat-control');
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setGlobalChatDisabled(data.globalChatDisabled || false);
          setDmChatDisabled(data.dmChatDisabled || false);
        }
      } catch {
      } finally {
        if (!cancelled) setLoadingChatControl(false);
      }
    };

    const loadChatAutomod = async () => {
      setAutomodLoading(true);
      setAutomodError(null);
      try {
        const res = await fetch('/api/admin/chat-automod', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data as any)?.error || 'Failed to load automod settings');
        const settings = (data as any)?.settings as ChatAutomodSettings;
        if (cancelled) return;
        setAutomodSettings(settings || null);
        setAutomodAllowDomainsText((settings?.allowLinkDomains || []).join('\n'));
        setAutomodBannedWordsText((settings?.bannedWords || []).join('\n'));
        setAutomodBannedRegexText((settings?.bannedRegex || []).join('\n'));
      } catch (e: any) {
        if (!cancelled) setAutomodError(e?.message || 'Failed to load automod settings');
      } finally {
        if (!cancelled) setAutomodLoading(false);
      }
    };

    const loadChatFeed = async () => {
      setChatFeedLoading(true);
      setChatFeedError(null);
      try {
        const res = await fetch('/api/chat/messages', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data as any)?.error || 'Failed to load chat');
        const msgs = Array.isArray((data as any)?.messages) ? (data as any).messages : [];
        const last = msgs.slice(Math.max(0, msgs.length - 30));
        if (!cancelled) setChatFeedMessages(last);
      } catch (e: any) {
        if (!cancelled) setChatFeedError(e?.message || 'Failed to load chat');
      } finally {
        if (!cancelled) setChatFeedLoading(false);
      }
    };

    const loadAutomodEvents = async () => {
      setAutomodEventsLoading(true);
      setAutomodEventsError(null);
      try {
        const res = await fetch('/api/admin/chat-automod/events', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data as any)?.error || 'Failed to load automod events');
        if (!cancelled) setAutomodEvents(Array.isArray((data as any)?.events) ? (data as any).events : []);
      } catch (e: any) {
        if (!cancelled) setAutomodEventsError(e?.message || 'Failed to load automod events');
      } finally {
        if (!cancelled) setAutomodEventsLoading(false);
      }
    };

    void loadChatControl();
    void loadChatAutomod();
    void loadChatFeed();
    void loadAutomodEvents();

    const chatFeedInterval = window.setInterval(() => {
      void loadChatFeed();
    }, 5000);

    const automodEventsInterval = window.setInterval(() => {
      void loadAutomodEvents();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(chatFeedInterval);
      window.clearInterval(automodEventsInterval);
    };
  }, [user, userIsOwner, router]);

  const parseLines = (value: string) => {
    return String(value || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => !!l);
  };

  const saveAutomod = async () => {
    if (!user?.steamId || !userIsOwner) return;
    setAutomodSaving(true);
    setAutomodError(null);
    try {
      const next: ChatAutomodSettings = {
        enabled: !!automodSettings?.enabled,
        blockLinks: !!automodSettings?.blockLinks,
        allowLinkDomains: parseLines(automodAllowDomainsText),
        bannedWords: parseLines(automodBannedWordsText),
        bannedRegex: parseLines(automodBannedRegexText),
      };

      const res = await fetch('/api/admin/chat-automod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: next }),
      });
      

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to save automod settings');
      setAutomodSettings((data as any)?.settings || next);
      toast.success('Automod settings updated');
    } catch (e: any) {
      setAutomodError(e?.message || 'Failed to save automod settings');
    } finally {
      setAutomodSaving(false);
    }
  };

  const handleChatControlToggle = async (type: 'global' | 'dm', disabled: boolean) => {
    setChatControlMessage(null);
    setChatControlError(null);

    try {
      const res = await fetch('/api/admin/chat-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [type === 'global' ? 'globalChatDisabled' : 'dmChatDisabled']: disabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setChatControlError(data?.error || `Failed to ${disabled ? 'disable' : 'enable'} ${type} chat.`);
      } else {
        setGlobalChatDisabled(data.globalChatDisabled || false);
        setDmChatDisabled(data.dmChatDisabled || false);
        setChatControlMessage(`${type === 'global' ? 'Global' : 'DM'} chat ${disabled ? 'disabled' : 'enabled'}`);
        setTimeout(() => setChatControlMessage(null), 3000);
      }
    } catch (e: any) {
      setChatControlError(e?.message || 'Request failed.');
    }
  };

  const deleteChatMessage = async (messageId: string) => {
    if (!user?.steamId || !messageId) return;
    try {
      const res = await fetch(`/api/chat/messages/${messageId}?userSteamId=${user.steamId}&type=global`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to delete message');
      setChatFeedMessages((prev) => prev.filter((m: any) => String(m?.id || '') !== String(messageId)));
      toast.success('Message deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete message');
    }
  };

  const quickTimeout = async (steamId: string) => {
    if (!user?.steamId || !steamId) return;
    try {
      const res = await fetch('/api/chat/timeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamId,
          duration: quickTimeoutDuration,
          timeoutReason: 'Admin panel',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to timeout user');
      toast.success(`Timed out ${steamId}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to timeout user');
    }
  };

  const quickUntimeout = async (steamId: string) => {
    if (!user?.steamId || !steamId) return;
    try {
      const res = await fetch(`/api/chat/timeout?steamId=${steamId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to remove timeout');
      toast.success(`Timeout removed for ${steamId}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove timeout');
    }
  };

  const quickBan = async (steamId: string) => {
    if (!steamId) return;
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ steamId, reason: 'Admin panel' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to ban user');
      toast.success(`Banned ${steamId}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to ban user');
    }
  };

  const quickUnban = async (steamId: string) => {
    if (!steamId) return;
    try {
      const res = await fetch(`/api/admin/ban?steamId=${steamId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to unban user');
      toast.success(`Unbanned ${steamId}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to unban user');
    }
  };

  const clearAutomodEvents = async () => {
    if (!user?.steamId || !userIsOwner) return;
    try {
      const res = await fetch('/api/admin/chat-automod/events', {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to clear automod events');
      setAutomodEvents([]);
      toast.success('Automod events cleared');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to clear automod events');
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
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Chat Admin</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Chat control, automod rules, live feed, and blocked message log.</p>
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
                <MessageSquare className="text-blue-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Chat Management</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Controls</h2>
              </div>
            </div>

            <p className="text-[10px] md:text-[11px] text-gray-400 mb-6">
              Temporarily disable global chat or DM chats for maintenance or fixes. Users will see a message that chat is disabled.
            </p>

            {chatControlMessage && (
              <div className="mb-4 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
                <CheckCircle2 size={12} /> <span>{chatControlMessage}</span>
              </div>
            )}
            {chatControlError && (
              <div className="mb-4 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                <AlertTriangle size={12} /> <span>{chatControlError}</span>
              </div>
            )}

            {loadingChatControl ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading chat control status...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">Global Chat</span>
                    <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">
                      {globalChatDisabled ? 'Global chat is currently disabled' : 'Global chat is enabled'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleChatControlToggle('global', !globalChatDisabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${globalChatDisabled ? 'bg-red-600' : 'bg-gray-600'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${globalChatDisabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">DM Chat</span>
                    <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">
                      {dmChatDisabled ? 'DM chat is currently disabled' : 'DM chat is enabled'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleChatControlToggle('dm', !dmChatDisabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dmChatDisabled ? 'bg-red-600' : 'bg-gray-600'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dmChatDisabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">Automod</span>
                    <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">Block links, words, and patterns before they hit chat.</p>
                  </div>
                  <button
                    onClick={() => setAutomodSettings((prev) => (prev ? { ...prev, enabled: !prev.enabled } : prev))}
                    disabled={!automodSettings || automodLoading || automodSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${automodSettings?.enabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${automodSettings?.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                {automodLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-[11px] py-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading automod...
                  </div>
                ) : null}

                {automodError ? (
                  <div className="mb-3 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                    <AlertTriangle size={12} /> <span>{automodError}</span>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Block links</div>
                      <button
                        onClick={() => setAutomodSettings((prev) => (prev ? { ...prev, blockLinks: !prev.blockLinks } : prev))}
                        disabled={!automodSettings || automodLoading || automodSaving}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${automodSettings?.blockLinks ? 'bg-blue-600' : 'bg-gray-600'}`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${automodSettings?.blockLinks ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                    </div>
                    <label className="sr-only" htmlFor="automod-allow-domains">Allowed link domains</label>
                    <textarea
                      id="automod-allow-domains"
                      value={automodAllowDomainsText}
                      onChange={(e) => setAutomodAllowDomainsText(e.target.value)}
                      placeholder="Allowed domains (one per line)\nexample.com\ndiscord.gg"
                      rows={4}
                      className="w-full bg-[#08090d] border border-white/10 rounded-lg p-2 text-[11px] text-white resize-none focus:outline-none focus:border-blue-500"
                      disabled={!automodSettings || automodLoading || automodSaving}
                    />
                  </div>

                  <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                    <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Banned words</div>
                    <label className="sr-only" htmlFor="automod-banned-words">Banned words</label>
                    <textarea
                      id="automod-banned-words"
                      value={automodBannedWordsText}
                      onChange={(e) => setAutomodBannedWordsText(e.target.value)}
                      placeholder="One per line"
                      rows={4}
                      className="w-full bg-[#08090d] border border-white/10 rounded-lg p-2 text-[11px] text-white resize-none focus:outline-none focus:border-blue-500"
                      disabled={!automodSettings || automodLoading || automodSaving}
                    />
                  </div>

                  <div className="bg-black/30 border border-white/10 rounded-xl p-3 lg:col-span-2">
                    <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Banned regex patterns</div>
                    <label className="sr-only" htmlFor="automod-banned-regex">Banned regex patterns</label>
                    <textarea
                      id="automod-banned-regex"
                      value={automodBannedRegexText}
                      onChange={(e) => setAutomodBannedRegexText(e.target.value)}
                      placeholder="One per line (JS regex)"
                      rows={3}
                      className="w-full bg-[#08090d] border border-white/10 rounded-lg p-2 text-[11px] text-white resize-none focus:outline-none focus:border-blue-500"
                      disabled={!automodSettings || automodLoading || automodSaving}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end">
                  <button
                    onClick={saveAutomod}
                    disabled={!automodSettings || automodLoading || automodSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white text-[10px] md:text-[11px] font-black uppercase rounded-lg transition-all"
                  >
                    {automodSaving ? 'Saving…' : 'Save automod'}
                  </button>
                </div>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">Live global chat</span>
                    <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">Last 30 messages (auto-refresh).</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="quick-timeout-duration" className="sr-only">Timeout duration</label>
                    <select
                      id="quick-timeout-duration"
                      value={quickTimeoutDuration}
                      onChange={(e) => setQuickTimeoutDuration(e.target.value as any)}
                      className="bg-[#08090d] border border-white/10 rounded-lg px-2 py-2 text-[10px] text-white"
                    >
                      <option value="1min">1m</option>
                      <option value="5min">5m</option>
                      <option value="30min">30m</option>
                      <option value="60min">60m</option>
                      <option value="1day">1d</option>
                    </select>
                    <button
                      onClick={() => {
                        setChatFeedError(null);
                        setChatFeedLoading(true);
                        fetch('/api/chat/messages', { cache: 'no-store' })
                          .then((r) => r.json().then((j) => ({ r, j })))
                          .then(({ r, j }) => {
                            if (!r.ok) throw new Error((j as any)?.error || 'Failed');
                            const msgs = Array.isArray((j as any)?.messages) ? (j as any).messages : [];
                            setChatFeedMessages(msgs.slice(Math.max(0, msgs.length - 30)));
                          })
                          .catch((e) => setChatFeedError(e?.message || 'Failed'))
                          .finally(() => setChatFeedLoading(false));
                      }}
                      disabled={chatFeedLoading}
                      className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-black uppercase"
                    >
                      {chatFeedLoading ? 'Loading…' : 'Refresh'}
                    </button>
                  </div>
                </div>

                {chatFeedError ? (
                  <div className="mb-3 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                    <AlertTriangle size={12} /> <span>{chatFeedError}</span>
                  </div>
                ) : null}

                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {chatFeedMessages.map((m: any) => (
                    <div key={String(m?.id || '')} className="bg-[#11141d] border border-white/10 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-black truncate">
                            {m?.steamName || 'Unknown User'}{' '}
                            <span className="text-[10px] text-gray-500 font-normal">({m?.steamId || ''})</span>
                          </div>
                          <div className="text-[11px] text-gray-300 break-words whitespace-pre-wrap mt-1">{m?.message || ''}</div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {m?.isTimedOut ? (
                            <button
                              onClick={() => quickUntimeout(String(m?.steamId || ''))}
                              className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-black uppercase rounded-lg"
                            >
                              Untimeout
                            </button>
                          ) : (
                            <button
                              onClick={() => quickTimeout(String(m?.steamId || ''))}
                              className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-black uppercase rounded-lg"
                            >
                              Timeout
                            </button>
                          )}

                          {m?.isBanned ? (
                            <button
                              onClick={() => quickUnban(String(m?.steamId || ''))}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg"
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              onClick={() => quickBan(String(m?.steamId || ''))}
                              className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-[10px] font-black uppercase rounded-lg"
                            >
                              Ban
                            </button>
                          )}

                          <button
                            onClick={() => deleteChatMessage(String(m?.id || ''))}
                            className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-lg"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!chatFeedMessages.length && !chatFeedLoading ? (
                    <div className="text-[11px] text-gray-500 py-4">No messages loaded.</div>
                  ) : null}
                </div>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">Automod hit log</span>
                    <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">Shows blocked messages (latest first). Auto-refresh.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearAutomodEvents}
                      className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-black uppercase"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {automodEventsError ? (
                  <div className="mb-3 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                    <AlertTriangle size={12} /> <span>{automodEventsError}</span>
                  </div>
                ) : null}

                {automodEventsLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-[11px] py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading events...
                  </div>
                ) : null}

                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {automodEvents
                    .slice()
                    .reverse()
                    .map((ev: any) => (
                      <div key={String(ev?.id || '')} className="bg-[#11141d] border border-white/10 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] text-gray-500">
                              {ev?.at ? new Date(ev.at).toLocaleString() : ''}
                              <span className="ml-2 text-gray-400">[{ev?.channel || 'global'}]</span>
                            </div>
                            <div className="text-[11px] font-black truncate mt-1">{ev?.senderId || ''}</div>
                            <div className="text-[10px] text-red-300 mt-1">{ev?.reason || 'Blocked'}</div>
                            <div className="text-[11px] text-gray-300 break-words whitespace-pre-wrap mt-1">{ev?.message || ''}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {!automodEvents.length && !automodEventsLoading ? (
                    <div className="text-[11px] text-gray-500 py-4">No automod hits yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
