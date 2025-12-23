"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Send, Loader2, Crown, Shield, Clock, Ban } from 'lucide-react';
import { isOwner } from '@/app/utils/owner-ids';
import { checkProStatus } from '@/app/utils/proxy-utils';

interface ChatMessage {
  id?: string;
  steamId: string;
  steamName: string;
  avatar: string;
  message: string;
  timestamp: Date | string;
  isPro: boolean;
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);
      
      if (parsedUser?.steamId) {
        setIsAdmin(isOwner(parsedUser.steamId));
        checkProStatus(parsedUser.steamId).then(setIsPro);
      }
    } catch {
      setUser(null);
    }
  }, []);

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

  useEffect(() => {
    fetchMessages();
    
    // Poll every second for new messages
    const interval = setInterval(fetchMessages, 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamId: user.steamId,
          steamName: user.name,
          avatar: user.avatar || '',
          message: message.trim(),
          isPro: isPro,
        }),
      });

      if (res.ok) {
        setMessage('');
        // Fetch new messages immediately
        await fetchMessages();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
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
        alert(`User ${timeoutUser.name} timed out for ${timeoutDuration}`);
        setTimeoutUser(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to timeout user');
      }
    } catch (error) {
      console.error('Failed to timeout user:', error);
      alert('Failed to timeout user');
    } finally {
      setTimeouting(false);
    }
  };

  const handleBan = async () => {
    if (!banUser || !isAdmin) return;

    if (!confirm(`Are you sure you want to BAN ${banUser.name}? This action cannot be undone easily.`)) {
      return;
    }

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
        alert(`User ${banUser.name} has been banned`);
        setBanUser(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to ban user');
      }
    } catch (error) {
      console.error('Failed to ban user:', error);
      alert('Failed to ban user');
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
          <h1 className="text-2xl font-black uppercase tracking-tighter">Community Chat</h1>
          <p className="text-sm text-gray-400 mt-1">Messages reset every 24 hours</p>
        </div>

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
                      {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        </div>
                      )}
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

        <form onSubmit={handleSend} className="bg-[#11141d] border-t border-white/5 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[#08090d] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!message.trim() || sending}
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
      </main>
    </div>
  );
}

