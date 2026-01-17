import { NextResponse } from 'next/server';
import { getProUntil } from '@/app/utils/pro-storage';
import { getTodayCollectionName, getCollectionNamesForDays } from '@/app/utils/chat-collections';
import { getChatDatabase } from '@/app/utils/mongodb-client';
import Pusher from 'pusher';

interface ChatMessage {
  _id?: string;
  steamId: string;
  steamName: string;
  avatar: string;
  message: string;
  timestamp: Date;
  isPro: boolean;
  editedAt?: Date;
}

interface UserInfo {
  steamId: string;
  steamName: string;
  avatar: string;
  isPro: boolean;
}

// Fetch current Steam profile information using server-side API route
export async function fetchSteamProfile(steamId: string): Promise<{ name: string; avatar: string }> {
  try {
    // Use internal server-side fetch (no proxies needed)
    const baseUrl =
      (process.env.NEXT_PUBLIC_BASE_URL && String(process.env.NEXT_PUBLIC_BASE_URL).trim()) ||
      (process.env.VERCEL_URL && `https://${String(process.env.VERCEL_URL).trim()}`) ||
      'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/steam/profile?steamId=${steamId}`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    
    if (res.ok) {
      const data = await res.json();
      return { name: data.name || 'Unknown User', avatar: data.avatar || '' };
    }
  } catch (error) {
    // Silently fail
  }
  
  return { name: 'Unknown User', avatar: '' };
}

// Get current user info for all unique users in messages
export async function getCurrentUserInfo(uniqueSteamIds: string[]): Promise<Map<string, UserInfo>> {
  const userInfoMap = new Map<string, UserInfo>();
  
  // Fetch all user info in parallel
  const userInfoPromises = uniqueSteamIds.map(async (steamId) => {
    try {
      const [profileInfo, proUntil] = await Promise.all([
        fetchSteamProfile(steamId),
        getProUntil(steamId),
      ]);
      
      const isPro = proUntil ? new Date(proUntil) > new Date() : false;
      
      return {
        steamId,
        steamName: profileInfo.name,
        avatar: profileInfo.avatar,
        isPro,
      };
    } catch (error) {
      console.error(`Failed to get user info for ${steamId}:`, error);
      return {
        steamId,
        steamName: 'Unknown User',
        avatar: '',
        isPro: false,
      };
    }
  });
  
  const userInfos = await Promise.all(userInfoPromises);
  userInfos.forEach(info => {
    userInfoMap.set(info.steamId, info);
  });
  
  return userInfoMap;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Cursor-based pagination: use beforeTimestamp instead of page number
    const beforeTimestamp = searchParams.get('beforeTimestamp');
    const beforeTimestampDate = beforeTimestamp ? new Date(beforeTimestamp) : null;
    const searchQuery = searchParams.get('search') || '';
    const filterUser = searchParams.get('user') || '';
    const filterDateFrom = searchParams.get('dateFrom') || '';
    const filterDateTo = searchParams.get('dateTo') || '';
    const filterPinnedOnly = searchParams.get('pinnedOnly') === 'true';
    const filterProOnly = searchParams.get('proOnly') === 'true';
    const pageSize = 50; // Reduced from 100 for faster loading

    // Get banned and timeout users (disable cache for real-time status)
    const { dbGet, dbSet } = await import('@/app/utils/database');
    const bannedUsers = await dbGet<string[]>('banned_steam_ids', false) || [];
    const timeoutUsers = await dbGet<Record<string, string>>('timeout_users', false) || {};
    
    // Clean up expired timeouts
    const now = new Date();
    const activeTimeouts: Record<string, string> = {};
    for (const [id, timeoutUntil] of Object.entries(timeoutUsers)) {
      if (new Date(timeoutUntil) > now) {
        activeTimeouts[id] = timeoutUntil;
      }
    }
    if (Object.keys(activeTimeouts).length !== Object.keys(timeoutUsers).length) {
      await dbSet('timeout_users', activeTimeouts);
    }

    // Use connection pool
    const db = await getChatDatabase();

    // Get messages from last 24 hours using date-based collections
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateFrom = filterDateFrom ? new Date(filterDateFrom) : twentyFourHoursAgo;
    const dateTo = filterDateTo ? new Date(filterDateTo) : new Date();
    
    const collectionNames = getCollectionNamesForDays(2); // Get today and yesterday collections
    
    // Build query filter with cursor-based pagination
    const queryFilter: any = {
      timestamp: { $gte: dateFrom, $lte: dateTo }
    };
    
    // Cursor-based pagination: get messages before the cursor timestamp
    if (beforeTimestampDate) {
      queryFilter.timestamp = {
        ...queryFilter.timestamp,
        $lt: beforeTimestampDate // Get messages older than cursor
      };
    }
    
    if (filterUser) {
      queryFilter.steamId = filterUser;
    }
    
    if (filterProOnly) {
      queryFilter.isPro = true;
    }
    
    // Apply text search if provided
    if (searchQuery) {
      queryFilter.message = { $regex: searchQuery, $options: 'i' };
    }
    
    // Query collections in reverse order (newest first) and stop when we have enough
    // This avoids querying old collections unnecessarily
    const messagePromises = collectionNames.reverse().map(async (collectionName) => {
      const collection = db.collection<ChatMessage>(collectionName);
      // Use projection to only fetch needed fields (reduces network transfer)
      const projection = {
        _id: 1,
        steamId: 1,
        steamName: 1,
        avatar: 1,
        message: 1,
        timestamp: 1,
        editedAt: 1,
        isPro: 1,
      };
      
      // Limit per collection to avoid fetching too much
      // Use lean() equivalent - return plain objects instead of full documents
      return collection
        .find(queryFilter, { projection })
        .sort({ timestamp: -1 }) // Sort descending (newest first) for cursor pagination
        .limit(pageSize + 1) // Fetch one extra to check if there are more
        .toArray() as Promise<ChatMessage[]>;
    });
    
    // Process collections sequentially until we have enough messages
    let allMessages: ChatMessage[] = [];
    for (const promise of messagePromises) {
      const messages = await promise;
      allMessages.push(...messages);
      
      // If we have enough messages, stop querying older collections
      if (allMessages.length >= pageSize + 1) {
        break;
      }
    }
    
    // Sort by timestamp descending (newest first)
    allMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Get pinned messages if filter is enabled
    const pinnedMessages = await dbGet<Record<string, any>>('pinned_messages', false) || {};
    if (filterPinnedOnly) {
      const pinnedIds = Object.keys(pinnedMessages).filter(id => pinnedMessages[id].messageType === 'global');
      allMessages = allMessages.filter(msg => pinnedIds.includes(msg._id?.toString() || ''));
    }
    
    // Check if there are more messages
    const hasMore = allMessages.length > pageSize;
    // Take only pageSize messages (remove the extra one we fetched)
    const messages = allMessages.slice(0, pageSize);
    // Get the oldest message timestamp for next cursor
    const nextCursor = messages.length > 0 ? messages[messages.length - 1].timestamp : null;

    // Don't close connection - it's pooled and reused

    // Get unique Steam IDs from messages
    const uniqueSteamIds = [...new Set(messages.map(msg => msg.steamId))];
    
    // Fetch current user info for all unique users
    const userInfoMap = await getCurrentUserInfo(uniqueSteamIds);

    return NextResponse.json({ 
      messages: messages.reverse().map(msg => { // Reverse to show oldest first in chat
        const currentUserInfo = userInfoMap.get(msg.steamId);
        const isBanned = bannedUsers.includes(msg.steamId);
        const timeoutUntil = timeoutUsers[msg.steamId];
        const isTimedOut = timeoutUntil && new Date(timeoutUntil) > new Date();
        const messageId = msg._id?.toString() || '';
        const isPinned = pinnedMessages[messageId]?.messageType === 'global';
        
        // Use current user info if available, otherwise fall back to stored info
        const steamName = currentUserInfo?.steamName || msg.steamName;
        const avatar = currentUserInfo?.avatar || msg.avatar;
        const isPro = currentUserInfo?.isPro ?? msg.isPro;
        
        return {
          id: messageId,
          steamId: msg.steamId,
          steamName,
          avatar,
          message: msg.message,
          timestamp: msg.timestamp,
          editedAt: msg.editedAt,
          isPro,
          isBanned,
          isTimedOut,
          timeoutUntil: isTimedOut ? timeoutUntil : null,
          isPinned,
        };
      }),
      hasMore,
      nextCursor: nextCursor?.toISOString() || null, // Return cursor for next page
    });
  } catch (error: any) {
    console.error('Failed to get chat messages:', error);
    // If MongoDB connection fails, return empty messages instead of error
    if (error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return NextResponse.json({ messages: [], hasMore: false, total: 0, page: 1 });
    }
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { steamId, steamName, avatar, message } = body;

    if (!steamId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if global chat is disabled
    const { dbGet, dbSet } = await import('@/app/utils/database');
    const globalChatDisabled = (await dbGet<boolean>('global_chat_disabled', false)) || false;
    if (globalChatDisabled) {
      return NextResponse.json({ error: 'Global chat is currently disabled' }, { status: 503 });
    }

    // Check if user is banned or timed out (disable cache for real-time checks)
    const bannedUsers = await dbGet<string[]>('banned_steam_ids', false) || [];
    const timeoutUsers = await dbGet<Record<string, string>>('timeout_users', false) || {};
    
    if (bannedUsers.includes(steamId)) {
      return NextResponse.json({ error: 'You are banned from chat' }, { status: 403 });
    }

    if (timeoutUsers[steamId]) {
      const timeoutUntil = new Date(timeoutUsers[steamId]);
      const now = new Date();
      if (timeoutUntil > now) {
        const minutesLeft = Math.ceil((timeoutUntil.getTime() - now.getTime()) / (1000 * 60));
        console.log(`[Chat] User ${steamId} is timed out until ${timeoutUntil.toISOString()}, ${minutesLeft} minutes remaining`);
        return NextResponse.json({ 
          error: `You are timed out for ${minutesLeft} more minute(s)` 
        }, { status: 403 });
      } else {
        // Timeout expired, clean it up
        delete timeoutUsers[steamId];
        await dbSet('timeout_users', timeoutUsers);
      }
    }

    // Fetch current user information (name, avatar, pro status) - optimize with timeout
    const [profileInfo, proUntil] = await Promise.all([
      Promise.race([
        fetchSteamProfile(steamId),
        new Promise<{ name: string; avatar: string }>((resolve) => 
          setTimeout(() => resolve({ name: steamName || 'Unknown User', avatar: avatar || '' }), 2000)
        )
      ]),
      getProUntil(steamId),
    ]);

    const currentSteamName = profileInfo.name || steamName || 'Unknown User';
    const currentAvatar = profileInfo.avatar || avatar || '';
    const currentIsPro = proUntil ? new Date(proUntil) > new Date() : false;

    // Use connection pool
    const db = await getChatDatabase();
    
    // Use today's date-based collection
    const collectionName = getTodayCollectionName();
    const collection = db.collection<ChatMessage>(collectionName);
    
    // Auto-setup index for new collection if needed
    const { setupIndexesForCollection } = await import('@/app/utils/mongodb-auto-index');
    setupIndexesForCollection(collectionName).catch(() => {});

    const chatMessage: ChatMessage = {
      steamId,
      steamName: currentSteamName,
      avatar: currentAvatar,
      message: message.trim(),
      timestamp: new Date(),
      isPro: currentIsPro,
    };

    await collection.insertOne(chatMessage);
    // Don't close connection - it's pooled and reused

    // Trigger Pusher event for real-time updates
    try {
      const pusherAppId = process.env.PUSHER_APP_ID;
      const pusherSecret = process.env.PUSHER_SECRET;
      const pusherCluster = process.env.PUSHER_CLUSTER || 'eu';

      if (pusherAppId && pusherSecret) {
        const pusher = new Pusher({
          appId: pusherAppId,
          key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
          secret: pusherSecret,
          cluster: pusherCluster,
          useTLS: true,
        });

        await pusher.trigger('global', 'new_messages', {
          type: 'new_messages',
          messages: [{
            id: chatMessage._id?.toString() || '',
            steamId: chatMessage.steamId,
            steamName: chatMessage.steamName,
            avatar: chatMessage.avatar,
            message: chatMessage.message,
            timestamp: chatMessage.timestamp,
            isPro: chatMessage.isPro,
          }],
        });
      }
    } catch (pusherError) {
      console.error('Failed to trigger Pusher event:', pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({ success: true, message: chatMessage });
  } catch (error: any) {
    console.error('Failed to send chat message:', error);
    // If MongoDB connection fails, return error
    if (error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return NextResponse.json({ error: 'Chat service is currently unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

