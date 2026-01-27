"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Shield, Terminal, Trash2 } from 'lucide-react';

type CommandDoc = {
  _id: string;
  slug: string;
  description?: string | null;
  response: string;
  enabled: boolean;
  deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminCommandsPage() {
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [commands, setCommands] = useState<CommandDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newEnabled, setNewEnabled] = useState(true);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadCommands = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/chat-commands', {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((data as any)?.error || 'Failed to load commands'));
        return;
      }
      setCommands(Array.isArray((data as any)?.commands) ? (data as any).commands : []);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load commands'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadCommands();
  }, [userIsOwner]);

  const updateCommand = async (slug: string, patch: Record<string, any>) => {
    setSaving(slug);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/chat-commands/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((data as any)?.error || 'Failed to update command'));
        return;
      }
      const updated = (data as any)?.command as CommandDoc | null;
      if (updated) {
        setCommands((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      } else {
        await loadCommands();
      }
      setMessage('Saved');
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(String(e?.message || 'Request failed'));
    } finally {
      setSaving(null);
    }
  };

  const deleteCommand = async (slug: string) => {
    if (!confirm(`Delete command /${slug}?`)) return;
    setSaving(slug);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/chat-commands/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((data as any)?.error || 'Failed to delete command'));
        return;
      }
      setCommands((prev) => prev.filter((c) => c._id !== slug));
      setMessage('Deleted');
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(String(e?.message || 'Request failed'));
    } finally {
      setSaving(null);
    }
  };

  const createCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('create');
    setError(null);
    setMessage(null);

    const slug = String(newSlug || '').trim().toLowerCase().replace(/^\/+/, '');
    const description = String(newDescription || '').trim();
    const response = String(newResponse || '').trim();

    try {
      const res = await fetch('/api/admin/chat-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ slug, description, response, enabled: newEnabled }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((data as any)?.error || 'Failed to create command'));
        return;
      }
      const created = (data as any)?.command as CommandDoc | null;
      if (created) {
        setCommands((prev) => {
          const next = [created, ...prev.filter((c) => c._id !== created._id)];
          return next;
        });
      } else {
        await loadCommands();
      }
      setNewSlug('');
      setNewDescription('');
      setNewResponse('');
      setNewEnabled(true);
      setMessage('Created');
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(String(e?.message || 'Request failed'));
    } finally {
      setSaving(null);
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
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Commands</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Create custom chat commands like /rules.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/40 shrink-0">
                  <Terminal className="text-blue-400" size={16} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Chat</p>
                  <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Custom Commands</h2>
                </div>
              </div>
              <button
                onClick={() => void loadCommands()}
                className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-black uppercase"
              >
                Refresh
              </button>
            </div>

            {message ? (
              <div className="mb-4 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
                <CheckCircle2 size={12} /> <span>{message}</span>
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                <AlertTriangle size={12} /> <span>{error}</span>
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading commands...
              </div>
            ) : (
              <div className="space-y-3">
                {commands.map((c) => {
                  const isBusy = saving === c._id;
                  return (
                    <div key={c._id} className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-[12px] font-black uppercase tracking-wider truncate">/{c.slug}</div>
                          {c.description ? (
                            <div className="text-[10px] text-gray-400 mt-1 break-words">{c.description}</div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateCommand(c._id, { enabled: !c.enabled })}
                            disabled={isBusy}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase ${
                              c.enabled ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-gray-700 hover:bg-gray-600'
                            } disabled:opacity-60`}
                          >
                            {c.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCommand(c._id)}
                            disabled={isBusy}
                            className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-[10px] font-black uppercase disabled:opacity-60 flex items-center gap-2"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Description</label>
                          <input
                            value={c.description || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCommands((prev) => prev.map((x) => (x._id === c._id ? { ...x, description: v } : x)));
                            }}
                            onBlur={() => updateCommand(c._id, { description: c.description || '' })}
                            className="w-full bg-[#08090d] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white"
                            disabled={isBusy}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Response</label>
                          <textarea
                            value={c.response || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCommands((prev) => prev.map((x) => (x._id === c._id ? { ...x, response: v } : x)));
                            }}
                            onBlur={() => updateCommand(c._id, { response: c.response || '' })}
                            rows={3}
                            className="w-full bg-[#08090d] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white resize-none"
                            disabled={isBusy}
                          />
                          <div className="mt-2 text-[9px] text-gray-500">Variables: {'{user}'} {'{steamId}'} {'{args}'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {commands.length === 0 ? <div className="text-gray-500 text-[11px]">No commands.</div> : null}
              </div>
            )}
          </section>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-4">Create</div>
            <form onSubmit={createCommand} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Command</label>
                  <input
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="rules"
                    className="w-full bg-[#08090d] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white"
                    disabled={saving === 'create'}
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Enabled</label>
                  <button
                    type="button"
                    onClick={() => setNewEnabled((v) => !v)}
                    disabled={saving === 'create'}
                    className={`w-full px-3 py-2 rounded-lg text-[10px] font-black uppercase ${
                      newEnabled ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-gray-700 hover:bg-gray-600'
                    } disabled:opacity-60`}
                  >
                    {newEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Description</label>
                  <input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Shows chat rules"
                    className="w-full bg-[#08090d] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white"
                    disabled={saving === 'create'}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Response</label>
                  <textarea
                    value={newResponse}
                    onChange={(e) => setNewResponse(e.target.value)}
                    placeholder="Be respectful. No scams."
                    rows={4}
                    className="w-full bg-[#08090d] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white resize-none"
                    disabled={saving === 'create'}
                  />
                  <div className="mt-2 text-[9px] text-gray-500">Variables: {'{user}'} {'{steamId}'} {'{args}'}</div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving === 'create'}
                className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving === 'create' ? 'Creating…' : 'Create Command'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
