"use client";

import { useEffect, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Link from 'next/link';
import { isOwner } from '@/app/utils/owner-ids';

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adminSteamId, setAdminSteamId] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: '',
    displayName: '',
    tagline: '',
    avatarUrl: '',
    tiktokUsername: '',
    youtubeChannelId: '',
    twitchLogin: '',
  });

  const getSafeAvatarUrl = (raw?: string) => {
    const v = String(raw || '').trim();
    if (!v) return '';
    try {
      const u = new URL(v);
      const host = u.hostname.toLowerCase();
      const isTikTok = host.includes('tiktokcdn') || host.startsWith('p16-');
      if (isTikTok) return `/api/image-proxy?url=${encodeURIComponent(v)}`;
      return v;
    } catch {
      return v;
    }
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('steam_user');
      if (!raw) {
        setAdminSteamId(null);
        return;
      }
      const user = JSON.parse(raw);
      setAdminSteamId(user?.steamId || null);
    } catch {
      setAdminSteamId(null);
    }
  }, []);

  const canManage = isOwner(adminSteamId);

  const fetchCreators = async () => {
    setError(null);
    try {
      const res = await fetch('/api/creators', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setCreators(Array.isArray(data?.creators) ? data.creators : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setCreators([]);
    }
  };

  useEffect(() => {
    fetchCreators();
  }, []);

  const handleCreate = async () => {
    if (!canManage || !adminSteamId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/creators?adminSteamId=${encodeURIComponent(adminSteamId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: form.slug,
            displayName: form.displayName,
            tagline: form.tagline,
            avatarUrl: form.avatarUrl,
            tiktokUsername: form.tiktokUsername,
            youtubeChannelId: form.youtubeChannelId,
            twitchLogin: form.twitchLogin,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create');

      setShowAdd(false);
      setForm({
        slug: '',
        displayName: '',
        tagline: '',
        avatarUrl: '',
        tiktokUsername: '',
        youtubeChannelId: '',
        twitchLogin: '',
      });
      await fetchCreators();
    } catch (e: any) {
      setError(e?.message || 'Failed to create');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!canManage || !adminSteamId) return;
    const ok = window.confirm(`Delete creator "${slug}"?`);
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/creators?adminSteamId=${encodeURIComponent(adminSteamId)}&slug=${encodeURIComponent(slug)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to delete');
      await fetchCreators();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">Creators</h1>
          {error && <div className="text-sm text-red-300">{error}</div>}

          {canManage && (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-400">Owner tools</div>
              <button
                onClick={() => setShowAdd(true)}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                Add Creator
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {creators.map((c) => (
              <Link key={c.slug} href={`/creator/${encodeURIComponent(c.slug)}`} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getSafeAvatarUrl(c.avatarUrl)} alt={c.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-xs font-black text-gray-300 uppercase">{c.displayName.slice(0, 2)}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400 truncate">{c.slug}</div>
                  <div className="text-lg font-black truncate">{c.displayName}</div>
                  {c.tagline && <div className="text-xs text-gray-400 truncate">{c.tagline}</div>}
                </div>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleDelete(c.slug);
                    }}
                    disabled={busy}
                    className="ml-auto px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/30 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </Link>
            ))}
          </div>

          {showAdd && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setShowAdd(false)}>
              <div className="w-full max-w-lg rounded-3xl bg-[#0f111a] border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-lg font-black uppercase tracking-widest">Add Creator</div>
                    <div className="text-xs text-gray-400">Stored in DB and refreshed by cron.</div>
                  </div>
                  <button className="text-gray-400 hover:text-white" disabled={busy} onClick={() => setShowAdd(false)}>
                    Close
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                    {form.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getSafeAvatarUrl(form.avatarUrl)} alt={form.displayName || 'Avatar'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-sm font-black text-gray-300 uppercase">{(form.displayName || '??').slice(0, 2)}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 break-all">{form.avatarUrl || 'Avatar preview (paste URL)'}</div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Display name (required)" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Slug (optional, auto from name)" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Tagline" value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Avatar URL" value={form.avatarUrl} onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="TikTok username" value={form.tiktokUsername} onChange={(e) => setForm((f) => ({ ...f, tiktokUsername: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="YouTube channel ID" value={form.youtubeChannelId} onChange={(e) => setForm((f) => ({ ...f, youtubeChannelId: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Twitch login" value={form.twitchLogin} onChange={(e) => setForm((f) => ({ ...f, twitchLogin: e.target.value }))} />
                </div>

                <div className="flex items-center justify-end gap-3 mt-5">
                  <button
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    onClick={() => setShowAdd(false)}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={busy || !form.displayName.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    onClick={() => void handleCreate()}
                  >
                    {busy ? 'Saving...' : 'Save'}
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
