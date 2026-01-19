"use client";

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { copyToClipboard } from '@/app/utils/clipboard';

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
  connections?: { twitchConnected: boolean; tiktokConnected: boolean };
  links: { tiktok?: string; tiktokLive?: string; twitch?: string; twitchLive?: string; youtube?: string; youtubeLive?: string };
  items: FeedItem[];
  updatedAt: string;
  lastCheckedAt: string;
  sources: { tiktokStatusApi?: string };
};

export default function CreatorPageClient({ slug }: { slug: string }) {
  const [data, setData] = useState<CreatorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [obsBusy, setObsBusy] = useState(false);
  const [obsCopied, setObsCopied] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [adminSteamId, setAdminSteamId] = useState<string | null>(null);
  const [sessionSteamId, setSessionSteamId] = useState<string | null>(null);
  const [twitchPreviewFailed, setTwitchPreviewFailed] = useState(false);
  const [twitchPreviewUrl, setTwitchPreviewUrl] = useState<string | null>(null);
  const [lastCheckedText, setLastCheckedText] = useState<string | null>(null);
  const [pauseRealtimeUntil, setPauseRealtimeUntil] = useState(0);
  const [edit, setEdit] = useState({
    displayName: '',
    tagline: '',
    avatarUrl: '',
    tiktokUsername: '',
    youtubeChannelId: '',
    twitchLogin: '',
    partnerSteamId: '',
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

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch('/api/auth/steam/session', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) setSessionSteamId(json?.steamId || null);
      } catch {
        if (!cancelled) setSessionSteamId(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const canManage = useMemo(() => isOwner(adminSteamId), [adminSteamId]);
  const viewerSteamId = useMemo(() => sessionSteamId || adminSteamId, [sessionSteamId, adminSteamId]);

  const tiktokLive = data?.live?.tiktok ?? false;
  const tiktokHandle = data?.creator?.tiktokUsername
    ? String(data.creator.tiktokUsername).trim().replace(/^@/, '')
    : '';
  const tiktokConfigured = !!tiktokHandle;
  const tiktokProfileUrl =
    data?.links?.tiktok || (tiktokHandle ? `https://www.tiktok.com/@${tiktokHandle}` : undefined);
  const tiktokLiveUrl =
    data?.links?.tiktokLive || (tiktokHandle ? `https://www.tiktok.com/@${tiktokHandle}/live` : undefined);
  const canConnectTikTok = !!(
    data?.creator?.partnerSteamId &&
    (canManage || (viewerSteamId && String(data.creator.partnerSteamId) === String(viewerSteamId)))
  );
  const tiktokConnected = !!data?.connections?.tiktokConnected;
  const latestTikTokItem = data?.items?.find((i) => i.platform === 'tiktok');
  const latestTiktokUrl = latestTikTokItem?.url;

  const twitchLive = data?.live?.twitch ?? null;
  const twitchHandle = data?.creator?.twitchLogin ? String(data.creator.twitchLogin).trim().replace(/^@/, '') : '';
  const twitchProfileUrl = data?.links?.twitch || (twitchHandle ? `https://www.twitch.tv/${twitchHandle}` : undefined);
  const twitchLiveUrl = data?.links?.twitchLive || twitchProfileUrl;
  const canConnectTwitch = !!(
    data?.creator?.partnerSteamId &&
    (canManage || (viewerSteamId && String(data.creator.partnerSteamId) === String(viewerSteamId)))
  );
  const twitchConnected = !!data?.connections?.twitchConnected;
  const canUseObsOverlay = !!(
    data?.creator?.partnerSteamId &&
    (canManage || (viewerSteamId && String(data.creator.partnerSteamId) === String(viewerSteamId)))
  );
  const showTwitchPreviewImage = !!(twitchPreviewUrl && twitchLive === true && !twitchPreviewFailed);

  const ytConfigured = !!data?.creator?.youtubeChannelId;
  const ytLive = data?.live?.youtube ?? null;
  const ytChannelId = data?.creator?.youtubeChannelId ? String(data.creator.youtubeChannelId).trim() : '';
  const ytChannelUrl = data?.links?.youtube || (ytChannelId ? `https://www.youtube.com/channel/${ytChannelId}` : undefined);
  const ytLiveUrl = data?.links?.youtubeLive || (ytChannelId ? `https://www.youtube.com/channel/${ytChannelId}/live` : undefined);
  const latestYouTubeItem = data?.items?.find((i) => i.platform === 'youtube');
  const latestYouTubeUrl = latestYouTubeItem?.url;
  const twitchConfigured = !!data?.creator?.twitchLogin;

  useEffect(() => {
    if (!twitchHandle) {
      setTwitchPreviewUrl(null);
      return;
    }
    setTwitchPreviewFailed(false);
    // Cache-bust once per minute so it updates when live.
    const t = Math.floor(Date.now() / 60000);
    setTwitchPreviewUrl(
      `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(twitchHandle)}-640x360.jpg?t=${t}`
    );
  }, [twitchHandle]);

  useEffect(() => {
    if (!data?.lastCheckedAt) {
      setLastCheckedText(null);
      return;
    }
    try {
      setLastCheckedText(new Date(data.lastCheckedAt).toLocaleString());
    } catch {
      setLastCheckedText(null);
    }
  }, [data?.lastCheckedAt]);

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

  const handleCopyObsOverlay = async () => {
    if (!canUseObsOverlay) return;
    setObsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/obs/token?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const link = json?.url ? String(json.url) : '';
      if (!res.ok || !link) {
        const msg = json?.error ? String(json.error) : 'Failed to generate overlay link';
        setError(msg);
        throw new Error(msg);
      }

      const ok = await copyToClipboard(link);
      if (ok) {
        setObsCopied(true);
        setTimeout(() => setObsCopied(false), 1500);
      } else {
        setError('Copy manually from the popup.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate overlay link');
      setObsCopied(false);
    } finally {
      setObsBusy(false);
    }
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
        const cleanYt = String(edit.youtubeChannelId || '').trim();
        return {
          ...prev,
          creator: nextCreator,
          links: {
            ...prev.links,
            tiktok: cleanTikTok ? `https://www.tiktok.com/@${cleanTikTok}` : prev.links.tiktok,
            tiktokLive: cleanTikTok ? `https://www.tiktok.com/@${cleanTikTok}/live` : prev.links.tiktokLive,
            twitch: cleanTwitch ? `https://www.twitch.tv/${cleanTwitch}` : prev.links.twitch,
            twitchLive: cleanTwitch ? `https://www.twitch.tv/${cleanTwitch}` : prev.links.twitchLive,
            youtube: cleanYt ? `https://www.youtube.com/channel/${cleanYt}` : prev.links.youtube,
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
        const res = await fetch(`/api/creator/${encodeURIComponent(slug)}`);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const tiktok = String(params.get('tiktok') || '').trim();
    const twitch = String(params.get('twitch') || '').trim();
    const hasAction =
      tiktok === 'connected' ||
      tiktok === 'disconnected' ||
      twitch === 'connected' ||
      twitch === 'disconnected';

    if (!hasAction) return;

    const run = async () => {
      try {
        setBusy(true);
        setPauseRealtimeUntil(Date.now() + 20000);
        const res = await fetch(`/api/creator/${encodeURIComponent(slug)}?refresh=1`, { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled && res.ok) setData(json);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setBusy(false);
        try {
          params.delete('tiktok');
          params.delete('twitch');
          const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
          window.history.replaceState({}, '', next);
        } catch {
          // ignore
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!tiktokConfigured) return;
    if (Date.now() < pauseRealtimeUntil) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/creator/${encodeURIComponent(slug)}?realtime=1`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (stopped) return;
        setData(json);
      } catch {
        // ignore
      }
    };

    const id = setInterval(() => {
      void tick();
    }, 10000);
    void tick();
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [slug, tiktokConfigured, pauseRealtimeUntil]);

  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6 pb-24">
          <div className="rounded-3xl bg-white/5 border border-white/10 p-5 md:p-7">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
              {data?.creator?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getSafeAvatarUrl(data.creator.avatarUrl)} alt={data.creator.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="text-sm md:text-base font-black text-gray-300 uppercase">
                  {(data?.creator?.displayName || slug).slice(0, 2)}
                </div>
              )}
            </div>
              <div className="min-w-0 flex-1 w-full">
                <h1 className="text-2xl md:text-5xl font-black italic uppercase tracking-tighter leading-none break-words">{data?.creator?.displayName || slug}</h1>
                <div className="mt-2 text-sm text-gray-400">
                  {data?.creator?.tagline || 'Featured Creator'}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {tiktokConfigured && (
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
                </div>
                {lastCheckedText && (
                  <div className="mt-3 text-xs text-gray-500">Last checked: {lastCheckedText}</div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:ml-auto justify-start lg:justify-end">
                {data?.creator?.partnerSteamId && (
                  <a
                    href={`/inventory?steamId=${encodeURIComponent(String(data.creator.partnerSteamId))}`}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                  >
                    Inventory
                  </a>
                )}
                {canUseObsOverlay && (
                  <button
                    onClick={handleCopyObsOverlay}
                    disabled={obsBusy}
                    className="px-3 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-100 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600/30 disabled:opacity-50"
                  >
                    {obsBusy ? 'Generating...' : (obsCopied ? 'Copied!' : 'OBS Overlay')}
                  </button>
                )}
                {canConnectTikTok && (
                  tiktokConnected ? (
                    <a
                      href={`/api/auth/tiktok/disconnect?slug=${encodeURIComponent(slug)}`}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                    >
                      Disconnect TikTok
                    </a>
                  ) : (
                    <a
                      href={`/api/auth/tiktok?slug=${encodeURIComponent(slug)}`}
                      className="px-3 py-2 rounded-xl bg-pink-600/20 border border-pink-500/40 text-pink-200 text-[10px] font-black uppercase tracking-widest hover:bg-pink-600/30"
                    >
                      Connect TikTok
                    </a>
                  )
                )}
                {canConnectTwitch && (
                  twitchConnected ? (
                    <a
                      href={`/api/auth/twitch/disconnect?slug=${encodeURIComponent(slug)}`}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                    >
                      Disconnect Twitch
                    </a>
                  ) : (
                    <a
                      href={`/api/auth/twitch?slug=${encodeURIComponent(slug)}`}
                      className="px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-200 text-[10px] font-black uppercase tracking-widest hover:bg-purple-600/30"
                    >
                      Connect Twitch
                    </a>
                  )
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
                          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            <div className="w-full h-36 bg-gradient-to-br from-[#1a1c27] via-[#10121a] to-[#0b0c11] flex items-center justify-center" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            <div className="absolute bottom-2 left-2 right-2">
                              <div className="text-xs font-black text-white line-clamp-2">{latestTikTokItem?.title || 'Latest TikTok'}</div>
                              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-300">Open video</div>
                            </div>
                          </div>
                        )}
                      </a>
                    ) : (
                      <div className="mt-2 text-sm text-gray-400">No latest video found yet.</div>
                    )}
                  </div>
                </div>

                {ytConfigured && (
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-black uppercase tracking-widest text-gray-400">YouTube</div>
                      {ytLive !== null && (
                        <div className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${ytLive ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                          {ytLive ? 'Live' : 'Offline'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {ytChannelUrl && (
                        <a href={ytChannelUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10">
                          Channel
                        </a>
                      )}
                      {ytLiveUrl && (
                        <a href={ytLiveUrl} target="_blank" rel="noreferrer" className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${ytLive ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                          Watch Live
                        </a>
                      )}
                    </div>

                    <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Latest video</div>
                      {latestYouTubeUrl ? (
                        <a href={latestYouTubeUrl} target="_blank" rel="noreferrer" className="mt-3 block group">
                          {latestYouTubeItem?.thumbnailUrl ? (
                            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={latestYouTubeItem.thumbnailUrl} alt={latestYouTubeItem.title} className="w-full h-36 object-cover group-hover:scale-[1.02] transition-transform" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                              <div className="absolute bottom-2 left-2 right-2">
                                <div className="text-xs font-black text-white line-clamp-2">{latestYouTubeItem.title || 'Latest YouTube'}</div>
                                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-300">Open video</div>
                              </div>
                            </div>
                          ) : (
                            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
                              <div className="w-full h-36 bg-gradient-to-br from-[#1a1c27] via-[#10121a] to-[#0b0c11] flex items-center justify-center" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                              <div className="absolute bottom-2 left-2 right-2">
                                <div className="text-xs font-black text-white line-clamp-2">{latestYouTubeItem?.title || 'Latest YouTube'}</div>
                                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-300">Open video</div>
                              </div>
                            </div>
                          )}
                        </a>
                      ) : (
                        <div className="mt-2 text-sm text-gray-400">No latest video found yet.</div>
                      )}
                    </div>
                  </div>
                )}

                {twitchConfigured && (
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
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
                    {twitchPreviewUrl && twitchLiveUrl && (
                      <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stream preview</div>
                        <a href={twitchLiveUrl} target="_blank" rel="noreferrer" className="mt-3 block group">
                          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            {showTwitchPreviewImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={twitchPreviewUrl}
                                alt="Twitch Stream Preview"
                                className="w-full h-36 object-cover group-hover:scale-[1.02] transition-transform"
                                onError={() => setTwitchPreviewFailed(true)}
                              />
                            ) : (
                              <div className="w-full h-36 bg-gradient-to-br from-[#1a1c27] via-[#10121a] to-[#0b0c11] flex items-center justify-center">
                                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
                                  <path d="M4 3h16v12.5l-4 4H9l-2.5 2.5H5v-2.5H4V3Z" stroke="white" strokeWidth="1.5" />
                                  <path d="M9 8v5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                                  <path d="M15 8v5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            <div className="absolute bottom-2 left-2 right-2">
                              <div className="text-xs font-black text-white line-clamp-2">{twitchLive ? 'Live on Twitch' : 'Twitch (Offline)'}</div>
                              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-300">Open stream</div>
                            </div>
                          </div>
                        </a>
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
                      <img src={getSafeAvatarUrl(edit.avatarUrl)} alt={edit.displayName || 'Avatar'} className="w-full h-full object-cover" />
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
