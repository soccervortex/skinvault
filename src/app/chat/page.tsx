"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Send, Loader2, Crown, Shield, Clock, Ban, MessageSquare, Users, UserPlus, X, Flag, Trash2 } from 'lucide-react';
import { isOwner } from '@/app/utils/owner-ids';
import { checkProStatus } from '@/app/utils/proxy-utils';
import { useToast } from '@/app/components/Toast';

interface ChatMessage {
  id?: string;
  steamId: string;
  steamName: string;
  avatar: string;
  message: string;
  timestamp: Date | string;
  isPro: boolean;
  isBanned?: boolean;
  isTimedOut?: boolean;
  timeoutUntil?: string | null;
}

interface DMMessage {
  id?: string;
  dmId: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  senderAvatar: string;
  senderIsPro: boolean;
  message: string;
  timestamp: Date | string;
  isBanned?: boolean;
  isTimedOut?: boolean;
}

interface DM {
  dmId: string;
  otherUserId: string;
  lastMessage: string;
  lastMessageTime: Date | string;
}

interface DMInvite {
  id?: string;
  fromSteamId: string;
  toSteamId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date | string;
  isSent: boolean;
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'global' | 'dms'>('global');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [dmList, setDmList] = useState<DM[]>([]);
  const [dmInvites, setDmInvites] = useState<DMInvite[]>([]);
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [timeoutUser, setTimeoutUser] = useState<{ steamId: string; name: string } | null>(null);
  const [timeoutDuration, setTimeoutDuration] = useState('5min');
  const [timeouting, setTimeouting] = useState(false);
  const [banUser, setBanUser] = useState<{ steamId: string; name: string } | null>(null);
  const [banning, setBanning] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserSteamId, setNewUserSteamId] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [reportUser, setReportUser] = useState<{ steamId: string; name: string; type: 'global' | 'dm'; dmId?: string } | null>(null);
  const [reportSteamId, setReportSteamId] = useState('');
  const [reporting, setReporting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadUser = async () => {
      try {
        const stored = window.localStorage.getItem('steam_user');
        let parsedUser = stored ? JSON.parse(stored) : null;
        
        // If user exists but name/avatar is missing, fetch from Steam
        if (parsedUser?.steamId && (!parsedUser.name || !parsedUser.avatar)) {
          try {
            const steamUrl = `https://steamcommunity.com/profiles/${parsedUser.steamId}/?xml=1`;
            const textRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`);
            const text = await textRes.text();
            const name = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || parsedUser.name || 'User';
            const avatar = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || parsedUser.avatar || '';
            
            parsedUser = { ...parsedUser, name, avatar };
            window.localStorage.setItem('steam_user', JSON.stringify(parsedUser));
          } catch (error) {
            console.warn('Failed to fetch Steam profile:', error);
          }
        }
        
        setUser(parsedUser);
        
        if (parsedUser?.steamId) {
          setIsAdmin(isOwner(parsedUser.steamId));
          checkProStatus(parsedUser.steamId).then(setIsPro);
        }
      } catch {
        setUser(null);
      }
    };
    
    loadUser();
    
    // Check for ban status and auto-logout if banned
    const checkBanStatus = async () => {
      try {
        const stored = window.localStorage.getItem('steam_user');
        const parsedUser = stored ? JSON.parse(stored) : null;
        if (!parsedUser?.steamId) return;
        
        const res = await fetch(`/api/admin/ban?steamId=${parsedUser.steamId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.banned === true) {
            // User is banned - logout immediately
            window.localStorage.removeItem('steam_user');
            toast.error('Your account has been banned. Please contact support if you believe this is an error.');
            setTimeout(() => {
              router.push('/contact');
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Failed to check ban status:', error);
      }
    };
    
    checkBanStatus();
    // Check ban status every 5 seconds
    const banCheckInterval = setInterval(checkBanStatus, 5000);
    return () => clearInterval(banCheckInterval);
  }, [toast, router]);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/chat/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDMMessages = async (steamId1: string, steamId2: string) => {
    try {
      const res = await fetch(`/api/chat/dms?steamId1=${steamId1}&steamId2=${steamId2}${isAdmin ? `&adminSteamId=${user?.steamId}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setDmMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch DM messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDMList = async () => {
    if (!user?.steamId) return;
    try {
      const res = await fetch(`/api/chat/dms/list?steamId=${user.steamId}`);
      if (res.ok) {
        const data = await res.json();
        setDmList(data.dms || []);
      }
    } catch (error) {
      console.error('Failed to fetch DM list:', error);
    }
  };

  const fetchDMInvites = async () => {
    if (!user?.steamId) return;
    try {
      const res = await fetch(`/api/chat/dms/invites?steamId=${user.steamId}&type=pending`);
      if (res.ok) {
        const data = await res.json();
        setDmInvites(data.invites || []);
      }
    } catch (error) {
      console.error('Failed to fetch DM invites:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'global') {
      fetchMessages();
      // Optimize: Poll every 2 seconds instead of 1 second for better performance
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    } else {
      fetchDMList();
      fetchDMInvites();
      // Optimize: Poll every 2 seconds
      const interval = setInterval(() => {
        fetchDMList();
        fetchDMInvites();
        if (selectedDM) {
          const [steamId1, steamId2] = selectedDM.split('_');
          fetchDMMessages(steamId1, steamId2);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [activeTab, selectedDM, user?.steamId, isAdmin]);

  useEffect(() => {
    if (activeTab === 'dms' && selectedDM && user?.steamId) {
      const [steamId1, steamId2] = selectedDM.split('_');
      fetchDMMessages(steamId1, steamId2);
      // Optimize: Poll every 2 seconds
      const interval = setInterval(() => {
        fetchDMMessages(steamId1, steamId2);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedDM, activeTab, user?.steamId, isAdmin]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, dmMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || sending) return;

    setSending(true);
    try {
      if (activeTab === 'global') {
        // Server will fetch current user info (name, avatar, pro status)
        const res = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            steamId: user.steamId,
            message: message.trim(),
          }),
        });

        if (res.ok) {
          setMessage('');
          await fetchMessages();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Failed to send message');
        }
      } else if (activeTab === 'dms' && selectedDM) {
        const [steamId1, steamId2] = selectedDM.split('_');
        const receiverId = steamId1 === user.steamId ? steamId2 : steamId1;
        
        const res = await fetch('/api/chat/dms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: user.steamId,
            receiverId,
            message: message.trim(),
          }),
        });

        if (res.ok) {
          setMessage('');
          await fetchDMMessages(steamId1, steamId2);
          await fetchDMList();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Failed to send message');
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendDMInvite = async () => {
    if (!newUserSteamId.trim() || !user?.steamId || sendingInvite) return;

    setSendingInvite(true);
    try {
      const res = await fetch('/api/chat/dms/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromSteamId: user.steamId,
          toSteamId: newUserSteamId.trim(),
        }),
      });

      if (res.ok) {
        toast.success('DM invite sent!');
        setNewUserSteamId('');
        setShowAddUser(false);
        await fetchDMInvites();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Failed to send DM invite:', error);
      toast.error('Failed to send invite');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      const res = await fetch('/api/chat/dms/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteId,
          steamId: user?.steamId,
          action: 'accept',
        }),
      });

      if (res.ok) {
        toast.success('DM invite accepted!');
        await fetchDMInvites();
        await fetchDMList();
        // Open the DM
        const invite = dmInvites.find(i => i.id === inviteId);
        if (invite) {
          const dmId = [user?.steamId, invite.otherUserId].sort().join('_');
          setSelectedDM(dmId);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to accept invite');
      }
    } catch (error) {
      console.error('Failed to accept invite:', error);
      toast.error('Failed to accept invite');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      const res = await fetch('/api/chat/dms/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteId,
          steamId: user?.steamId,
          action: 'decline',
        }),
      });

      if (res.ok) {
        toast.success('DM invite declined');
        await fetchDMInvites();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to decline invite');
      }
    } catch (error) {
      console.error('Failed to decline invite:', error);
      toast.error('Failed to decline invite');
    }
  };

  const handleReport = async () => {
    if (!reportUser || !user?.steamId || reporting) return;

    // Validate reported Steam ID
    if (!reportSteamId.trim() || !/^\d{17}$/.test(reportSteamId.trim())) {
      toast.error('Please enter a valid Steam ID (17 digits)');
      return;
    }

    if (reportSteamId.trim() !== reportUser.steamId) {
      toast.error('Steam ID does not match the user you are reporting');
      return;
    }

    setReporting(true);
    try {
      const res = await fetch('/api/chat/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterSteamId: user.steamId,
          reporterName: user.name,
          reportedSteamId: reportUser.steamId,
          reportedName: reportUser.name,
          reportType: reportUser.type,
          dmId: reportUser.dmId,
        }),
      });

      if (res.ok) {
        toast.success('Report submitted successfully. Thank you for helping keep the community safe.');
        setReportUser(null);
        setReportSteamId('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Failed to submit report:', error);
      toast.error('Failed to submit report');
    } finally {
      setReporting(false);
    }
  };

  const handleDeleteMessage = async (messageId: string, messageType: 'global' | 'dm' = 'global') => {
    if (!user?.steamId || !messageId) return;

    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const url = messageType === 'global'
        ? `/api/chat/messages/${messageId}?userSteamId=${user.steamId}&type=global`
        : `/api/chat/messages/${messageId}?userSteamId=${user.steamId}&type=dm&dmId=${selectedDM}`;
      
      const res = await fetch(url, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Message deleted');
        // Refresh messages
        if (messageType === 'global') {
          await fetchMessages();
        } else if (selectedDM) {
          const [steamId1, steamId2] = selectedDM.split('_');
          await fetchDMMessages(steamId1, steamId2);
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

  const handleTimeout = async () => {
    if (!timeoutUser || !isAdmin) return;

    setTimeouting(true);
    try {
      const res = await fetch('/api/chat/timeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamId: timeoutUser.steamId,
          duration: timeoutDuration,
          adminSteamId: user?.steamId,
        }),
      });

      if (res.ok) {
        toast.success(`User ${timeoutUser.name} timed out for ${timeoutDuration}`);
        setTimeoutUser(null);
        await fetchMessages(); // Refresh messages to show timeout badge
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
    if (!banUser || !isAdmin) return;

    setBanning(true);
    try {
      const res = await fetch(`/api/admin/ban?steamId=${banUser.steamId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });

      if (res.ok) {
        toast.success(`User ${banUser.name} has been banned`);
        setBanUser(null);
        await fetchMessages(); // Refresh messages to show banned badge
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

  const handleViewInventory = (steamId: string) => {
    router.push(`/inventory?steamId=${steamId}`);
  };

  const formatTime = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-bold mb-4">Please sign in to use chat</p>
            <button
              onClick={() => router.push('/api/auth/steam')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
            >
              Sign In with Steam
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-[#11141d] border-b border-white/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-black uppercase tracking-tighter">
              {activeTab === 'global' ? 'Community Chat' : 'Direct Messages'}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setActiveTab('global');
                  setSelectedDM(null);
                }}
                className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                  activeTab === 'global'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#08090d] text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare size={16} className="inline mr-2" />
                Global
              </button>
              <button
                onClick={() => {
                  setActiveTab('dms');
                  setSelectedDM(null);
                }}
                className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                  activeTab === 'dms'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#08090d] text-gray-400 hover:text-white'
                }`}
              >
                <Users size={16} className="inline mr-2" />
                DMs
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {activeTab === 'global' ? 'Messages reset every 24 hours' : 'Messages reset after 7 days'}
          </p>
        </div>

        {activeTab === 'global' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No messages yet. Be the first to chat!</p>
              </div>
            ) : (
              messages.map((msg) => (
              <div
                key={msg.id || `${msg.steamId}-${msg.timestamp}`}
                className="bg-[#11141d] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={msg.avatar || '/icons/web-app-manifest-192x192.png'}
                    alt={msg.steamName}
                    className="w-10 h-10 rounded-lg border-2 border-blue-600 cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => handleViewInventory(msg.steamId)}
                    title="Click to view inventory"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-bold text-white cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleViewInventory(msg.steamId)}
                      >
                        {msg.steamName}
                      </span>
                      {msg.isPro && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[8px] font-black uppercase tracking-[0.25em] text-emerald-400 flex items-center gap-1">
                          <Crown size={8} />
                          Pro
                        </span>
                      )}
                      {msg.isBanned && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/40 text-[8px] font-black uppercase tracking-[0.25em] text-red-400 flex items-center gap-1">
                          <Ban size={8} />
                          Banned
                        </span>
                      )}
                      {msg.isTimedOut && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-[8px] font-black uppercase tracking-[0.25em] text-amber-400 flex items-center gap-1">
                          <Clock size={8} />
                          Timeout
                        </span>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(msg.steamId === user?.steamId || isAdmin) && msg.id && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id!, 'global')}
                            className="p-1 hover:bg-red-500/20 rounded"
                            title="Delete message"
                          >
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        )}
                        {msg.steamId !== user?.steamId && (
                          <button
                            onClick={() => setReportUser({ steamId: msg.steamId, name: msg.steamName, type: 'global' })}
                            className="p-1 hover:bg-orange-500/20 rounded"
                            title="Report user"
                          >
                            <Flag size={14} className="text-orange-400" />
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => setTimeoutUser({ steamId: msg.steamId, name: msg.steamName })}
                              className="p-1 hover:bg-red-500/20 rounded"
                              title="Timeout user"
                            >
                              <Clock size={14} className="text-red-400" />
                            </button>
                            <button
                              onClick={() => setBanUser({ steamId: msg.steamId, name: msg.steamName })}
                              className="p-1 hover:bg-red-500/20 rounded"
                              title="Ban user"
                            >
                              <Ban size={14} className="text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-auto">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 break-words">{msg.message}</p>
                  </div>
                </div>
              </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* DM List Sidebar */}
            <div className="w-64 bg-[#11141d] border-r border-white/5 flex flex-col">
              <div className="p-4 border-b border-white/5">
                <button
                  onClick={() => setShowAddUser(true)}
                  className="w-full bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} />
                  New DM
                </button>
              </div>
              
              {/* Pending Invites */}
              {dmInvites.length > 0 && (
                <div className="p-4 border-b border-white/5">
                  <p className="text-xs text-gray-500 mb-2 font-bold uppercase">Pending Invites</p>
                  <div className="space-y-2">
                    {dmInvites.map((invite) => (
                      <div key={invite.id} className="bg-[#08090d] p-2 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={invite.otherUserAvatar || '/icons/web-app-manifest-192x192.png'}
                            alt={invite.otherUserName}
                            className="w-8 h-8 rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{invite.otherUserName}</p>
                            <p className="text-[10px] text-gray-500">{invite.isSent ? 'Sent' : 'Received'}</p>
                          </div>
                        </div>
                        {!invite.isSent && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleAcceptInvite(invite.id!)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded text-[10px] font-bold"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeclineInvite(invite.id!)}
                              className="flex-1 bg-red-600 hover:bg-red-500 px-2 py-1 rounded text-[10px] font-bold"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DM List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {dmList.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    <p>No DMs yet. Start a new conversation!</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {dmList.map((dm) => (
                      <button
                        key={dm.dmId}
                        onClick={() => setSelectedDM(dm.dmId)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedDM === dm.dmId
                            ? 'bg-blue-600/20 border border-blue-500/40'
                            : 'bg-[#08090d] hover:bg-[#11141d]'
                        }`}
                      >
                        <p className="text-xs font-bold mb-1 truncate">User: {dm.otherUserId}</p>
                        <p className="text-[10px] text-gray-400 truncate">{dm.lastMessage}</p>
                        <p className="text-[9px] text-gray-500 mt-1">
                          {formatTime(dm.lastMessageTime)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* DM Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedDM ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                      </div>
                    ) : dmMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      dmMessages.map((msg) => (
                        <div
                          key={msg.id || `${msg.senderId}-${msg.timestamp}`}
                          className={`bg-[#11141d] p-4 rounded-xl border border-white/5 ${
                            msg.senderId === user?.steamId ? 'ml-auto max-w-[70%]' : 'mr-auto max-w-[70%]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={msg.senderAvatar || '/icons/web-app-manifest-192x192.png'}
                              alt={msg.senderName}
                              className="w-10 h-10 rounded-lg border-2 border-blue-600"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-white">{msg.senderName}</span>
                                {msg.senderIsPro && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[8px] font-black uppercase tracking-[0.25em] text-emerald-400 flex items-center gap-1">
                                    <Crown size={8} />
                                    Pro
                                  </span>
                                )}
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                                  {(msg.senderId === user?.steamId || isAdmin) && msg.id && (
                                    <button
                                      onClick={() => handleDeleteMessage(msg.id!, 'dm')}
                                      className="p-1 hover:bg-red-500/20 rounded"
                                      title="Delete message"
                                    >
                                      <Trash2 size={12} className="text-red-400" />
                                    </button>
                                  )}
                                  {msg.senderId !== user?.steamId && (
                                    <button
                                      onClick={() => setReportUser({ 
                                        steamId: msg.senderId, 
                                        name: msg.senderName, 
                                        type: 'dm',
                                        dmId: selectedDM || undefined
                                      })}
                                      className="p-1 hover:bg-orange-500/20 rounded"
                                      title="Report user"
                                    >
                                      <Flag size={12} className="text-orange-400" />
                                    </button>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {formatTime(msg.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-300 break-words">{msg.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-bold mb-2">Select a DM to start chatting</p>
                    <p className="text-sm">Or create a new DM by clicking "New DM"</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeout Modal */}
        {timeoutUser && isAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#11141d] p-6 rounded-2xl border border-white/10 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4">Timeout User</h3>
              <p className="text-gray-400 mb-4">Timeout {timeoutUser.name} for:</p>
              <select
                value={timeoutDuration}
                onChange={(e) => setTimeoutDuration(e.target.value)}
                className="w-full bg-[#08090d] border border-white/10 rounded-lg p-3 mb-4 text-white"
              >
                <option value="1min">1 Minute</option>
                <option value="5min">5 Minutes</option>
                <option value="30min">30 Minutes</option>
                <option value="60min">60 Minutes (1 Hour)</option>
                <option value="1day">1 Day</option>
              </select>
              <div className="flex gap-3">
                <button
                  onClick={handleTimeout}
                  disabled={timeouting}
                  className="flex-1 bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {timeouting ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Timeout'}
                </button>
                <button
                  onClick={() => setTimeoutUser(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ban Modal */}
        {banUser && isAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#11141d] p-6 rounded-2xl border border-red-500/30 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4 text-red-400">Ban User</h3>
              <p className="text-gray-400 mb-4">Are you sure you want to permanently ban <strong>{banUser.name}</strong>?</p>
              <p className="text-sm text-red-400 mb-4">This will prevent them from using the chat and other features.</p>
              <div className="flex gap-3">
                <button
                  onClick={handleBan}
                  disabled={banning}
                  className="flex-1 bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {banning ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Confirm Ban'}
                </button>
                <button
                  onClick={() => setBanUser(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'global' || (activeTab === 'dms' && selectedDM)) && (
          <form onSubmit={handleSend} className="bg-[#11141d] border-t border-white/5 p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={activeTab === 'global' ? 'Type a message...' : 'Type a DM...'}
                className="flex-1 bg-[#08090d] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!message.trim() || sending || (activeTab === 'dms' && !selectedDM)}
                className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <>
                    <Send size={16} />
                    Send
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Report Modal */}
        {reportUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#11141d] p-6 rounded-2xl border border-orange-500/30 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-orange-400">Report User</h3>
                <button
                  onClick={() => {
                    setReportUser(null);
                    setReportSteamId('');
                  }}
                  className="text-gray-500 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-gray-400 mb-4">
                You are reporting <strong>{reportUser.name}</strong> ({reportUser.type === 'global' ? 'Global Chat' : 'Direct Message'}).
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Please enter the Steam ID of the user you are reporting to confirm:
              </p>
              <input
                type="text"
                value={reportSteamId}
                onChange={(e) => setReportSteamId(e.target.value)}
                placeholder="7656119..."
                className="w-full bg-[#08090d] border border-white/10 rounded-lg px-4 py-2 mb-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReport}
                  disabled={!reportSteamId.trim() || reporting}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {reporting ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Submit Report'}
                </button>
                <button
                  onClick={() => {
                    setReportUser(null);
                    setReportSteamId('');
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {showAddUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#11141d] p-6 rounded-2xl border border-white/10 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Start New DM</h3>
                <button
                  onClick={() => {
                    setShowAddUser(false);
                    setNewUserSteamId('');
                  }}
                  className="text-gray-500 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Enter the Steam ID of the user you want to message
              </p>
              <input
                type="text"
                value={newUserSteamId}
                onChange={(e) => setNewUserSteamId(e.target.value)}
                placeholder="7656119..."
                className="w-full bg-[#08090d] border border-white/10 rounded-lg px-4 py-2 mb-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleSendDMInvite}
                  disabled={!newUserSteamId.trim() || sendingInvite}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {sendingInvite ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Send Invite'}
                </button>
                <button
                  onClick={() => {
                    setShowAddUser(false);
                    setNewUserSteamId('');
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

