"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Loader2, ArrowLeft, Ban, Clock, Crown, Search, User, Shield } from 'lucide-react';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';

interface UserInfo {
  steamId: string;
  steamName: string;
  avatar: string;
  isBanned: boolean;
  isTimedOut: boolean;
  timeoutUntil: string | null;
  isPro: boolean;
  proUntil: string | null;
  messageCount: number;
  totalMessageCount: number;
}

export default function UserManagementPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('lifetime');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeoutDuration, setTimeoutDuration] = useState('5min');
  const [timeouting, setTimeouting] = useState(false);
  const [banning, setBanning] = useState(false);
  const toast = useToast();

  const steamId = params?.steamId as string;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);
    } catch {
      setUser(null);
    }
  }, []);

  const userIsOwner = isOwner(user?.steamId);

  useEffect(() => {
    if (!userIsOwner || !steamId) {
      router.push('/admin');
      return;
    }

    const loadUserInfo = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/user/${steamId}?adminSteamId=${user?.steamId}&time=${timeFilter}&search=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setUserInfo(data.user);
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Failed to load user info:', error);
        toast.error('Failed to load user information');
      } finally {
        setLoading(false);
      }
    };

    loadUserInfo();
  }, [steamId, userIsOwner, user?.steamId, timeFilter, searchQuery, router, toast]);

  const handleTimeout = async () => {
    if (!steamId || !userIsOwner) return;

    setTimeouting(true);
    try {
      const res = await fetch('/api/chat/timeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamId,
          duration: timeoutDuration,
          adminSteamId: user?.steamId,
        }),
      });

      if (res.ok) {
        toast.success(`User timed out for ${timeoutDuration}`);
        // Reload user info
        const reloadRes = await fetch(`/api/admin/user/${steamId}?adminSteamId=${user?.steamId}`);
        if (reloadRes.ok) {
          const data = await reloadRes.json();
          setUserInfo(data.user);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to timeout user');
      }
    } catch (error) {
      console.error('Failed to timeout user:', error);
      toast.error('Failed to timeout user');
    } finally {
      setTimeouting(false);
    }
  };

  const handleBan = async () => {
    if (!steamId || !userIsOwner) return;

    setBanning(true);
    try {
      const res = await fetch(`/api/admin/ban?steamId=${steamId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });

      if (res.ok) {
        toast.success('User has been banned');
        // Reload user info
        const reloadRes = await fetch(`/api/admin/user/${steamId}?adminSteamId=${user?.steamId}`);
        if (reloadRes.ok) {
          const data = await reloadRes.json();
          setUserInfo(data.user);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to ban user');
      }
    } catch (error) {
      console.error('Failed to ban user:', error);
      toast.error('Failed to ban user');
    } finally {
      setBanning(false);
    }
  };

  const handleRemoveTimeout = async () => {
    if (!steamId || !userIsOwner) return;

    try {
      const res = await fetch(`/api/chat/timeout?steamId=${steamId}&adminSteamId=${user?.steamId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Timeout removed');
        // Reload user info
        const reloadRes = await fetch(`/api/admin/user/${steamId}?adminSteamId=${user?.steamId}`);
        if (reloadRes.ok) {
          const data = await reloadRes.json();
          setUserInfo(data.user);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove timeout');
      }
    } catch (error) {
      console.error('Failed to remove timeout:', error);
      toast.error('Failed to remove timeout');
    }
  };

  if (!userIsOwner) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-xl font-bold">Unauthorized</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Back to Admin Panel
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : userInfo ? (
            <>
              {/* User Profile Summary */}
              <div className="bg-[#11141d] p-6 rounded-2xl border border-white/10">
                <div className="flex items-start gap-6">
                  <img
                    src={userInfo.avatar || '/icons/web-app-manifest-192x192.png'}
                    alt={userInfo.steamName}
                    className="w-20 h-20 rounded-xl border-2 border-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-2xl font-black">{userInfo.steamName}</h1>
                      {userInfo.isPro && (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-xs font-black uppercase text-emerald-400 flex items-center gap-1">
                          <Crown size={12} />
                          Pro
                        </span>
                      )}
                      {userInfo.isBanned && (
                        <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/40 text-xs font-black uppercase text-red-400 flex items-center gap-1">
                          <Ban size={12} />
                          Banned
                        </span>
                      )}
                      {userInfo.isTimedOut && (
                        <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/40 text-xs font-black uppercase text-amber-400 flex items-center gap-1">
                          <Clock size={12} />
                          Timeout
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Steam ID: {userInfo.steamId}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Messages</p>
                        <p className="text-lg font-bold">{userInfo.totalMessageCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Filtered Messages</p>
                        <p className="text-lg font-bold">{userInfo.messageCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Pro Status</p>
                        <p className="text-lg font-bold">{userInfo.isPro ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Account Status</p>
                        <p className="text-lg font-bold">
                          {userInfo.isBanned ? 'Banned' : userInfo.isTimedOut ? 'Timed Out' : 'Active'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {!userInfo.isBanned ? (
                        <button
                          onClick={handleBan}
                          disabled={banning}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {banning ? <Loader2 className="animate-spin" size={16} /> : <Ban size={16} />}
                          Ban User
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/admin/ban?steamId=${steamId}`, {
                                method: 'DELETE',
                                headers: {
                                  'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
                                },
                              });
                              if (res.ok) {
                                toast.success('User unbanned');
                                const reloadRes = await fetch(`/api/admin/user/${steamId}?adminSteamId=${user?.steamId}`);
                                if (reloadRes.ok) {
                                  const data = await reloadRes.json();
                                  setUserInfo(data.user);
                                }
                              }
                            } catch (error) {
                              toast.error('Failed to unban user');
                            }
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-sm transition-colors"
                        >
                          Unban User
                        </button>
                      )}
                      {!userInfo.isTimedOut ? (
                        <div className="flex gap-2">
                          <select
                            value={timeoutDuration}
                            onChange={(e) => setTimeoutDuration(e.target.value)}
                            className="bg-[#08090d] border border-white/10 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="1min">1 Minute</option>
                            <option value="5min">5 Minutes</option>
                            <option value="30min">30 Minutes</option>
                            <option value="60min">60 Minutes</option>
                            <option value="1day">1 Day</option>
                          </select>
                          <button
                            onClick={handleTimeout}
                            disabled={timeouting}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {timeouting ? <Loader2 className="animate-spin" size={16} /> : <Clock size={16} />}
                            Timeout
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleRemoveTimeout}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-sm transition-colors"
                        >
                          Remove Timeout
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/inventory?steamId=${steamId}`)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                      >
                        <User size={16} />
                        View Inventory
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-[#11141d] p-4 rounded-xl border border-white/10 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages..."
                    className="w-full bg-[#08090d] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="bg-[#08090d] border border-white/10 rounded-lg px-4 py-2 text-white"
                >
                  <option value="30min">Last 30 Minutes</option>
                  <option value="1hour">Last Hour</option>
                  <option value="24hours">Last 24 Hours</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>

              {/* Messages */}
              <div className="bg-[#11141d] p-6 rounded-2xl border border-white/10">
                <h2 className="text-xl font-bold mb-4">Chat Messages ({messages.length})</h2>
                {messages.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No messages found</p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {messages.map((msg) => (
                      <div key={msg.id} className="bg-[#08090d] p-4 rounded-lg border border-white/5">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-400">User not found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

