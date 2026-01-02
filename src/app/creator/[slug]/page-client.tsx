"use client";

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';

type FeedItem = {
  id: string;
  platform: 'tiktok' | 'youtube';
  title: string;
  url: string;
  thumbnailUrl?: string;
  publishedAt?: string;
};

type CreatorProfile = {
  slug: string;
  displayName: string;
  tagline?: string;
  avatarUrl?: string;
  tiktokUsername?: string;
  youtubeChannelId?: string;
  twitchLogin?: string;
  partnerSteamId?: string;
};

type CreatorSnapshot = {
  creator: CreatorProfile;
  live: { twitch: boolean | null; tiktok: boolean | null; youtube: boolean | null };
  links: { tiktok?: string; tiktokLive?: string; twitch?: string; twitchLive?: string };
  items: FeedItem[];
  updatedAt: string;
  lastCheckedAt: string;
  sources: { tiktokStatusApi?: string };
};

export default function CreatorPageClient({ slug }: { slug: string }) {
  const [data, setData] = useState<CreatorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [adminSteamId, setAdminSteamId] = useState<string | null>(null);
  const [embedParent, setEmbedParent] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    displayName: '',
    tagline: '',
    avatarUrl: '',
    tiktokUsername: '',
    youtubeChannelId: '',
    twitchLogin: '',
    partnerSteamId: '',
  });

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

  useEffect(() => {
    try {
      setEmbedParent(window.location.hostname);
    } catch {
      setEmbedParent(null);
    }
  }, []);

  const canManage = useMemo(() => isOwner(adminSteamId), [adminSteamId]);

  const tiktokLive = data?.live?.tiktok ?? null;
  const tiktokHandle = data?.creator?.tiktokUsername
    ? String(data.creator.tiktokUsername).trim().replace(/^@/, '')
    : '';
  const tiktokProfileUrl =
    data?.links?.tiktok || (tiktokHandle ? `https://www.tiktok.com/@${tiktokHandle}` : undefined);
  const tiktokLiveUrl =
    data?.links?.tiktokLive || (tiktokHandle ? `https://www.tiktok.com/@${tiktokHandle}/live` : undefined);
  const latestTikTokItem = data?.items?.find((i) => i.platform === 'tiktok');
  const latestTiktokUrl = latestTikTokItem?.url;

  const twitchLive = data?.live?.twitch ?? null;
  const twitchHandle = data?.creator?.twitchLogin ? String(data.creator.twitchLogin).trim().replace(/^@/, '') : '';
  const twitchProfileUrl = data?.links?.twitch || (twitchHandle ? `https://www.twitch.tv/${twitchHandle}` : undefined);
  const twitchLiveUrl = data?.links?.twitchLive || twitchProfileUrl;
  const twitchEmbedUrl = useMemo(() => {
    if (!twitchHandle || !embedParent) return null;
    const parent = encodeURIComponent(embedParent);
    const channel = encodeURIComponent(twitchHandle);
    return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=true`;
  }, [embedParent, twitchHandle]);

  const ytConfigured = !!data?.creator?.youtubeChannelId;
  const twitchConfigured = !!data?.creator?.twitchLogin;

  const openEdit = () => {
    if (!data) return;
    setEdit({
      displayName: data.creator.displayName || '',
      tagline: data.creator.tagline || '',
      avatarUrl: data.creator.avatarUrl || '',
      tiktokUsername: data.creator.tiktokUsername || '',
      youtubeChannelId: data.creator.youtubeChannelId || '',
      twitchLogin: data.creator.twitchLogin || '',
      partnerSteamId: data.creator.partnerSteamId || '',
    });
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!adminSteamId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/creators?adminSteamId=${encodeURIComponent(adminSteamId)}&slug=${encodeURIComponent(slug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(edit),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update');

      // Optimistic UI update (instant)
      setData((prev) => {
        if (!prev) return prev;
        const nextCreator = {
          ...prev.creator,
          displayName: edit.displayName,
          tagline: edit.tagline || undefined,
          avatarUrl: edit.avatarUrl || undefined,
          tiktokUsername: edit.tiktokUsername || undefined,
          youtubeChannelId: edit.youtubeChannelId || undefined,
          twitchLogin: edit.twitchLogin || undefined,
          partnerSteamId: edit.partnerSteamId || undefined,
        };
        const cleanTikTok = String(edit.tiktokUsername || '').trim().replace(/^@/, '');
        const cleanTwitch = String(edit.twitchLogin || '').trim().replace(/^@/, '');
        return {
          ...prev,
          creator: nextCreator,
          links: {
            ...prev.links,
            tiktok: cleanTikTok ? `https://www.tiktok.com/@${cleanTikTok}` : prev.links.tiktok,
            tiktokLive: cleanTikTok ? `https://www.tiktok.com/@${cleanTikTok}/live` : prev.links.tiktokLive,
            twitch: cleanTwitch ? `https://www.twitch.tv/${cleanTwitch}` : prev.links.twitch,
            twitchLive: cleanTwitch ? `https://www.twitch.tv/${cleanTwitch}` : prev.links.twitchLive,
          },
        };
      });

      // Refresh snapshot in background (can be slow; don't block the modal)
      void fetch(`/api/creator/${encodeURIComponent(slug)}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j) setData(j);
        })
        .catch(() => {});

      setShowEdit(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setError(null);
      try {
        const res = await fetch(`/api/creator/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load');
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6 pb-24">
          <div className="rounded-3xl bg-white/5 border border-white/10 p-5 md:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
              {data?.creator?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.creator.avatarUrl} alt={data.creator.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="text-sm md:text-base font-black text-gray-300 uppercase">
                  {(data?.creator?.displayName || slug).slice(0, 2)}
                </div>
              )}
            </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">{data?.creator?.displayName || slug}</h1>
                <div className="mt-2 text-sm text-gray-400">
                  {data?.creator?.tagline || 'Featured Creator'}
                </div>
                {data?.lastCheckedAt && (
                  <div className="mt-3 text-xs text-gray-500">Last checked: {new Date(data.lastCheckedAt).toLocaleString()}</div>
                )}
              </div>

              <div className="flex items-center gap-2 sm:ml-auto">
                {tiktokLive !== null && (
                  <div
                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${tiktokLive
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-300'
                      }`}
                  >
                    TikTok {tiktokLive ? 'Live' : 'Offline'}
                  </div>
                )}
                {twitchConfigured && twitchLive !== null && (
                  <div
                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${twitchLive
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-300'
                      }`}
                  >
                    Twitch {twitchLive ? 'Live' : 'Offline'}
                  </div>
                )}
                {data?.creator?.partnerSteamId && (
                  <a
                    href={`/inventory?steamId=${encodeURIComponent(String(data.creator.partnerSteamId))}`}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                  >
                    Inventory
                  </a>
                )}
                {canManage && (
                  <button
                    onClick={openEdit}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
          {error && <div className="text-sm text-red-300">{error}</div>}
          {data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-black uppercase tracking-widest text-gray-400">TikTok</div>
                    {tiktokLive !== null && (
                      <div className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${tiktokLive ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                        {tiktokLive ? 'Live' : 'Offline'}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {tiktokProfileUrl && (
                      <a href={tiktokProfileUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10">
                        Profile
                      </a>
                    )}
                    {tiktokLiveUrl && (
                      <a href={tiktokLiveUrl} target="_blank" rel="noreferrer" className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${tiktokLive ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                        Watch Live
                      </a>
                    )}
                  </div>

                  <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Latest video</div>
                    {latestTiktokUrl ? (
                      <a href={latestTiktokUrl} target="_blank" rel="noreferrer" className="mt-3 block group">
                        {latestTikTokItem?.thumbnailUrl ? (
                          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={latestTikTokItem.thumbnailUrl} alt={latestTikTokItem.title} className="w-full h-36 object-cover group-hover:scale-[1.02] transition-transform" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            <div className="absolute bottom-2 left-2 right-2">
                              <div className="text-xs font-black text-white line-clamp-2">{latestTikTokItem.title || 'Latest TikTok'}</div>
                              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-300">Open video</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm font-black text-blue-400 break-all group-hover:text-blue-300">
                            {latestTiktokUrl}
                          </div>
                        )}
                      </a>
                    ) : (
                      <div className="mt-2 text-sm text-gray-400">No latest video found yet.</div>
                    )}
                  </div>
                </div>

                {ytConfigured && (
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
                    <div className="text-xs font-black uppercase tracking-widest text-gray-400">YouTube</div>
                    <div className="text-sm text-gray-400">Configured (feed support coming next)</div>
                  </div>
                )}

                {twitchConfigured && (
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-black uppercase tracking-widest text-gray-400">Twitch</div>
                      {twitchLive !== null && (
                        <div className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${twitchLive ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                          {twitchLive ? 'Live' : 'Offline'}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {twitchProfileUrl && (
                        <a href={twitchProfileUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10">
                          Channel
                        </a>
                      )}
                      {twitchLiveUrl && (
                        <a href={twitchLiveUrl} target="_blank" rel="noreferrer" className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${twitchLive ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                          Watch Live
                        </a>
                      )}
                    </div>
                    {twitchEmbedUrl && (
                      <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stream preview</div>
                        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          <iframe
                            title="Twitch Stream Preview"
                            src={twitchEmbedUrl}
                            className="w-full h-36"
                            allow="autoplay; fullscreen"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {showEdit && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setShowEdit(false)}>
              <div className="w-full max-w-lg rounded-3xl bg-[#0f111a] border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-lg font-black uppercase tracking-widest">Edit Creator</div>
                    <div className="text-xs text-gray-400">Update platforms, avatar, and tagline.</div>
                  </div>
                  <button className="text-gray-400 hover:text-white" disabled={busy} onClick={() => setShowEdit(false)}>
                    Close
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                    {edit.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={edit.avatarUrl} alt={edit.displayName || 'Avatar'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-sm font-black text-gray-300 uppercase">{(edit.displayName || '??').slice(0, 2)}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 break-all">{edit.avatarUrl || 'Avatar preview (paste URL)'}</div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Display name" value={edit.displayName} onChange={(e) => setEdit((f) => ({ ...f, displayName: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Tagline" value={edit.tagline} onChange={(e) => setEdit((f) => ({ ...f, tagline: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Avatar URL" value={edit.avatarUrl} onChange={(e) => setEdit((f) => ({ ...f, avatarUrl: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="TikTok username" value={edit.tiktokUsername} onChange={(e) => setEdit((f) => ({ ...f, tiktokUsername: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="YouTube channel ID" value={edit.youtubeChannelId} onChange={(e) => setEdit((f) => ({ ...f, youtubeChannelId: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Twitch login" value={edit.twitchLogin} onChange={(e) => setEdit((f) => ({ ...f, twitchLogin: e.target.value }))} />
                  <input className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-sm" placeholder="Partner SteamID (17 digits)" value={edit.partnerSteamId} onChange={(e) => setEdit((f) => ({ ...f, partnerSteamId: e.target.value }))} />
                </div>

                <div className="flex items-center justify-end gap-3 mt-5">
                  <button
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    onClick={() => setShowEdit(false)}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={busy || !edit.displayName.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    onClick={() => void saveEdit()}
                  >
                    {busy ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
