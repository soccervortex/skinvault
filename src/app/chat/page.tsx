"use client";

import React, { useState, useEffect, useRef, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Send, Loader2, Crown, Shield, Clock, Ban, MessageSquare, Users, UserPlus, X, Flag, Trash2, UserX, UserCheck, Edit, Pin, PinOff, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { isOwner } from '@/app/utils/owner-ids';
import { checkProStatus } from '@/app/utils/proxy-utils';
import { useToast } from '@/app/components/Toast';
import MessageActionMenu from '@/app/components/MessageActionMenu';
import { addUnreadDM, markDMAsRead, addUnreadInvite, markInviteAsRead, getLastCheckTime, updateLastCheckTime, markAllDMsAsRead, getUnreadCounts } from '@/app/utils/chat-notifications';
import { usePusherChat } from '@/app/hooks/usePusherChat';
import { getCachedMessages, setCachedMessages, clearCache } from '@/app/utils/chat-cache';
import { saveDMList, mergeDMList, loadDMList } from '@/app/utils/dm-list-persistence';
import { sendDMMessage, acceptDMInvite, sendDMInvite, sendGlobalMessage } from '@/app/actions/chat-actions';

interface ChatMessage {
  id?: string;
  steamId: string;
  steamName: string;
  avatar: string;
  message: string;
  timestamp: Date | string;
  editedAt?: Date | string;
  isPro: boolean;
  isBanned?: boolean;
  isTimedOut?: boolean;
  timeoutUntil?: string | null;
  isPinned?: boolean;
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
  editedAt?: Date | string;
  isBanned?: boolean;
  isTimedOut?: boolean;
  isPinned?: boolean;
}

interface DM {
  dmId: string;
  otherUserId: string;
  otherUserName?: string;
  otherUserAvatar?: string;
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
  
  // Optimistic state for global messages using useOptimistic
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state: ChatMessage[], newMessage: ChatMessage) => [...state, newMessage]
  );
  
  // Optimistic state for DM messages using useOptimistic
  const [optimisticDMMessages, addOptimisticDMMessage] = useOptimistic(
    dmMessages,
    (state: DMMessage[], newMessage: DMMessage) => [...state, newMessage]
  );
  
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
  const [globalChatDisabled, setGlobalChatDisabled] = useState(false);
  const [dmChatDisabled, setDmChatDisabled] = useState(false);
  const [unbanUser, setUnbanUser] = useState<{ steamId: string; name: string } | null>(null);
  const [unbanning, setUnbanning] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [blocking, setBlocking] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; type: 'global' | 'dm'; currentText: string } | null>(null);
  const [editText, setEditText] = useState('');
  const [editing, setEditing] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Array<{ steamId: string; steamName: string }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevTabRef = useRef<'global' | 'dms'>('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterPinnedOnly, setFilterPinnedOnly] = useState(false);
  const [filterProOnly, setFilterProOnly] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | null>(null); // Cursor for pagination
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Array<{ id: string; message: string; timestamp: string; steamName: string; avatar: string; messageType: 'global' | 'dm'; dmId?: string }>>([]);
  const [viewingPinnedMessageId, setViewingPinnedMessageId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState({ dms: 0, invites: 0, total: 0 });
  const toast = useToast();

  // Real-time SSE streams (after all state declarations)
  const globalChannel = activeTab === 'global' ? 'global' : null;
  // DM channel should be dm_${steamId} to match what server sends, not the dmId
  const dmChannel = activeTab === 'dms' && user?.steamId ? `dm_${user.steamId}` : null;
  const lastGlobalMessageId = optimisticMessages.length > 0 ? optimisticMessages[optimisticMessages.length - 1]?.id : undefined;
  const lastDMMessageId = optimisticDMMessages.length > 0 ? optimisticDMMessages[optimisticDMMessages.length - 1]?.id : undefined;
  
  const globalStream = usePusherChat(
    globalChannel || '',
    user?.steamId || null,
    activeTab === 'global' && !globalChatDisabled && !searchQuery && !filterUser && !filterDateFrom && !filterDateTo && !filterPinnedOnly && !filterProOnly,
    lastGlobalMessageId
  );
  
  const dmStream = usePusherChat(
    dmChannel || '',
    user?.steamId || null,
    activeTab === 'dms' && !!user?.steamId && !dmChatDisabled,
    lastDMMessageId
  );

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
          
          // Try to use preloaded data first (instant load)
          const { getPreloadedChatData, preloadChatData } = await import('@/app/utils/chat-preloader');
          const preloaded = getPreloadedChatData();
          
          if (preloaded) {
            // Use preloaded data for instant display
            setMessages(preloaded.messages || []);
            setDmList(preloaded.dmList || []);
            setDmInvites(preloaded.dmInvites || []);
            setLoading(false);
            
            // Refresh in background
            preloadChatData(parsedUser.steamId).then(() => {
              const fresh = getPreloadedChatData();
              if (fresh) {
                setMessages(fresh.messages || []);
                setDmList(fresh.dmList || []);
                setDmInvites(fresh.dmInvites || []);
              }
            });
          } else {
            // No preloaded data, fetch now
            (async () => {
              try {
                // Preload global chat messages
                const messagesRes = await fetch('/api/chat/messages');
                if (messagesRes.ok) {
                  const messagesData = await messagesRes.json();
                  setMessages(messagesData.messages || []);
                }
                
                // Preload DM list
                const dmListRes = await fetch(`/api/chat/dms/list?steamId=${parsedUser.steamId}`);
                if (dmListRes.ok) {
                  const dmListData = await dmListRes.json();
                  setDmList(dmListData.dms || []);
                }
                
                // Preload DM invites
                const invitesRes = await fetch(`/api/chat/dms/invites?steamId=${parsedUser.steamId}&type=pending`);
                if (invitesRes.ok) {
                  const invitesData = await invitesRes.json();
                  setDmInvites(invitesData.invites || []);
                }
                
                // Store for next time
                await preloadChatData(parsedUser.steamId);
                
                setLoading(false);
              } catch (error) {
                console.error('Failed to preload chat:', error);
                setLoading(false);
              }
            })();
          }
        } else {
          setLoading(false);
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

    // Check chat disable status
    const checkChatStatus = async () => {
    try {
        const stored = window.localStorage.getItem('steam_user');
        const currentUser = stored ? JSON.parse(stored) : null;
        if (isAdmin && currentUser?.steamId) {
          const res = await fetch(`/api/admin/chat-control?adminSteamId=${currentUser.steamId}`);
      if (res.ok) {
        const data = await res.json();
            setGlobalChatDisabled(data.globalChatDisabled || false);
            setDmChatDisabled(data.dmChatDisabled || false);
          }
        }
      } catch (error) {
        console.error('Failed to check chat status:', error);
      }
    };
    
    checkChatStatus();
    const chatStatusInterval = setInterval(checkChatStatus, 5000);
    
    return () => {
      clearInterval(banCheckInterval);
      clearInterval(chatStatusInterval);
    };
  }, [toast, router, isAdmin]);

  const fetchMessages = async (beforeCursor: string | null = null, append = false) => {
    try {
      // Check cache first (only for initial load, not when appending)
      if (!append && !beforeCursor && !searchQuery && !filterUser && !filterDateFrom && !filterDateTo && !filterPinnedOnly && !filterProOnly) {
        const cached = getCachedMessages('global', 'global');
        if (cached && cached.messages.length > 0) {
          setMessages(cached.messages);
          setMessageCursor(cached.cursor || null);
          setHasMoreMessages(true); // Assume there are more
          setLoading(false);
          // Still fetch in background to update cache
        }
      }
      
      const params = new URLSearchParams();
      // Use cursor-based pagination instead of page numbers
      if (beforeCursor) {
        params.set('beforeTimestamp', beforeCursor);
      }
      if (searchQuery) params.set('search', searchQuery);
      if (filterUser) params.set('user', filterUser);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (filterPinnedOnly) params.set('pinnedOnly', 'true');
      if (filterProOnly) params.set('proOnly', 'true');
      
      const res = await fetch(`/api/chat/messages?${params.toString()}`, {
        cache: 'no-store', // Always fetch fresh data
      });
      if (res.ok) {
        const data = await res.json();
        const newMessages = data.messages || [];
        
        // Cache messages if no filters/search (for instant loading next time)
        if (!searchQuery && !filterUser && !filterDateFrom && !filterDateTo && !filterPinnedOnly && !filterProOnly && !beforeCursor) {
          setCachedMessages('global', newMessages, data.nextCursor || null, 'global');
        }
        
        // Only update if messages actually changed (avoid unnecessary re-renders)
        if (append) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueNew = newMessages.filter((m: any) => !existingIds.has(m.id));
            return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
          });
        } else {
          setMessages(prev => {
            // Only update if messages are different
            if (prev.length !== newMessages.length) return newMessages;
            const prevIds = new Set(prev.map(m => m.id));
            const newIds = new Set(newMessages.map((m: any) => m.id));
            if (prevIds.size !== newIds.size) return newMessages;
            for (const id of prevIds) {
              if (!newIds.has(id)) return newMessages;
            }
            return prev; // No changes, keep previous state
          });
        }
        setHasMoreMessages(data.hasMore || false);
        // Update cursor for next page
        setMessageCursor(data.nextCursor || null);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDMMessages = async (steamId1: string, steamId2: string, checkForNew = false, loadAll = false) => {
    if (!user?.steamId) return;
    try {
      const dmId = [steamId1, steamId2].sort().join('_');
      
      // Check cache first (only for initial load, not when checking for new)
      // But always fetch fresh data to ensure we have the latest messages
      if (!checkForNew && !loadAll) {
        const cached = getCachedMessages(dmId, 'dm');
        if (cached && cached.messages.length > 0) {
          // Show cached messages immediately for instant display
          setDmMessages(cached.messages);
          setLoading(false);
          // Still fetch in background to update cache and get latest messages
        }
      }
      
      // Always pass current user's steamId so API can verify they're a participant
      // Load all 365 days of messages to ensure we get everything
      const params = new URLSearchParams({
        steamId1,
        steamId2,
        currentUserId: user.steamId,
        limit: '100', // Load more messages initially
      });
      if (isAdmin) params.set('adminSteamId', user.steamId);
      if (loadAll) {
        params.set('loadAll', 'true');
      } else {
        // Always load all 365 days for DMs to ensure we get all messages
        params.set('loadAll', 'true');
      }
      
      const res = await fetch(`/api/chat/dms?${params.toString()}`, {
        cache: 'no-store', // Always fetch fresh data
      });
      
      if (res.ok) {
        const data = await res.json();
        const newMessages = data.messages || [];
        
        // Always update messages, even if we showed cached ones
        setDmMessages(newMessages);
        
        // Cache messages for faster loading next time
        if (!checkForNew) {
          setCachedMessages(dmId, newMessages, data.nextCursor || null, 'dm');
        }
        
        // If checking for new messages (polling), track unread for messages from other user
        if (checkForNew && newMessages.length > 0) {
          const lastMessage = newMessages[newMessages.length - 1];
          
          // Only track if message is from other user and DM is not currently selected/viewed
          if (lastMessage.senderId !== user.steamId && selectedDM !== dmId) {
            addUnreadDM(
              dmId,
              user.steamId,
              lastMessage.message,
              lastMessage.senderName,
              lastMessage.senderAvatar
            );
          }
        }
        
        // Mark DM as read when viewing (always mark as read when messages are loaded for selected DM)
        if (selectedDM === dmId) {
          markDMAsRead(dmId, user.steamId);
        }
      } else {
        console.error('Failed to fetch DM messages:', res.status, res.statusText);
        // If fetch fails and we have cached messages, keep showing them
        // Otherwise show error
        if (dmMessages.length === 0) {
          const errorData = await res.json().catch(() => ({}));
          console.error('DM fetch error:', errorData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch DM messages:', error);
      // If error and no messages, try to load from cache as fallback
      if (dmMessages.length === 0) {
        const dmId = [steamId1, steamId2].sort().join('_');
        const cached = getCachedMessages(dmId, 'dm');
        if (cached && cached.messages.length > 0) {
          setDmMessages(cached.messages);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDMList = async (merge: boolean = false) => {
    if (!user?.steamId) return;
    try {
      const res = await fetch(`/api/chat/dms/list?steamId=${user.steamId}`, {
        cache: 'no-store', // Prevent caching
      });
      if (res.ok) {
        const data = await res.json();
        const serverDMs = data.dms || [];
        console.log(`[DM List Frontend] Fetched ${serverDMs.length} DMs from server`);
        
        // Always merge with persisted DMs to prevent disappearing
        const mergedDMs = merge ? mergeDMList(serverDMs, user.steamId) : serverDMs;
        
        // Save to localStorage for persistence
        saveDMList(mergedDMs, user.steamId);
        
        setDmList(mergedDMs);
        console.log(`[DM List Frontend] Set ${mergedDMs.length} DMs (${serverDMs.length} from server, ${mergedDMs.length - serverDMs.length} from persistence)`);
      } else {
        console.error('[DM List Frontend] Failed to fetch DM list:', res.status, res.statusText);
        // On error, try to load from persistence
        if (merge) {
          const persisted = mergeDMList([], user.steamId);
          if (persisted.length > 0) {
            console.log(`[DM List Frontend] Using ${persisted.length} persisted DMs due to server error`);
            setDmList(persisted);
          }
        }
      }
    } catch (error) {
      console.error('[DM List Frontend] Failed to fetch DM list:', error);
      // On error, try to load from persistence
      if (merge) {
        const persisted = mergeDMList([], user.steamId);
        if (persisted.length > 0) {
          console.log(`[DM List Frontend] Using ${persisted.length} persisted DMs due to fetch error`);
          setDmList(persisted);
        }
      }
    }
  };

  const fetchDMInvites = async () => {
    if (!user?.steamId) return;
    try {
      const lastCheck = getLastCheckTime();
      const res = await fetch(`/api/chat/dms/invites?steamId=${user.steamId}&type=pending`);
      if (res.ok) {
        const data = await res.json();
        const newInvites = data.invites || [];
        
        // Track new invites for notifications
        newInvites.forEach((invite: any) => {
          if (invite.createdAt && new Date(invite.createdAt).getTime() > lastCheck) {
            addUnreadInvite(
              invite.id,
              invite.fromSteamId || invite.otherUserId,
              user.steamId,
              invite.otherUserName || 'Unknown User',
              invite.otherUserAvatar
            );
          }
        });
        
        setDmInvites(newInvites);
        updateLastCheckTime();
      }
    } catch (error) {
      console.error('Failed to fetch DM invites:', error);
    }
  };

  useEffect(() => {
    if (!user?.steamId) return;
    
    // Only mark DMs as read when tab actually changes
    const tabChanged = prevTabRef.current !== activeTab;
    if (tabChanged) {
      prevTabRef.current = activeTab;
      // Mark all DMs as read when switching tabs (user has viewed them)
      markAllDMsAsRead(user.steamId);
    }
    
    // Initial fetch (preloading already handles this, but ensure it runs)
    if (activeTab === 'global') {
      if (messages.length === 0) {
        fetchMessages(null, false); // Reset cursor, load from beginning
      }
    } else {
      // Load persisted DMs first for instant display
      if (dmList.length === 0 && user?.steamId) {
        const persisted = loadDMList(user.steamId);
        if (persisted.length > 0) {
          const initialDMs = persisted.map(dm => ({
            dmId: dm.dmId,
            otherUserId: dm.otherUserId,
            otherUserName: dm.otherUserName,
            otherUserAvatar: dm.otherUserAvatar,
            lastMessage: dm.lastMessage,
            lastMessageTime: new Date(dm.lastMessageTime),
          }));
          setDmList(initialDMs);
        }
      }
      
      if (dmList.length === 0) {
        fetchDMList();
      }
      if (dmInvites.length === 0) {
        fetchDMInvites();
      }
      // Mark selected DM as read if one is selected
      if (selectedDM && user?.steamId) {
        markDMAsRead(selectedDM, user.steamId);
      }
    }
    
    // Fallback polling (SSE is primary, this is backup)
    // Only poll if SSE is not connected OR filters/search are active
    const interval = setInterval(() => {
      if (activeTab === 'global') {
        const shouldPoll = !globalStream.isConnected || searchQuery || filterUser || filterDateFrom || filterDateTo || filterPinnedOnly || filterProOnly;
        if (shouldPoll && !globalChatDisabled) {
          fetchMessages(null, false); // Reset cursor, load from beginning
        }
      } else {
        // Don't poll DM list if we already have DMs - only poll for new invites
        // This prevents overwriting the DM list and losing DMs
        const shouldPoll = !dmStream.isConnected && selectedDM;
        if (!dmChatDisabled && shouldPoll) {
          // Only fetch invites, not DM list (to avoid overwriting)
          fetchDMInvites();
        }
      }
    }, 10000); // Slower polling (10s) since SSE handles real-time
    
    return () => clearInterval(interval);
  }, [activeTab, selectedDM, user?.steamId, globalStream.isConnected, dmStream.isConnected, searchQuery, filterUser, filterDateFrom, filterDateTo, filterPinnedOnly, filterProOnly, globalChatDisabled, dmChatDisabled]);

  // Merge SSE stream messages with existing messages (real-time updates)
  // NOTE: useChatStream already handles deduplication, so we just need to update state
  useEffect(() => {
    if (globalStream.messages.length > 0 && activeTab === 'global') {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMessages = globalStream.messages.filter(m => m.id && !existingIds.has(m.id));
        if (newMessages.length > 0) {
          // Remove optimistic messages with temp IDs when real messages arrive
          // Filter out any messages with temp IDs that match the new real messages
          const filteredPrev = prev.filter(m => {
            // Keep messages that are not temp IDs, or temp IDs that don't match new real messages
            if (m.id?.startsWith('temp_')) {
              // Check if this temp message matches a new real message (same sender, similar time, same content)
              const matchingReal = newMessages.find(real => 
                real.steamId === m.steamId && 
                real.message === m.message &&
                Math.abs(new Date(real.timestamp).getTime() - new Date(m.timestamp).getTime()) < 5000
              );
              return !matchingReal; // Remove if matches
            }
            return true;
          });
          
          // Update cache with new messages
          const updatedMessages = [...filteredPrev, ...newMessages];
          setCachedMessages('global', updatedMessages, messageCursor, 'global');
          // Auto-scroll to new messages
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
          return updatedMessages;
        }
        return prev;
      });
    }
  }, [globalStream.messages, activeTab, messageCursor]);

  useEffect(() => {
    if (dmStream.messages.length > 0 && activeTab === 'dms' && selectedDM) {
      setDmMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        // Filter messages to only include those for the currently selected DM
        const newMessages = dmStream.messages.filter(m => 
          m.id && 
          !existingIds.has(m.id) && 
          m.dmId === selectedDM // Only show messages for the selected DM
        );
        if (newMessages.length > 0) {
          // Remove optimistic messages with temp IDs when real messages arrive
          // Filter out any messages with temp IDs that match the new real messages
          const filteredPrev = prev.filter(m => {
            // Keep messages that are not temp IDs, or temp IDs that don't match new real messages
            if (m.id?.startsWith('temp_')) {
              // Check if this temp message matches a new real message (same sender, similar time, same content)
              const matchingReal = newMessages.find(real => 
                real.senderId === m.senderId && 
                real.message === m.message &&
                Math.abs(new Date(real.timestamp).getTime() - new Date(m.timestamp).getTime()) < 5000
              );
              return !matchingReal; // Remove if matches
            }
            return true;
          });
          
          // Only track unread if message is from other user AND user is NOT currently viewing this DM
          // If user is viewing the DM (selectedDM === msg.dmId), messages should NOT be marked as unread
          newMessages.forEach(msg => {
            // Don't mark as unread if message is from current user
            if (msg.senderId !== user?.steamId) {
              // Only mark as unread if user is NOT viewing this DM
              if (selectedDM !== msg.dmId || activeTab !== 'dms') {
                addUnreadDM(
                  msg.dmId,
                  user?.steamId || '',
                  msg.message,
                  msg.senderName,
                  msg.senderAvatar
                );
              }
            }
          });
          // Always mark selected DM as read since user is viewing it
          if (selectedDM && activeTab === 'dms') {
            markDMAsRead(selectedDM, user?.steamId || '');
            // Update cache with new messages
            const updatedMessages = [...filteredPrev, ...newMessages];
            setCachedMessages(selectedDM, updatedMessages, null, 'dm');
          }
          // Auto-scroll to new messages
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
          return [...filteredPrev, ...newMessages];
        }
        return prev;
      });
    }
  }, [dmStream.messages, user?.steamId, selectedDM, activeTab]);

  // Update unread counts and show notifications
  useEffect(() => {
    if (!user?.steamId) return;

    const updateCounts = () => {
      const counts = getUnreadCounts(user.steamId);
      setUnreadCounts(counts);
    };

    updateCounts();

    // Listen for unread updates
    const handleUnreadUpdate = () => updateCounts();
    window.addEventListener('chat-unread-updated', handleUnreadUpdate);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    // Listen for notification events
    const handleNotification = (event: CustomEvent) => {
      const notification = event.detail;
      
      // Show browser notification if permission granted and not on chat page
      if ('Notification' in window && Notification.permission === 'granted') {
        if (notification.type === 'dm_message') {
          new Notification(`New message from ${notification.userName}`, {
            body: notification.message?.substring(0, 100) || 'New message',
            icon: notification.userAvatar || '/icons/web-app-manifest-192x192.png',
            tag: `dm-${notification.dmId}`,
            requireInteraction: false,
          });
        } else if (notification.type === 'dm_invite') {
          new Notification(`New DM invite from ${notification.userName}`, {
            body: `${notification.userName} wants to start a conversation`,
            icon: notification.userAvatar || '/icons/web-app-manifest-192x192.png',
            tag: `invite-${notification.steamId}`,
            requireInteraction: false,
          });
        }
      }
      
      updateCounts();
    };

    window.addEventListener('chat-notification', handleNotification as EventListener);

    return () => {
      window.removeEventListener('chat-unread-updated', handleUnreadUpdate);
      window.removeEventListener('chat-notification', handleNotification as EventListener);
    };
  }, [user?.steamId]);

  // Handle real-time message deletions from Pusher
  useEffect(() => {
    if (!user?.steamId) return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu';

    if (!pusherKey) return;

    // Use the same Pusher client pattern as usePusherChat
    const Pusher = require('pusher-js').default;
    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    // Listen for global message deletions
    const globalChannel = pusher.subscribe('global');
    const handleGlobalDelete = (data: any) => {
      if (data.type === 'message_deleted' && data.messageId && data.messageType === 'global') {
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.id !== data.messageId);
          clearCache('global', 'global');
          setCachedMessages('global', filtered, messageCursor, 'global');
          return filtered;
        });
      }
    };
    globalChannel.bind('message_deleted', handleGlobalDelete);

    // Listen for DM message deletions
    const dmChannel = pusher.subscribe(`dm_${user.steamId}`);
    const handleDMDelete = (data: any) => {
      if (data.type === 'message_deleted' && data.messageId && data.messageType === 'dm' && data.dmId) {
        // Remove from all DMs, not just selected (in case user switches DMs)
        setDmMessages(prev => {
          if (selectedDM === data.dmId) {
            const filtered = prev.filter(msg => msg.id !== data.messageId);
            clearCache(selectedDM, 'dm');
            setCachedMessages(selectedDM, filtered, null, 'dm');
            return filtered;
          }
          return prev;
        });
      }
    };
    dmChannel.bind('message_deleted', handleDMDelete);

    return () => {
      globalChannel.unbind('message_deleted', handleGlobalDelete);
      globalChannel.unsubscribe();
      dmChannel.unbind('message_deleted', handleDMDelete);
      dmChannel.unsubscribe();
      pusher.disconnect();
    };
  }, [user?.steamId, selectedDM, messageCursor]);

  useEffect(() => {
    if (activeTab === 'dms' && selectedDM && user?.steamId) {
      const [steamId1, steamId2] = selectedDM.split('_');
      if (!steamId1 || !steamId2) return;
      
      // Mark DM as read when selected/viewed (immediately clear unread counter)
      markDMAsRead(selectedDM, user.steamId);
      
      // Always fetch fresh messages when DM is selected (load all 365 days)
      setLoading(true);
      fetchDMMessages(steamId1, steamId2, false, true).finally(() => {
        setLoading(false);
      });
      
      // Reduced polling since SSE handles real-time updates
      // Only poll if SSE is not connected
      let interval: NodeJS.Timeout | undefined;
      if (!dmStream.isConnected && !dmChatDisabled) {
        interval = setInterval(() => {
          fetchDMMessages(steamId1, steamId2, true, true);
        }, 5000); // Slower polling since SSE is primary
      }
      
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else if (activeTab === 'dms' && !selectedDM) {
      // Clear messages when no DM is selected
      setDmMessages([]);
    }
  }, [selectedDM, activeTab, user?.steamId, isAdmin, dmStream.isConnected, dmChatDisabled]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, dmMessages]);

  // Typing indicator handler
  const handleTyping = async () => {
    if (!user?.steamId || isTyping) return;
    
    const channel = activeTab === 'global' ? 'global' : selectedDM || 'global';
    
    try {
      await fetch('/api/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamId: user.steamId,
          steamName: user.name,
          channel,
        }),
      });
      
      setIsTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 5000);
    } catch (error) {
      // Ignore typing errors
    }
  };

  // Poll for typing indicators
  useEffect(() => {
    if (!user?.steamId) return;
    
    const channel = activeTab === 'global' ? 'global' : selectedDM || 'global';
    const pollTyping = async () => {
      try {
        const res = await fetch(`/api/chat/typing?channel=${channel}&currentUserId=${user.steamId}`);
        if (res.ok) {
          const data = await res.json();
          setTypingUsers(data.typingUsers || []);
        }
      } catch (error) {
        // Ignore errors
      }
    };
    
    pollTyping();
    const interval = setInterval(pollTyping, 1000); // Faster typing indicator updates
    return () => clearInterval(interval);
  }, [activeTab, selectedDM, user?.steamId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || sending) return;

    const messageText = message.trim();
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    // Optimistically add message to UI immediately
    const optimisticMessage = {
      id: tempId,
      steamId: user.steamId,
      steamName: user.name || 'You',
      avatar: user.avatar || '',
      message: messageText,
      timestamp: new Date(),
      isPro: user.isPro || false,
      isBanned: false,
      isTimedOut: false,
      timeoutUntil: null,
      isPinned: false,
    };

    if (activeTab === 'global') {
      // Use useOptimistic to add message optimistically
      addOptimisticMessage(optimisticMessage);
    } else if (activeTab === 'dms' && selectedDM) {
      const [steamId1, steamId2] = selectedDM.split('_');
      const receiverId = steamId1 === user.steamId ? steamId2 : steamId1;
      const optimisticDMMessage = {
        id: tempId,
        dmId: selectedDM,
        senderId: user.steamId,
        receiverId,
        senderName: user.name || 'You',
        senderAvatar: user.avatar || '',
        senderIsPro: user.isPro || false,
        message: messageText,
        timestamp: new Date(),
        isBanned: false,
        isTimedOut: false,
      };
      
      // Use useOptimistic to add message optimistically
      addOptimisticDMMessage(optimisticDMMessage);
      
      // Update DM list optimistically and persist
      setDmList(prev => {
        const updated = prev.map(dm => 
          dm.dmId === selectedDM 
            ? { ...dm, lastMessage: messageText, lastMessageTime: new Date() }
            : dm
        );
        if (user?.steamId) {
          saveDMList(updated, user.steamId);
        }
        return updated;
      });
    }

    // Clear input immediately
    setMessage('');
    setSending(true);
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
    // Send in background
    try {
      if (activeTab === 'global') {
        // Use server action with useOptimistic
        const result = await sendGlobalMessage(user.steamId, messageText);

        if (result.success) {
          // Server action succeeded - Pusher will update messages via usePusherChat hook
          // The optimistic message will be replaced by the real one from Pusher
          // No need to manually refresh - Pusher handles it
          clearCache('global', 'global');
        } else {
          // Remove failed optimistic message
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          toast.error(result.error || 'Failed to send message');
        }
      } else if (activeTab === 'dms' && selectedDM) {
        const [steamId1, steamId2] = selectedDM.split('_');
        const receiverId = steamId1 === user.steamId ? steamId2 : steamId1;
        
        // Use server action with useOptimistic
        const result = await sendDMMessage(user.steamId, receiverId, messageText);

        if (result.success) {
          // Server action succeeded - Pusher will update messages via usePusherChat hook
          // The optimistic message will be replaced by the real one from Pusher
          // No need to manually refresh - Pusher handles it
          fetchDMList().catch(() => {});
        } else {
          // Remove failed optimistic message
          setDmMessages(prev => prev.filter(msg => msg.id !== tempId));
          toast.error(result.error || 'Failed to send message');
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove failed message
      if (activeTab === 'global') {
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
      } else {
        // Remove failed optimistic DM message
        setDmMessages(prev => prev.filter(msg => msg.id !== tempId));
      }
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendDMInvite = async () => {
    if (!newUserSteamId.trim() || !user?.steamId || sendingInvite) return;

    setSendingInvite(true);
    try {
      // Use server action
      const result = await sendDMInvite(user.steamId, newUserSteamId.trim());

      if (result.success) {
        toast.success('DM invite sent!');
        setNewUserSteamId('');
        setShowAddUser(false);
        await fetchDMInvites();
      } else {
        toast.error(result.error || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Failed to send DM invite:', error);
      toast.error('Failed to send invite');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    if (!user?.steamId) return;
    
    try {
      // Get the invite before it's removed from the list (for optimistic update)
      const invite = dmInvites.find(i => i.id === inviteId);
      const otherUserId = invite?.otherUserId;
      const dmId = otherUserId ? [user.steamId, otherUserId].sort().join('_') : null;
      
      // Optimistically update invites list
      setDmInvites(prev => prev.filter(i => i.id !== inviteId));
      
      // Optimistically add DM to list if we have the info
      if (dmId && otherUserId && invite) {
        const optimisticDM: DM = {
          dmId,
          otherUserId,
          otherUserName: invite.otherUserName,
          otherUserAvatar: invite.otherUserAvatar,
          lastMessage: 'No messages yet',
          lastMessageTime: new Date(),
        };
        setDmList(prev => {
          // Check if DM already exists
          const exists = prev.some(dm => dm.dmId === dmId);
          if (!exists) {
            const updated = [optimisticDM, ...prev];
            if (user?.steamId) {
              saveDMList(updated, user.steamId);
            }
            return updated;
          }
          return prev;
        });
      }
      
      // Mark invite as read when accepted
      markInviteAsRead(inviteId, user.steamId);
      
      // Use server action
      const result = await acceptDMInvite(inviteId, user.steamId);

      if (result.success) {
        // Refresh invites to get updated list
        await fetchDMInvites();
        
        // Refresh DM list to get server data
        await fetchDMList();
        
        // Open the DM if we have the ID
        if (dmId && otherUserId) {
          setSelectedDM(dmId);
          markDMAsRead(dmId, user.steamId);
          fetchDMMessages(user.steamId, otherUserId);
        }
        
        toast.success('DM invite accepted!');
      } else {
        // Revert optimistic updates on error
        await fetchDMInvites();
        await fetchDMList();
        toast.error(result.error || 'Failed to accept invite');
      }
    } catch (error) {
      console.error('Failed to accept invite:', error);
      // Revert optimistic updates on error
      await fetchDMInvites();
      await fetchDMList();
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
        // Mark invite as read when declined (to remove from unread count)
        markInviteAsRead(inviteId, user?.steamId || '');
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

    // Optimistically remove message immediately from base state
    // This ensures it stays deleted even after reload
    if (messageType === 'global') {
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== messageId);
        // Clear cache to prevent reload from showing deleted message
        clearCache('global', 'global');
        // Update cache with filtered messages
        setCachedMessages('global', filtered, messageCursor, 'global');
        return filtered;
      });
      toast.success('Message deleted');
    } else if (selectedDM) {
      setDmMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== messageId);
        // Clear cache to prevent reload from showing deleted message
        clearCache(selectedDM, 'dm');
        // Update cache with filtered messages
        setCachedMessages(selectedDM, filtered, null, 'dm');
        return filtered;
      });
      toast.success('Message deleted');
    }

    // Delete in background
    try {
      const url = messageType === 'global'
        ? `/api/chat/messages/${messageId}?userSteamId=${user.steamId}&type=global`
        : `/api/chat/messages/${messageId}?userSteamId=${user.steamId}&type=dm&dmId=${selectedDM}`;
      
      const res = await fetch(url, {
        method: 'DELETE',
        cache: 'no-store', // Prevent caching
      });

      if (!res.ok) {
        // Revert on error
        const data = await res.json();
        toast.error(data.error || 'Failed to delete message');
        if (messageType === 'global') {
          // Clear cache and refetch
          clearCache('global', 'global');
          fetchMessages(null, false).catch(() => {}); // Reset cursor, load from beginning
        } else if (selectedDM) {
          const [steamId1, steamId2] = selectedDM.split('_');
          clearCache(selectedDM, 'dm');
          fetchDMMessages(steamId1, steamId2).catch(() => {});
        }
      } else {
        // Success - ensure cache is updated with deleted message removed
        if (messageType === 'global') {
          setMessages(prev => {
            const filtered = prev.filter(msg => msg.id !== messageId);
            setCachedMessages('global', filtered, messageCursor, 'global');
            return filtered;
          });
        } else if (selectedDM) {
          setDmMessages(prev => {
            const filtered = prev.filter(msg => msg.id !== messageId);
            setCachedMessages(selectedDM, filtered, null, 'dm');
            return filtered;
          });
        }
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
      // Revert on error
      if (messageType === 'global') {
        clearCache('global', 'global');
        fetchMessages(null, false).catch(() => {}); // Reset cursor, load from beginning
      } else if (selectedDM) {
        const [steamId1, steamId2] = selectedDM.split('_');
        clearCache(selectedDM, 'dm');
        fetchDMMessages(steamId1, steamId2).catch(() => {});
      }
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
        await fetchMessages(null, false); // Refresh messages to show timeout badge
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
        await fetchMessages(null, false); // Refresh messages to show banned badge
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

  const handleUnban = async () => {
    if (!unbanUser || !isAdmin) return;

    setUnbanning(true);
    try {
      const res = await fetch(`/api/admin/ban?steamId=${unbanUser.steamId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });

      if (res.ok) {
        toast.success(`User ${unbanUser.name} has been unbanned`);
        setUnbanUser(null);
        await fetchMessages(null, false); // Refresh messages
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to unban user');
      }
    } catch (error) {
      console.error('Failed to unban user:', error);
      toast.error('Failed to unban user');
    } finally {
      setUnbanning(false);
    }
  };

  const handleEditMessage = (messageId: string, currentText: string, messageType: 'global' | 'dm') => {
    setEditingMessage({ id: messageId, type: messageType, currentText });
    setEditText(currentText);
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim() || !user?.steamId || editing) return;

    // Store values before clearing state
    const messageType = editingMessage.type;
    const messageId = editingMessage.id;
    const updatedText = editText.trim();
    
    setEditing(true);
    
    // Optimistically update the message in local state for instant UI feedback
    if (messageType === 'global') {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, message: updatedText, editedAt: new Date() }
          : msg
      ));
    } else {
      setDmMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, message: updatedText, editedAt: new Date() }
          : msg
      ));
    }
    
    // Clear editing state immediately
    setEditingMessage(null);
    setEditText('');
    setEditing(false);
    
    // Show success toast immediately
    toast.success('Message edited');
    
    // Update in background (non-blocking)
    try {
      const url = messageType === 'global'
        ? `/api/chat/messages/${messageId}?userSteamId=${user.steamId}&type=global`
        : `/api/chat/messages/${messageId}?userSteamId=${user.steamId}&type=dm&dmId=${selectedDM}`;
      
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newMessage: updatedText }),
      });

      if (!res.ok) {
        // If update failed, revert optimistic update and refetch
        const data = await res.json();
        toast.error(data.error || 'Failed to edit message');
        if (messageType === 'global') {
          fetchMessages(null, false); // Reset cursor, load from beginning
        } else if (selectedDM) {
          const [steamId1, steamId2] = selectedDM.split('_');
          fetchDMMessages(steamId1, steamId2);
        }
      } else {
        // Silently refresh to get server timestamp
        if (messageType === 'global') {
          fetchMessages(null, false).catch(() => {}); // Ignore errors in background refresh
        } else if (selectedDM) {
          const [steamId1, steamId2] = selectedDM.split('_');
          fetchDMMessages(steamId1, steamId2).catch(() => {}); // Ignore errors in background refresh
        }
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
      // Revert optimistic update on error
      if (messageType === 'global') {
        fetchMessages(null, false); // Reset cursor, load from beginning
      } else if (selectedDM) {
        const [steamId1, steamId2] = selectedDM.split('_');
        fetchDMMessages(steamId1, steamId2);
      }
    }
  };

  const handlePinMessage = async (messageId: string, messageType: 'global' | 'dm') => {
    if (!isAdmin || !user?.steamId) return;

    try {
      const res = await fetch(`/api/admin/chat/pin?adminSteamId=${user.steamId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, messageType }),
      });

      if (res.ok) {
        toast.success('Message pinned');
        if (messageType === 'global') {
          await fetchMessages(null, false);
        } else if (selectedDM) {
          const [steamId1, steamId2] = selectedDM.split('_');
          await fetchDMMessages(steamId1, steamId2);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to pin message');
      }
    } catch (error) {
      console.error('Failed to pin message:', error);
      toast.error('Failed to pin message');
    }
  };

  const handleUnpinMessage = async (messageId: string) => {
    if (!isAdmin || !user?.steamId) return;

    try {
      const res = await fetch(`/api/admin/chat/pin?adminSteamId=${user.steamId}&messageId=${messageId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Message unpinned');
        if (activeTab === 'global') {
          await fetchMessages(null, false);
        } else if (selectedDM) {
          const [steamId1, steamId2] = selectedDM.split('_');
          await fetchDMMessages(steamId1, steamId2);
        }
        // Refresh pinned messages list
        fetchPinnedMessages();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to unpin message');
      }
    } catch (error) {
      console.error('Failed to unpin message:', error);
      toast.error('Failed to unpin message');
    }
  };

  const fetchPinnedMessages = async () => {
    try {
      const res = await fetch('/api/admin/chat/pin');
      if (res.ok) {
        const { pinnedMessages: pinnedData } = await res.json();
        // Fetch full message details for pinned messages
        const pinnedList: Array<{ id: string; message: string; timestamp: string; steamName: string; avatar: string; messageType: 'global' | 'dm'; dmId?: string }> = [];
        
        for (const pinned of pinnedData) {
          if (pinned.messageType === 'global') {
            // Find in global messages
            const msg = messages.find(m => m.id === pinned.id);
            if (msg) {
              pinnedList.push({
                id: msg.id || '',
                message: msg.message,
                timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : msg.timestamp.toISOString(),
                steamName: msg.steamName,
                avatar: msg.avatar,
                messageType: 'global',
              });
            }
          } else {
            // Find in DM messages
            const msg = dmMessages.find(m => m.id === pinned.id);
            if (msg) {
              pinnedList.push({
                id: msg.id || '',
                message: msg.message,
                timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : msg.timestamp.toISOString(),
                steamName: msg.senderName,
                avatar: msg.senderAvatar,
                messageType: 'dm',
                dmId: msg.dmId,
              });
            }
          }
        }
        
        setPinnedMessages(pinnedList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }
    } catch (error) {
      console.error('Failed to fetch pinned messages:', error);
    }
  };

  const handleViewPinnedMessage = (pinned: { id: string; messageType: 'global' | 'dm'; dmId?: string }) => {
    setViewingPinnedMessageId(pinned.id);
    setShowPinnedMessages(false);
    
    if (pinned.messageType === 'dm' && pinned.dmId) {
      // Switch to DM tab and select the DM
      setActiveTab('dms');
      setSelectedDM(pinned.dmId);
      // Scroll to message after a short delay
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${pinned.id}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the message
          messageElement.classList.add('ring-2', 'ring-yellow-400', 'ring-opacity-50');
          setTimeout(() => {
            messageElement.classList.remove('ring-2', 'ring-yellow-400', 'ring-opacity-50');
          }, 3000);
        }
      }, 500);
    } else {
      // Switch to global tab
      setActiveTab('global');
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${pinned.id}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the message
          messageElement.classList.add('ring-2', 'ring-yellow-400', 'ring-opacity-50');
          setTimeout(() => {
            messageElement.classList.remove('ring-2', 'ring-yellow-400', 'ring-opacity-50');
          }, 3000);
        }
      }, 500);
    }
  };

  useEffect(() => {
    if (showPinnedMessages) {
      fetchPinnedMessages();
    }
  }, [showPinnedMessages, messages, dmMessages]);


  const handleBlockUser = async (steamId: string, userName: string) => {
    if (!user?.steamId || blocking) return;

    // Optimistically update UI immediately
    setBlockedUsers(prev => new Set([...prev, steamId]));
    toast.success(`Blocked ${userName}`);
    
    if (activeTab === 'dms' && selectedDM) {
      const [steamId1, steamId2] = selectedDM.split('_');
      if (steamId === steamId1 || steamId === steamId2) {
        setSelectedDM(null);
      }
    }

    // Update in background
    try {
      const res = await fetch('/api/user/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockerSteamId: user.steamId,
          blockedSteamId: steamId,
        }),
      });

      if (!res.ok) {
        // Revert on error
        setBlockedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(steamId);
          return newSet;
        });
        const data = await res.json();
        toast.error(data.error || 'Failed to block user');
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      // Revert on error
      setBlockedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(steamId);
        return newSet;
      });
      toast.error('Failed to block user');
    }
  };

  const handleUnblockUser = async (steamId: string) => {
    if (!user?.steamId || blocking) return;

    // Optimistically update UI immediately
    const wasBlocked = blockedUsers.has(steamId);
    setBlockedUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(steamId);
      return newSet;
    });
    toast.success('User unblocked');

    // Update in background
    try {
      const res = await fetch(`/api/user/block?blockerSteamId=${user.steamId}&blockedSteamId=${steamId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Revert on error
        if (wasBlocked) {
          setBlockedUsers(prev => new Set([...prev, steamId]));
        }
        const data = await res.json();
        toast.error(data.error || 'Failed to unblock user');
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
      // Revert on error
      if (wasBlocked) {
        setBlockedUsers(prev => new Set([...prev, steamId]));
      }
      toast.error('Failed to unblock user');
    }
  };

  // Check blocked users when messages change
  useEffect(() => {
    if (!user?.steamId) return;
    
    const checkBlockedUsers = async () => {
      const allUserIds = new Set<string>();
      messages.forEach(msg => {
        if (msg.steamId !== user.steamId) {
          allUserIds.add(msg.steamId);
        }
      });
      dmMessages.forEach(msg => {
        if (msg.senderId !== user.steamId) {
          allUserIds.add(msg.senderId);
        }
      });
      
      if (allUserIds.size === 0) return;
      
      const blockedSet = new Set<string>();
      for (const userId of allUserIds) {
        try {
          const res = await fetch(`/api/user/block?steamId1=${user.steamId}&steamId2=${userId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.isBlocked) {
              blockedSet.add(userId);
            }
          }
        } catch (error) {
          // Ignore errors
        }
      }
      
      setBlockedUsers(blockedSet);
    };
    
    checkBlockedUsers();
  }, [user?.steamId, messages.length, dmMessages.length]);

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
                className={`px-4 py-2 rounded-lg font-bold transition-colors relative ${
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
                className={`px-4 py-2 rounded-lg font-bold transition-colors relative ${
                  activeTab === 'dms'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#08090d] text-gray-400 hover:text-white'
                }`}
              >
                <Users size={16} className="inline mr-2" />
                DMs
                {unreadCounts.total > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-full">
                    {unreadCounts.total > 99 ? '99+' : unreadCounts.total}
                  </span>
                )}
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {activeTab === 'global' ? 'Messages reset every 24 hours' : 'Messages reset after 365 days'}
          </p>
          {activeTab === 'global' && showFilters && (
            <div className="mt-4 p-4 bg-[#08090d] border border-white/10 rounded-lg space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Filter by User (Steam ID)</label>
                  <input
                    type="text"
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                    placeholder="Enter Steam ID..."
                    className="w-full bg-[#11141d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Date From</label>
                  <input
                    type="datetime-local"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full bg-[#11141d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Date To</label>
                  <input
                    type="datetime-local"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full bg-[#11141d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterPinnedOnly}
                    onChange={(e) => setFilterPinnedOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-[#11141d] text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Pinned messages only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterProOnly}
                    onChange={(e) => setFilterProOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-[#11141d] text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Pro users only</span>
                </label>
                <button
                  onClick={() => {
                    setMessageCursor(null); // Reset cursor when applying filters
                    fetchMessages(null, false);
                  }}
                  className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'global' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative">
            {globalChatDisabled ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Ban size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-bold mb-2">Global Chat is Disabled</p>
                  <p className="text-sm">Global chat is currently disabled by an administrator.</p>
                </div>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No messages yet. Be the first to chat!</p>
              </div>
            ) : (
              <>
                {optimisticMessages.map((msg) => (
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
                      {msg.isPinned && (
                        <Pin size={12} className="text-yellow-400" />
                      )}
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
                      <MessageActionMenu
                        messageId={msg.id}
                        steamId={msg.steamId}
                        userName={msg.steamName}
                        isOwnMessage={msg.steamId === user?.steamId}
                        isAdmin={isAdmin}
                        isBanned={msg.isBanned}
                        isBlocked={blockedUsers.has(msg.steamId)}
                        isPinned={msg.isPinned}
                        onReport={msg.steamId !== user?.steamId ? () => setReportUser({ steamId: msg.steamId, name: msg.steamName, type: 'global' }) : undefined}
                        onDelete={msg.id && (msg.steamId === user?.steamId || isAdmin) ? () => handleDeleteMessage(msg.id!, 'global') : undefined}
                        onEdit={msg.id ? () => handleEditMessage(msg.id!, msg.message, 'global') : undefined}
                        onPin={isAdmin && msg.id && !msg.isPinned ? () => handlePinMessage(msg.id!, 'global') : undefined}
                        onUnpin={isAdmin && msg.id && msg.isPinned ? () => handleUnpinMessage(msg.id!) : undefined}
                        onBan={isAdmin ? () => setBanUser({ steamId: msg.steamId, name: msg.steamName }) : undefined}
                        onUnban={isAdmin && msg.isBanned ? () => setUnbanUser({ steamId: msg.steamId, name: msg.steamName }) : undefined}
                        onTimeout={isAdmin ? () => setTimeoutUser({ steamId: msg.steamId, name: msg.steamName }) : undefined}
                        onBlock={msg.steamId !== user?.steamId ? () => handleBlockUser(msg.steamId, msg.steamName) : undefined}
                        onUnblock={msg.steamId !== user?.steamId && blockedUsers.has(msg.steamId) ? () => handleUnblockUser(msg.steamId) : undefined}
                      />
                      <span className="text-xs text-gray-500 ml-auto">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    {editingMessage?.id === msg.id && editingMessage?.type === 'global' ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-[#08090d] border border-white/10 rounded-lg p-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={editing || !editText.trim()}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold transition-colors"
                          >
                            {editing ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingMessage(null);
                              setEditText('');
                            }}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs font-bold transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300 break-words">
                        {msg.message}
                        {msg.editedAt && (
                          <span className="text-xs text-gray-500 ml-2 italic">(edited)</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              ))}
              {hasMoreMessages && (
                <div className="flex justify-center py-4">
                            <button
                    onClick={() => {
                      // Use cursor for next page (load older messages)
                      fetchMessages(messageCursor, true);
                    }}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-sm transition-colors"
                            >
                    Load More Messages
                            </button>
                </div>
              )}
            {typingUsers.length > 0 && (
              <div className="text-xs text-gray-400 italic px-4 py-2">
                {typingUsers.map((u, i) => (
                  <span key={u.steamId}>
                    {u.steamName} is typing...
                    {i < typingUsers.length - 1 && ', '}
                  </span>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
              </>
            )}
            
            {/* Pinned Messages Panel */}
            {showPinnedMessages && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-[#11141d] rounded-2xl border border-white/10 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Pin size={20} className="text-yellow-400" />
                      Pinned Messages
                    </h3>
                            <button
                      onClick={() => setShowPinnedMessages(false)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                      <X size={20} className="text-gray-400" />
                            </button>
                      </div>
                  
                  {pinnedMessages.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No pinned messages</p>
                  ) : (
                    <div className="space-y-3">
                      {pinnedMessages.map((pinned) => (
                        <div
                          key={pinned.id}
                          className="bg-[#08090d] border border-white/10 rounded-lg p-4 hover:border-yellow-500/40 transition-colors cursor-pointer"
                          onClick={() => handleViewPinnedMessage(pinned)}
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={pinned.avatar || '/icons/web-app-manifest-192x192.png'}
                              alt={pinned.steamName}
                              className="w-10 h-10 rounded-lg border-2 border-yellow-500/40 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-white">{pinned.steamName}</span>
                                <span className="text-xs text-gray-500">
                                  {pinned.messageType === 'global' ? 'Global Chat' : 'DM'}
                      </span>
                                <Pin size={12} className="text-yellow-400" />
                    </div>
                              <p className="text-sm text-gray-300 mb-2 line-clamp-2">{pinned.message}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(pinned.timestamp).toLocaleString()}
                              </p>
                  </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewPinnedMessage(pinned);
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold transition-colors"
                            >
                              View
                            </button>
                </div>
              </div>
                      ))}
                    </div>
            )}
                </div>
              </div>
            )}
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
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 font-bold uppercase">Pending Invites</p>
                    {unreadCounts.invites > 0 && (
                      <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-full">
                        {unreadCounts.invites}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {dmInvites.map((invite) => {
                      const isUnread = !invite.isSent && unreadCounts.invites > 0;
                      return (
                      <div key={invite.id} className={`bg-[#08090d] p-2 rounded-lg border ${isUnread ? 'border-red-500/40' : 'border-transparent'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={invite.otherUserAvatar || '/icons/web-app-manifest-192x192.png'}
                            alt={invite.otherUserName}
                            className="w-8 h-8 rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold truncate">{invite.otherUserName}</p>
                              {isUnread && (
                                <span className="w-2 h-2 bg-red-600 rounded-full flex-shrink-0"></span>
                              )}
                            </div>
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
                      );
                    })}
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
                    {dmList.map((dm) => {
                      // Get unread count for this DM
                      const unreadDms = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('sv_unread_dms') || '{}' : '{}');
                      const dmUnread = unreadDms[dm.dmId]?.count || 0;
                      const hasUnread = dmUnread > 0;
                      
                      return (
                      <div
                        key={dm.dmId}
                        className={`w-full p-3 rounded-lg transition-all flex items-start gap-3 border ${
                          selectedDM === dm.dmId
                            ? 'bg-blue-600/20 border-blue-500/40 shadow-lg shadow-blue-500/20'
                            : hasUnread
                            ? 'bg-[#08090d] hover:bg-[#11141d] border-red-500/40 hover:border-red-500/60'
                            : 'bg-[#08090d] hover:bg-[#11141d] border-transparent hover:border-white/5'
                        }`}
                      >
                        <button
                          onClick={() => setSelectedDM(dm.dmId)}
                          className="flex-1 text-left flex items-start gap-3 min-w-0"
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={dm.otherUserAvatar || '/icons/web-app-manifest-192x192.png'}
                            alt={dm.otherUserName || 'User'}
                            className="w-10 h-10 rounded-lg border-2 border-blue-600"
                          />
                          {hasUnread && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                              {dmUnread > 9 ? '9+' : dmUnread}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-bold truncate text-white">
                              {dm.otherUserName || `User ${dm.otherUserId.slice(-4)}`}
                            </p>
                            {hasUnread && (
                              <span className="w-2 h-2 bg-red-600 rounded-full flex-shrink-0"></span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 truncate">{dm.lastMessage}</p>
                          <p className="text-[9px] text-gray-500 mt-1">
                            {formatTime(dm.lastMessageTime)}
                          </p>
                        </div>
                      </button>
                      </div>
                      );
                    })}
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
                      optimisticDMMessages.map((msg) => (
                        <div
                          key={msg.id || `${msg.senderId}-${msg.timestamp}`}
                          data-message-id={msg.id}
                          className={`bg-[#11141d] p-4 rounded-xl border border-white/5 group ${
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
                                <div className="ml-auto flex items-center gap-2">
                                  {msg.isPinned && (
                                    <Pin size={12} className="text-yellow-400" />
                                  )}
                                  <MessageActionMenu
                                    messageId={msg.id}
                                    steamId={msg.senderId}
                                    userName={msg.senderName}
                                    isOwnMessage={msg.senderId === user?.steamId}
                                    isAdmin={isAdmin}
                                    isBanned={msg.isBanned}
                                    isBlocked={blockedUsers.has(msg.senderId)}
                                    isPinned={msg.isPinned}
                                    onReport={msg.senderId !== user?.steamId ? () => setReportUser({ 
                                        steamId: msg.senderId, 
                                        name: msg.senderName, 
                                        type: 'dm',
                                        dmId: selectedDM || undefined
                                    }) : undefined}
                                    onDelete={msg.id && (msg.senderId === user?.steamId || isAdmin) ? () => handleDeleteMessage(msg.id!, 'dm') : undefined}
                                    onEdit={msg.id ? () => handleEditMessage(msg.id!, msg.message, 'dm') : undefined}
                                    onPin={isAdmin && msg.id && !msg.isPinned ? () => handlePinMessage(msg.id!, 'dm') : undefined}
                                    onUnpin={isAdmin && msg.id && msg.isPinned ? () => handleUnpinMessage(msg.id!) : undefined}
                                    onBan={isAdmin ? () => setBanUser({ steamId: msg.senderId, name: msg.senderName }) : undefined}
                                    onUnban={isAdmin && msg.isBanned ? () => setUnbanUser({ steamId: msg.senderId, name: msg.senderName }) : undefined}
                                    onTimeout={isAdmin ? () => setTimeoutUser({ steamId: msg.senderId, name: msg.senderName }) : undefined}
                                    onBlock={msg.senderId !== user?.steamId ? () => handleBlockUser(msg.senderId, msg.senderName) : undefined}
                                    onUnblock={msg.senderId !== user?.steamId && blockedUsers.has(msg.senderId) ? () => handleUnblockUser(msg.senderId) : undefined}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">
                                  {formatTime(msg.timestamp)}
                                </span>
                              </div>
                              {editingMessage?.id === msg.id && editingMessage?.type === 'dm' ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full bg-[#08090d] border border-white/10 rounded-lg p-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={handleSaveEdit}
                                      disabled={editing || !editText.trim()}
                                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold transition-colors"
                                    >
                                      {editing ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingMessage(null);
                                        setEditText('');
                                      }}
                                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs font-bold transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-300 break-words">
                                  {msg.message}
                                  {msg.editedAt && (
                                    <span className="text-xs text-gray-500 ml-2 italic">(edited)</span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {typingUsers.length > 0 && (
                      <div className="text-xs text-gray-400 italic px-4 py-2">
                        {typingUsers.map((u, i) => (
                          <span key={u.steamId}>
                            {u.steamName} is typing...
                            {i < typingUsers.length - 1 && ', '}
                          </span>
                        ))}
                      </div>
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

        {/* Unban Modal */}
        {unbanUser && isAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#11141d] p-6 rounded-2xl border border-emerald-500/30 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4 text-emerald-400">Unban User</h3>
              <p className="text-gray-400 mb-4">Are you sure you want to unban <strong>{unbanUser.name}</strong>?</p>
              <p className="text-sm text-emerald-400 mb-4">This will restore their access to chat and other features.</p>
              <div className="flex gap-3">
                <button
                  onClick={handleUnban}
                  disabled={unbanning}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {unbanning ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Confirm Unban'}
                </button>
                <button
                  onClick={() => setUnbanUser(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'global' || (activeTab === 'dms' && selectedDM)) && !(activeTab === 'global' && globalChatDisabled) && !(activeTab === 'dms' && dmChatDisabled) && (
          <>
            {editingMessage && editingMessage.type === activeTab && (
              <div className="bg-yellow-500/10 border-t border-yellow-500/20 p-3 flex items-center justify-between">
                <span className="text-sm text-yellow-400">Editing message...</span>
                <button
                  onClick={() => {
                    setEditingMessage(null);
                    setEditText('');
                  }}
                  className="text-yellow-400 hover:text-yellow-300"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          <form onSubmit={handleSend} className="bg-[#11141d] border-t border-white/5 p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder={activeTab === 'global' ? 'Type a message...' : 'Type a DM...'}
                className="flex-1 bg-[#08090d] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                maxLength={500}
                disabled={activeTab === 'global' ? globalChatDisabled : dmChatDisabled || !!editingMessage}
              />
              <button
                type="submit"
                disabled={!message.trim() || sending || (activeTab === 'dms' && !selectedDM) || (activeTab === 'global' && globalChatDisabled) || (activeTab === 'dms' && dmChatDisabled)}
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
          </>
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

