"use client";

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Link from 'next/link';
import { isOwner } from '@/app/utils/owner-ids';
import { Plus, X } from 'lucide-react';

type CreatorProfile = {
  slug: string;
  displayName: string;
  tagline?: string;
  avatarUrl?: string;
  tiktokUsername?: string;
  youtubeChannelId?: string;
  twitchLogin?: string;
};

export default function CreatorsIndexClient() {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    slug: '',
    tagline: '',
    avatarUrl: '',
    tiktokUsername: '',
    youtubeChannelId: '',
    twitchLogin: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const adminSteamId = useMemo(() => {
    try {
      const raw = window.localStorage.getItem('steam_user');
      if (!raw) return null;
      const user = JSON.parse(raw);
      return user?.steamId || null;
    } catch {
      return null;
    }
  }, []);

  const canManage = isOwner(adminSteamId);

  const fetchCreators = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/creators', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch creators (${res.status})`);
      const data = await res.json();
      setCreators(Array.isArray(data?.creators) ? data.creators : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load creators');
      setCreators([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreators();
  }, []);

  const submit = async () => {
    if (!adminSteamId) {
      setError('Login as owner required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/creators?adminSteamId=${encodeURIComponent(adminSteamId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to create creator (${res.status})`);
      setShowAdd(false);
      setForm({ displayName: '', slug: '', tagline: '', avatarUrl: '', tiktokUsername: '', youtubeChannelId: '', twitchLogin: '' });
      await fetchCreators();
    } catch (e: any) {
      setError(e?.message || 'Failed to create creator');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500">Creators</p>
              <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">Featured Creators</h1>
              <p className="text-xs text-gray-500">Partner creators on SkinVaults.</p>
            </div>

            {canManage && (
              <button
                onClick={() => setShowAdd(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition text-[10px] font-black uppercase tracking-[0.35em] flex items-center gap-2"
              >
                <Plus size={14} /> Add creator
              </button>
            )}
          </div>

          {loading && (
            <div className="text-xs uppercase tracking-[0.4em] text-blue-500 font-black animate-pulse">Loading creators…</div>
          )}

          {error && (
            <div className="bg-[#11141d] border border-red-500/30 rounded-2xl p-4 text-xs text-red-300">{error}</div>
          )}

          {!loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {creators.map((c) => (
                <Link
                  key={c.slug}
                  href={`/creator/${encodeURIComponent(c.slug)}`}
                  className="group bg-[#11141d] border border-white/5 rounded-[1.5rem] p-5 hover:border-blue-500/30 transition shadow-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                      {c.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-black text-gray-500">SV</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-tight text-white/90 truncate">{c.displayName}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500 truncate">{c.tagline || 'Creator'}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {showAdd && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-xl bg-[#0f111a] border border-white/10 rounded-[2rem] shadow-2xl p-5 md:p-7">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500">Owner</p>
                    <h2 className="text-lg font-black uppercase tracking-tight">Add creator</h2>
                  </div>
                  <button onClick={() => setShowAdd(false)} className="p-2 text-gray-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                    {form.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.avatarUrl} alt="avatar preview" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-sm font-black text-gray-500">SV</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Preview</p>
                    <p className="text-xs font-black uppercase tracking-tight text-white/90 truncate">
                      {form.displayName || 'Creator name'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {form.tagline || 'Tagline'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Display name (e.g. Stins)"
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm"
                  />
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="Slug (optional, e.g. stins)"
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm"
                  />
                  <input
                    value={form.tiktokUsername}
                    onChange={(e) => setForm((f) => ({ ...f, tiktokUsername: e.target.value }))}
                    placeholder="TikTok @username"
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm"
                  />
                  <input
                    value={form.youtubeChannelId}
                    onChange={(e) => setForm((f) => ({ ...f, youtubeChannelId: e.target.value }))}
                    placeholder="YouTube channel id (UC...)"
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm"
                  />
                  <input
                    value={form.twitchLogin}
                    onChange={(e) => setForm((f) => ({ ...f, twitchLogin: e.target.value }))}
                    placeholder="Twitch username"
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm"
                  />
                  <input
                    value={form.avatarUrl}
                    onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
                    placeholder="Avatar URL (optional)"
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm"
                  />
                  <input
                    value={form.tagline}
                    onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                    placeholder="Tagline (optional)"
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm md:col-span-2"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 mt-5">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition text-[10px] font-black uppercase tracking-[0.35em]"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition text-[10px] font-black uppercase tracking-[0.35em]"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
