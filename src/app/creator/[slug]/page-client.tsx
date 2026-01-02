"use client";

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import Link from 'next/link';
import { ExternalLink, Video, Radio } from 'lucide-react';

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
  links?: {
    website?: string;
    discord?: string;
    x?: string;
  };
};

type CreatorResponse = {
  creator: CreatorProfile;
  live: { twitch: boolean | null; tiktok: boolean | null; youtube: boolean | null };
  items: FeedItem[];
  updatedAt: string;
  sources: { tiktok?: string; youtube?: string };
};

function platformLabel(p: FeedItem['platform']): string {
  if (p === 'tiktok') return 'TikTok';
  return 'YouTube';
}

export default function CreatorPageClient({ slug }: { slug: string }) {
  const [data, setData] = useState<CreatorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/creator/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Failed to load creator (${res.status})`);
        }
        const json = (await res.json()) as CreatorResponse;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load creator');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const creator = data?.creator;

  const tiktokUrl = useMemo(() => {
    if (!creator?.tiktokUsername) return null;
    return `https://www.tiktok.com/@${creator.tiktokUsername}`;
  }, [creator?.tiktokUsername]);

  const youtubeUrl = useMemo(() => {
    if (!creator?.youtubeChannelId) return null;
    return `https://www.youtube.com/channel/${creator.youtubeChannelId}`;
  }, [creator?.youtubeChannelId]);

  const twitchUrl = useMemo(() => {
    if (!creator?.twitchLogin) return null;
    return `https://www.twitch.tv/${creator.twitchLogin}`;
  }, [creator?.twitchLogin]);

  return (
    <div className="flex min-h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500">Featured Creator</p>
              <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                {creator?.displayName || slug}
              </h1>
              {creator?.tagline && (
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">{creator.tagline}</p>
              )}
            </div>
            <Link
              href="/creators"
              className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400 hover:text-white transition"
            >
              Back to creators
            </Link>
          </div>

          <div className="bg-[#11141d] border border-white/5 rounded-[2rem] p-4 md:p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                  {creator?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={creator.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black text-gray-500">SV</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-300">{creator?.displayName || slug}</span>
                    {data?.live?.twitch === true && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/40">
                        <Radio size={12} className="text-red-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Live</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : '---'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {tiktokUrl && (
                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 hover:border-blue-500/40 transition text-[10px] font-black uppercase tracking-[0.35em] flex items-center gap-2"
                  >
                    <ExternalLink size={14} className="text-blue-400" /> TikTok
                  </a>
                )}
                {youtubeUrl && (
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 hover:border-blue-500/40 transition text-[10px] font-black uppercase tracking-[0.35em] flex items-center gap-2"
                  >
                    <ExternalLink size={14} className="text-blue-400" /> YouTube
                  </a>
                )}
                {twitchUrl && (
                  <a
                    href={twitchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 hover:border-blue-500/40 transition text-[10px] font-black uppercase tracking-[0.35em] flex items-center gap-2"
                  >
                    <ExternalLink size={14} className="text-blue-400" /> Twitch
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.35em] text-gray-400 flex items-center gap-2">
              <Video size={16} className="text-blue-500" /> Latest content
            </h2>
          </div>

          {loading && (
            <div className="text-xs uppercase tracking-[0.4em] text-blue-500 font-black animate-pulse">Loading creator…</div>
          )}

          {error && (
            <div className="bg-[#11141d] border border-red-500/30 rounded-2xl p-4 text-xs text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.items || []).map((it) => (
                <a
                  key={it.id}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group bg-[#11141d] border border-white/5 rounded-[1.5rem] p-4 hover:border-blue-500/30 transition shadow-xl"
                >
                  <div className="aspect-video rounded-xl bg-black/40 border border-white/10 overflow-hidden">
                    {it.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.thumbnailUrl} alt="thumb" className="w-full h-full object-cover group-hover:scale-[1.03] transition" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] font-black uppercase tracking-[0.35em]">
                        No preview
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-[0.35em] text-blue-400">{platformLabel(it.platform)}</span>
                      {it.publishedAt && (
                        <span className="text-[10px] text-gray-500">
                          {new Date(it.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-black uppercase tracking-tight line-clamp-2 text-white/90">
                      {it.title}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}

          {(!loading && !error && (data?.items?.length || 0) === 0) && (
            <div className="bg-[#11141d] border border-white/5 rounded-2xl p-6 text-xs text-gray-400">
              No content found yet. Fill in the creator handles in `src/data/creators.ts`.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
