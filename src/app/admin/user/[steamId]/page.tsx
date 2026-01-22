"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { Loader2, ArrowLeft, Ban, Clock, Crown, Search, User, Shield, Trash2, MessageSquare } from 'lucide-react';
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
  const [user, setUser] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [dmMessages, setDmMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'global' | 'dms'>('global');
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [selectedDMMessages, setSelectedDMMessages] = useState<any[]>([]);
  const [selectedDMOtherUserId, setSelectedDMOtherUserId] = useState<string | null>(null);
  const [dmConversations, setDmConversations] = useState<Array<{dmId: string; otherUserId: string; messageCount: number; lastMessage: any}>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDM, setLoadingDM] = useState(false);
  const [timeFilter, setTimeFilter] = useState('lifetime');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
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
    // Wait for user to load before checking ownership
    if (user === null) return; // Still loading
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
          setDmMessages(data.dmMessages || []);
        }
      } catch (error) {
        console.error('Failed to load user info:', error);
        toast.error('Failed to load user information');
      } finally {
        setLoading(false);
      }
    };

    loadUserInfo();
  }, [steamId, userIsOwner, user?.steamId, timeFilter, debouncedSearchQuery, router, toast]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Group DM messages by conversation
  useEffect(() => {
    if (dmMessages.length > 0) {
      const conversations = new Map<string, {dmId: string; otherUserId: string; messages: any[]}>();
      
      dmMessages.forEach(msg => {
        if (!conversations.has(msg.dmId)) {
          conversations.set(msg.dmId, {
            dmId: msg.dmId,
            otherUserId: msg.otherUserId,
            messages: []
          });
        }
        conversations.get(msg.dmId)!.messages.push(msg);
      });

      const conversationList = Array.from(conversations.values()).map(conv => ({
        dmId: conv.dmId,
        otherUserId: conv.otherUserId,
        messageCount: conv.messages.length,
        lastMessage: conv.messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
      }));

      setDmConversations(conversationList.sort((a, b) => 
        new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
      ));
    } else {
      setDmConversations([]);
    }
  }, [dmMessages]);

  // Load specific DM conversation
  const loadDMConversation = async (dmId: string, otherUserId: string) => {
    setLoadingDM(true);
    setSelectedDM(dmId);
    setSelectedDMOtherUserId(otherUserId);
    try {
      const [steamId1, steamId2] = dmId.split('_');
      const res = await fetch(`/api/chat/dms?steamId1=${steamId1}&steamId2=${steamId2}&currentUserId=${steamId}&adminSteamId=${user?.steamId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDMMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load DM conversation:', error);
      toast.error('Failed to load DM conversation');
    } finally {
      setLoadingDM(false);
    }
  };

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

  const handleDeleteMessage = async (messageId: string, messageType: 'global' | 'dm' = 'global', dmId?: string) => {
    if (!userIsOwner || !messageId) return;

    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const url = messageType === 'global'
        ? `/api/chat/messages/${messageId}?userSteamId=${user?.steamId}&type=global`
        : `/api/chat/messages/${messageId}?userSteamId=${user?.steamId}&type=dm&dmId=${dmId || ''}`;
      
      const res = await fetch(url, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Message deleted');
        // Reload messages
        const reloadRes = await fetch(
          `/api/admin/user/${steamId}?adminSteamId=${user?.steamId}&time=${timeFilter}&search=${encodeURIComponent(searchQuery)}`
        );
        if (reloadRes.ok) {
          const data = await reloadRes.json();
          setMessages(data.messages || []);
          setDmMessages(data.dmMessages || []);
          if (userInfo) {
            setUserInfo({ ...userInfo, messageCount: data.messages?.length || 0 });
          }
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete message');
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
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
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>

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
                          <label htmlFor="user-timeout-duration" className="sr-only">Timeout duration</label>
                          <select
                            id="user-timeout-duration"
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
                  <label htmlFor="user-message-search" className="sr-only">Search messages</label>
                  <input
                    id="user-message-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages..."
                    className="w-full bg-[#08090d] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <label htmlFor="user-time-filter" className="sr-only">Time filter</label>
                <select
                  id="user-time-filter"
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
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => setActiveTab('global')}
                    className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                      activeTab === 'global'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#08090d] text-gray-400 hover:text-white'
                    }`}
                  >
                    Global Chat ({messages.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('dms')}
                    className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                      activeTab === 'dms'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#08090d] text-gray-400 hover:text-white'
                    }`}
                  >
                    Direct Messages ({dmConversations.length})
                  </button>
                </div>
                
                {activeTab === 'global' ? (
                  messages.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No global messages found</p>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                      {messages.map((msg) => (
                        <div key={msg.id} className="bg-[#08090d] p-4 rounded-lg border border-white/5 group hover:border-white/10 transition-all">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <span className="text-xs text-gray-500">
                                {new Date(msg.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {userIsOwner && msg.id && (
                              <button
                                onClick={() => handleDeleteMessage(msg.id, 'global')}
                                className="ml-2 p-2 hover:bg-red-500/20 rounded transition-colors flex items-center gap-1"
                                title="Delete message"
                              >
                                <Trash2 size={16} className="text-red-400" />
                                <span className="text-xs text-red-400 font-bold">Delete</span>
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-300">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  )
                ) : selectedDM ? (
                  // DM Conversation Detail View
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={() => {
                          setSelectedDM(null);
                          setSelectedDMMessages([]);
                          setSelectedDMOtherUserId(null);
                        }}
                        className="px-3 py-1 bg-[#08090d] hover:bg-[#11141d] rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                      >
                        <ArrowLeft size={16} />
                        Back to DM List
                      </button>
                      {selectedDMOtherUserId && (
                        <p className="text-sm text-gray-400">
                          DM with: {selectedDMOtherUserId}
                        </p>
                      )}
                    </div>
                    {loadingDM ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                      </div>
                    ) : selectedDMMessages.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">No messages in this conversation</p>
                    ) : (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {selectedDMMessages.map((msg) => (
                          <div key={msg.id} className={`bg-[#08090d] p-4 rounded-lg border border-white/5 group hover:border-white/10 transition-all ${
                            msg.senderId === steamId ? 'bg-blue-500/5 border-blue-500/20' : ''
                          }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <img
                                    src={msg.senderAvatar || '/icons/web-app-manifest-192x192.png'}
                                    alt={msg.senderName || 'Unknown User'}
                                    className="w-6 h-6 rounded-lg border border-blue-600"
                                  />
                                  <span className="text-xs font-bold text-blue-400">
                                    {msg.senderName || 'Unknown User'}
                                  </span>
                                  {msg.senderIsPro && (
                                    <Crown size={12} className="text-emerald-400" />
                                  )}
                                  {msg.isBanned && (
                                    <Ban size={12} className="text-red-400" />
                                  )}
                                  {msg.isTimedOut && (
                                    <Clock size={12} className="text-amber-400" />
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {new Date(msg.timestamp).toLocaleString()}
                                </span>
                              </div>
                              {userIsOwner && msg.id && (
                                <button
                                  onClick={() => handleDeleteMessage(msg.id, 'dm', selectedDM)}
                                  className="ml-2 p-2 hover:bg-red-500/20 rounded transition-colors flex items-center gap-1"
                                  title="Delete message"
                                >
                                  <Trash2 size={16} className="text-red-400" />
                                  <span className="text-xs text-red-400 font-bold">Delete</span>
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-300">{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // DM Conversations List
                  dmConversations.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No DM conversations found</p>
                  ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                      {dmConversations.map((conv) => (
                        <button
                          key={conv.dmId}
                          onClick={() => loadDMConversation(conv.dmId, conv.otherUserId)}
                          className="w-full text-left bg-[#08090d] p-4 rounded-lg border border-white/5 hover:border-blue-500/40 hover:bg-[#11141d] transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-bold text-blue-400 mb-1">
                                DM with: {conv.otherUserId}
                              </p>
                              <p className="text-xs text-gray-400 mb-1">
                                {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                              </p>
                              {conv.lastMessage && (
                                <>
                                  <p className="text-xs text-gray-500 truncate">
                                    {conv.lastMessage.message}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {new Date(conv.lastMessage.timestamp).toLocaleString()}
                                  </p>
                                </>
                              )}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowLeft size={16} className="text-blue-400 rotate-180" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
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

