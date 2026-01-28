"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { AlertTriangle, ArrowLeft, Loader2, Shield, Twitter } from 'lucide-react';

export default function AdminXPostingPage() {
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [xPostingEnabled, setXPostingEnabled] = useState(false);
  const [loadingXPosting, setLoadingXPosting] = useState(true);
  const [xPostingMessage, setXPostingMessage] = useState<string | null>(null);
  const [xPostingError, setXPostingError] = useState<string | null>(null);
  const [xPostingLastPost, setXPostingLastPost] = useState<string | null>(null);
  const [xPostingStatus, setXPostingStatus] = useState<any>(null);
  const [triggeringPost, setTriggeringPost] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadXPosting = async () => {
    if (!userIsOwner) return;
    setLoadingXPosting(true);
    try {
      const res = await fetch('/api/admin/x-posting');
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setXPostingEnabled((data as any)?.enabled || false);
        setXPostingLastPost((data as any)?.lastPost || null);
      }
    } catch (e: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load X posting status:', e);
      }
    } finally {
      setLoadingXPosting(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadXPosting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const handleXPostingToggle = async (enabled: boolean) => {
    setXPostingError(null);
    setXPostingMessage(null);

    try {
      const res = await fetch('/api/admin/x-posting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setXPostingError(String((data as any)?.error || `Failed to ${enabled ? 'enable' : 'disable'} X posting.`));
      } else {
        setXPostingEnabled((data as any)?.enabled || false);
        setXPostingLastPost((data as any)?.lastPost || null);
        if (enabled) {
          if ((data as any)?.testPostSuccess) {
            setXPostingMessage(String((data as any)?.message || 'X posting enabled and test post created successfully!'));
          } else if ((data as any)?.testPostError) {
            setXPostingError(`Test post failed: ${String((data as any)?.testPostError || '')}`);
            setXPostingMessage('X posting enabled, but test post failed. Check your X API credentials.');
          } else {
            setXPostingMessage(String((data as any)?.message || 'X posting enabled!'));
          }
        } else {
          setXPostingMessage('X posting disabled.');
        }
        setTimeout(() => setXPostingMessage(null), 10000);
      }
    } catch (e: any) {
      setXPostingError(String(e?.message || 'Request failed.'));
    }
  };

  const handleManualTrigger = async () => {
    if (!confirm('Are you sure you want to manually trigger a post now? This will create a post immediately.')) {
      return;
    }

    setTriggeringPost(true);
    setXPostingError(null);
    setXPostingMessage(null);

    try {
      const res = await fetch('/api/x/post/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setXPostingError(String((data as any)?.error || 'Failed to trigger post.'));
      } else {
        setXPostingMessage(`Post created successfully! ${(data as any)?.postUrl ? `View: ${(data as any).postUrl}` : ''}`);
        setXPostingLastPost(new Date().toISOString());
        const statusRes = await fetch('/api/x/post/trigger');
        const statusData = await statusRes.json().catch(() => null);
        if (statusRes.ok) {
          setXPostingStatus(statusData);
        }
        setTimeout(() => setXPostingMessage(null), 10000);
      }
    } catch (e: any) {
      setXPostingError(String(e?.message || 'Request failed.'));
    } finally {
      setTriggeringPost(false);
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
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">X Posting</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Toggle scheduled X posting and manually trigger a post.</p>
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
                <Twitter className="text-blue-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Social Media</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">X (Twitter) Posting</h2>
              </div>
            </div>

            {loadingXPosting ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="space-y-4">
                {xPostingMessage ? (
                  <div className="bg-blue-500/10 border border-blue-500/40 rounded-xl md:rounded-2xl p-3 text-[10px] md:text-[11px] text-blue-400">{xPostingMessage}</div>
                ) : null}
                {xPostingError ? (
                  <div className="bg-red-500/10 border border-red-500/40 rounded-xl md:rounded-2xl p-3 text-[10px] md:text-[11px] text-red-400">{xPostingError}</div>
                ) : null}

                <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">X Posting</span>
                    <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">
                      {xPostingEnabled
                        ? 'X posting is enabled. Posts will be created automatically.'
                        : 'X posting is disabled. Enable to start posting.'}
                    </p>
                    {xPostingLastPost ? (
                      <p className="text-[9px] md:text-[10px] text-gray-600 mt-1">Last post: {new Date(xPostingLastPost).toLocaleString()}</p>
                    ) : null}
                    {xPostingStatus ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-[9px] md:text-[10px] text-gray-500">Status: <span className="text-blue-400">{xPostingStatus.status}</span></p>
                        <p className="text-[9px] md:text-[10px] text-gray-500">
                          Today: {xPostingStatus.todayPosts || 0} posts | This month: {xPostingStatus.monthlyPosts || 0}/{xPostingStatus.monthlyLimit || 500}
                        </p>
                        <p className="text-[9px] md:text-[10px] text-gray-500">Next: {xPostingStatus.nextScheduledTime}</p>
                      </div>
                    ) : null}
                  </div>
                  <button
                    onClick={() => handleXPostingToggle(!xPostingEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${xPostingEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${xPostingEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                {xPostingEnabled ? (
                  <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">Manual Trigger</span>
                        <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">Manually trigger a post now (bypasses schedule)</p>
                      </div>
                      <button
                        onClick={handleManualTrigger}
                        disabled={triggeringPost}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white text-[10px] md:text-[11px] font-black uppercase rounded-lg transition-all"
                      >
                        {triggeringPost ? (
                          <>
                            <Loader2 size={12} className="inline animate-spin mr-1" />
                            Posting...
                          </>
                        ) : (
                          'Trigger Post Now'
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 text-[10px] md:text-[11px] text-gray-400">
                  <div className="flex items-center gap-2 text-gray-300 font-black uppercase tracking-widest text-[9px]">
                    <AlertTriangle size={14} className="text-blue-400" />
                    Note
                  </div>
                  <div className="mt-2">Manual post triggers and stats are available in the X Post Manager.</div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
