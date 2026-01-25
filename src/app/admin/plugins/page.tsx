"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Plug, Shield, Trash2 } from 'lucide-react';

type PluginDoc = {
  _id: string;
  slug: string;
  name: string;
  type: 'tawkto' | 'external_script' | 'inline_script';
  enabled: boolean;
  deleted?: boolean;
  config?: Record<string, any>;
};

export default function AdminPluginsPage() {
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [plugins, setPlugins] = useState<PluginDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'tawkto' | 'external_script' | 'inline_script'>('external_script');
  const [newEnabled, setNewEnabled] = useState(true);
  const [newTawkUrl, setNewTawkUrl] = useState('');
  const [newScriptSrc, setNewScriptSrc] = useState('');
  const [newInlineHtml, setNewInlineHtml] = useState('');

  const broadcastPluginsChanged = () => {
    try {
      if (typeof window === 'undefined') return;
      const ts = Date.now().toString();
      window.localStorage.setItem('sv_plugins_changed', ts);
      window.dispatchEvent(new CustomEvent('pluginsChanged'));
    } catch {
    }
  };

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadPlugins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/plugins', {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((data as any)?.error || 'Failed to load plugins'));
        return;
      }
      setPlugins(Array.isArray((data as any)?.plugins) ? (data as any).plugins : []);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load plugins'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadPlugins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const updatePlugin = async (slug: string, patch: Record<string, any>) => {
    setSaving(slug);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/plugins/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((data as any)?.error || 'Failed to update plugin'));
        return;
      }
      const updated = (data as any)?.plugin as PluginDoc | null;
      if (updated) {
        setPlugins((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      } else {
        await loadPlugins();
      }
      broadcastPluginsChanged();
      setMessage('Saved');
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(String(e?.message || 'Request failed'));
    } finally {
      setSaving(null);
    }
  };

  const deletePlugin = async (slug: string) => {
    if (!confirm(`Delete plugin ${slug}?`)) return;
    setSaving(slug);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/plugins/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((data as any)?.error || 'Failed to delete plugin'));
        return;
      }
      setPlugins((prev) => prev.filter((p) => p._id !== slug));
      broadcastPluginsChanged();
      setMessage('Deleted');
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(String(e?.message || 'Request failed'));
    } finally {
      setSaving(null);
    }
  };

  const createPlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('create');
    setError(null);
    setMessage(null);

    const slug = String(newSlug || '').trim().toLowerCase();
    const name = String(newName || '').trim();

    const config = newType === 'tawkto'
      ? { embedUrl: String(newTawkUrl || '').trim() }
      : newType === 'inline_script'
        ? { html: String(newInlineHtml || '').trim() }
        : { src: String(newScriptSrc || '').trim() };

    try {
      const res = await fetch('/api/admin/plugins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ slug, name, type: newType, enabled: newEnabled, config }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((data as any)?.error || 'Failed to create plugin'));
        return;
      }
      const created = (data as any)?.plugin as PluginDoc | null;
      if (created) {
        setPlugins((prev) => {
          const next = [created, ...prev.filter((p) => p._id !== created._id)];
          return next;
        });
      } else {
        await loadPlugins();
      }
      broadcastPluginsChanged();
      setNewSlug('');
      setNewName('');
      setNewEnabled(true);
      setNewTawkUrl('');
      setNewScriptSrc('');
      setNewInlineHtml('');
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
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Plugin Manager</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Enable/disable plugins and manage embeds (like Tawk).</p>
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
                  <Plug className="text-blue-400" size={16} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Plugins</p>
                  <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Installed</h2>
                </div>
              </div>
              <button
                onClick={() => void loadPlugins()}
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
                <Loader2 className="w-4 h-4 animate-spin" /> Loading plugins...
              </div>
            ) : (
              <div className="space-y-3">
                {plugins.map((p) => {
                  const isBusy = saving === p._id;
                  const tawkUrl = String(p?.config?.embedUrl || '');
                  const scriptSrc = String(p?.config?.src || '');
                  const inlineHtml = String(p?.config?.html || '');

                  return (
                    <div key={p._id} className="bg-black/30 border border-white/10 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-black">{p.type}</div>
                          <div className="text-lg font-black uppercase tracking-tight">{p.name}</div>
                          <div className="text-[11px] text-gray-400 mt-1">slug: <span className="text-gray-200 font-mono">{p.slug}</span></div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            disabled={isBusy}
                            onClick={() => void updatePlugin(p._id, { enabled: !p.enabled })}
                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${p.enabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/50' : 'bg-white/10 border-white/10 text-gray-300 hover:border-white/20'} disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            {isBusy ? 'Saving...' : (p.enabled ? 'Enabled' : 'Disabled')}
                          </button>

                          <button
                            disabled={isBusy || p._id === 'tawk'}
                            onClick={() => void deletePlugin(p._id)}
                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/30 text-red-300 hover:border-red-500/50 bg-red-500/10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                            title={p._id === 'tawk' ? 'Default plugin cannot be deleted' : 'Delete plugin'}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {p.type === 'tawkto' ? (
                          <div>
                            <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Tawk embed URL</label>
                            <div className="flex gap-2">
                              <input
                                defaultValue={tawkUrl}
                                onBlur={(e) => {
                                  const next = String(e.target.value || '').trim();
                                  if (next === tawkUrl) return;
                                  void updatePlugin(p._id, { config: { embedUrl: next } });
                                }}
                                placeholder="https://embed.tawk.to/..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                              />
                            </div>
                          </div>
                        ) : p.type === 'inline_script' ? (
                          <div className="md:col-span-2">
                            <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Embed snippet</label>
                            <textarea
                              defaultValue={inlineHtml}
                              onBlur={(e) => {
                                const next = String(e.target.value || '');
                                if (next === inlineHtml) return;
                                void updatePlugin(p._id, { config: { html: next } });
                              }}
                              placeholder="Paste the full embed snippet (script + noscript, etc.)"
                              rows={8}
                              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Script src</label>
                            <input
                              defaultValue={scriptSrc}
                              onBlur={(e) => {
                                const next = String(e.target.value || '').trim();
                                if (next === scriptSrc) return;
                                void updatePlugin(p._id, { config: { src: next } });
                              }}
                              placeholder="https://example.com/script.js"
                              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                            />
                          </div>
                        )}
                      </div>

                      <div className="mt-3 text-[10px] text-gray-500">
                        Changes apply instantly.
                      </div>
                    </div>
                  );
                })}

                {plugins.length === 0 ? (
                  <div className="text-gray-500 text-[11px]">No plugins.</div>
                ) : null}
              </div>
            )}
          </section>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl md:rounded-2xl bg-purple-500/10 border border-purple-500/40 shrink-0">
                <Plug className="text-purple-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Add plugin</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Create</h2>
              </div>
            </div>

            <form onSubmit={createPlugin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Slug</label>
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="e.g. tawk, ga4, hotjar"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                />
              </div>

              <div>
                <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Display name"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                />
              </div>

              <div>
                <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all"
                >
                  <option value="external_script">External Script</option>
                  <option value="inline_script">Inline Script</option>
                  <option value="tawkto">Tawk.to</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Enabled</label>
                <select
                  value={newEnabled ? '1' : '0'}
                  onChange={(e) => setNewEnabled(e.target.value === '1')}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all"
                >
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </div>

              {newType === 'tawkto' ? (
                <div className="md:col-span-2">
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Tawk embed URL</label>
                  <input
                    value={newTawkUrl}
                    onChange={(e) => setNewTawkUrl(e.target.value)}
                    placeholder="https://embed.tawk.to/..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                  />
                </div>
              ) : newType === 'inline_script' ? (
                <div className="md:col-span-2">
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Embed snippet</label>
                  <textarea
                    value={newInlineHtml}
                    onChange={(e) => setNewInlineHtml(e.target.value)}
                    placeholder="Paste the full embed snippet (script + noscript, etc.)"
                    rows={8}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                  />
                </div>
              ) : (
                <div className="md:col-span-2">
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Script src</label>
                  <input
                    value={newScriptSrc}
                    onChange={(e) => setNewScriptSrc(e.target.value)}
                    placeholder="https://example.com/script.js"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving === 'create'}
                  className="w-full bg-blue-600 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving === 'create' ? 'Creating...' : 'Create Plugin'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
