"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { ArrowLeft, Twitter, Loader2, Calendar, TrendingUp, BarChart3, Zap } from 'lucide-react';
import { isOwner } from '@/app/utils/owner-ids';

export default function XPostAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [userIsOwner, setUserIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        if (typeof window === 'undefined') return;
        
        const stored = window.localStorage.getItem('steam_user');
        const parsedUser = stored ? JSON.parse(stored) : null;
        setUser(parsedUser);
        
        if (parsedUser?.steamId) {
          const owner = isOwner(parsedUser.steamId);
          setUserIsOwner(owner);
        }
        
        setUserLoaded(true);
      } catch {
        setUserLoaded(true);
      }
    };

    checkUser();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/x-post/manual', {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        setError('Failed to load statistics');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const triggerPost = async (postType: 'weekly' | 'monthly' | 'live') => {
    if (!confirm(`Are you sure you want to post a ${postType} post now?`)) {
      return;
    }

    setPosting(postType);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/x-post/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ postType }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`Successfully posted ${postType} post! ${data.postId ? `Post ID: ${data.postId}` : ''} ${data.itemName ? `Item: ${data.itemName}` : ''}`);
        // Reload stats
        await loadStats();
      } else {
        setError(data.error || `Failed to post ${postType} post`);
      }
    } catch (error: any) {
      console.error(`Error posting ${postType}:`, error);
      setError(`Failed to post ${postType} post: ${error.message}`);
    } finally {
      setPosting(null);
    }
  };

  if (!userLoaded) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      </div>
    );
  }

  if (!userIsOwner) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-12 custom-scrollbar">
          <div className="w-full max-w-7xl mx-auto">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Admin
            </Link>

            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/40">
                  <Twitter className="text-blue-400" size={20} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                    Social Media
                  </p>
                  <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                    X Post Manager
                  </h1>
                </div>
              </div>
            </div>

            {/* Statistics */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-blue-400" size={24} />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                {/* Weekly Stats */}
                <div className="bg-[#11141d] p-6 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="text-blue-400" size={20} />
                    <h2 className="text-lg font-black uppercase tracking-tighter">Weekly Summary</h2>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Start:</span>
                      <span className="font-bold">{stats.weekly.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tot Nu:</span>
                      <span className="font-bold">{stats.weekly.endDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Posts:</span>
                      <span className="font-bold text-blue-400">{stats.weekly.postCount}</span>
                    </div>
                    {Object.keys(stats.weekly.typeCounts).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-gray-500 mb-2">Per Type:</p>
                        {Object.entries(stats.weekly.typeCounts).map(([type, count]) => (
                          <div key={type} className="flex justify-between text-xs">
                            <span className="text-gray-400">{type}:</span>
                            <span className="font-bold">{count}x</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Monthly Stats */}
                <div className="bg-[#11141d] p-6 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="text-purple-400" size={20} />
                    <h2 className="text-lg font-black uppercase tracking-tighter">Monthly Stats</h2>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Begint Met:</span>
                      <span className="font-bold">{stats.monthly.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tot Nu:</span>
                      <span className="font-bold">{stats.monthly.endDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max (Nieuwe Count):</span>
                      <span className="font-bold text-purple-400">{stats.monthly.maxDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Posts:</span>
                      <span className="font-bold text-purple-400">{stats.monthly.postCount}</span>
                    </div>
                    {Object.keys(stats.monthly.typeCounts).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-gray-500 mb-2">Per Type:</p>
                        {Object.entries(stats.monthly.typeCounts).map(([type, count]) => (
                          <div key={type} className="flex justify-between text-xs">
                            <span className="text-gray-400">{type}:</span>
                            <span className="font-bold">{count}x</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Messages */}
            {message && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/40 rounded-xl text-green-400 text-sm">
                {message}
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Post Triggers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {/* Weekly Post */}
              <button
                onClick={() => triggerPost('weekly')}
                disabled={posting !== null}
                className="bg-blue-600/20 border border-blue-500/40 p-6 rounded-2xl hover:bg-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-4"
              >
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <Calendar className="text-blue-400" size={24} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-black uppercase tracking-tighter mb-2">Weekly Post</h3>
                  <p className="text-xs text-gray-400">Post weekly summary with top movers</p>
                </div>
                {posting === 'weekly' && (
                  <Loader2 className="animate-spin text-blue-400" size={20} />
                )}
              </button>

              {/* Monthly Post */}
              <button
                onClick={() => triggerPost('monthly')}
                disabled={posting !== null}
                className="bg-purple-600/20 border border-purple-500/40 p-6 rounded-2xl hover:bg-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-4"
              >
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <BarChart3 className="text-purple-400" size={24} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-black uppercase tracking-tighter mb-2">Monthly Post</h3>
                  <p className="text-xs text-gray-400">Post monthly statistics</p>
                </div>
                {posting === 'monthly' && (
                  <Loader2 className="animate-spin text-purple-400" size={20} />
                )}
              </button>

              {/* Live Post */}
              <button
                onClick={() => triggerPost('live')}
                disabled={posting !== null}
                className="bg-green-600/20 border border-green-500/40 p-6 rounded-2xl hover:bg-green-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-4"
              >
                <div className="p-3 rounded-xl bg-green-500/20">
                  <Zap className="text-green-400" size={24} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-black uppercase tracking-tighter mb-2">Live Post</h3>
                  <p className="text-xs text-gray-400">Post item highlight now</p>
                </div>
                {posting === 'live' && (
                  <Loader2 className="animate-spin text-green-400" size={20} />
                )}
              </button>
            </div>

            {/* Current Date Info */}
            {stats && (
              <div className="mt-8 p-4 bg-[#11141d] rounded-xl border border-white/10">
                <p className="text-xs text-gray-400 text-center">
                  Huidige Datum: <span className="font-bold text-white">{stats.currentDate}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

