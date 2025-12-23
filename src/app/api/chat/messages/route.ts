import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getProUntil } from '@/app/utils/pro-storage';
import { getTodayCollectionName, getCollectionNamesForDays } from '@/app/utils/chat-collections';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

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

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

// Fetch current Steam profile information
export async function fetchSteamProfile(steamId: string): Promise<{ name: string; avatar: string }> {
  try {
    const steamUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
    const textRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    const text = await textRes.text();
    const name = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || 'Unknown User';
    const avatar = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || '';
    return { name, avatar };
  } catch (error) {
    console.warn(`Failed to fetch Steam profile for ${steamId}:`, error);
    return { name: 'Unknown User', avatar: '' };
  }
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
    if (!MONGODB_URI) {
      return NextResponse.json({ messages: [] });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const searchQuery = searchParams.get('search') || '';
    const filterUser = searchParams.get('user') || '';
    const filterDateFrom = searchParams.get('dateFrom') || '';
    const filterDateTo = searchParams.get('dateTo') || '';
    const filterPinnedOnly = searchParams.get('pinnedOnly') === 'true';
    const filterProOnly = searchParams.get('proOnly') === 'true';
    const pageSize = 100;
    const skip = (page - 1) * pageSize;

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

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);

    // Get messages from last 24 hours using date-based collections
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateFrom = filterDateFrom ? new Date(filterDateFrom) : twentyFourHoursAgo;
    const dateTo = filterDateTo ? new Date(filterDateTo) : new Date();
    
    const collectionNames = getCollectionNamesForDays(2); // Get today and yesterday collections
    
    // Build query filter
    const queryFilter: any = {
      timestamp: { $gte: dateFrom, $lte: dateTo }
    };
    
    if (filterUser) {
      queryFilter.steamId = filterUser;
    }
    
    if (filterProOnly) {
      queryFilter.isPro = true;
    }
    
    // Query all relevant collections in parallel
    const messagePromises = collectionNames.map(async (collectionName) => {
      const collection = db.collection<ChatMessage>(collectionName);
      let query = collection.find(queryFilter);
      
      // Apply text search if provided
      if (searchQuery) {
        query = collection.find({
          ...queryFilter,
          message: { $regex: searchQuery, $options: 'i' }
        });
      }
      
      return query.sort({ timestamp: 1 }).toArray();
    });
    
    const messageArrays = await Promise.all(messagePromises);
    let allMessages = messageArrays.flat();
    
    // Sort by timestamp
    allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Get pinned messages if filter is enabled
    const pinnedMessages = await dbGet<Record<string, any>>('pinned_messages', false) || {};
    if (filterPinnedOnly) {
      const pinnedIds = Object.keys(pinnedMessages).filter(id => pinnedMessages[id].messageType === 'global');
      allMessages = allMessages.filter(msg => pinnedIds.includes(msg._id?.toString() || ''));
    }
    
    // Pagination
    const totalMessages = allMessages.length;
    const messages = allMessages.slice(skip, skip + pageSize);
    const hasMore = skip + pageSize < totalMessages;

    await client.close();

    // Get unique Steam IDs from messages
    const uniqueSteamIds = [...new Set(messages.map(msg => msg.steamId))];
    
    // Fetch current user info for all unique users
    const userInfoMap = await getCurrentUserInfo(uniqueSteamIds);

    // Get pinned messages
    const pinnedMessages = await dbGet<Record<string, any>>('pinned_messages', false) || {};

    return NextResponse.json({ 
      messages: messages.map(msg => {
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
      total: totalMessages,
      page,
    });
  } catch (error) {
    console.error('Failed to get chat messages:', error);
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

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

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
    
    // Use today's date-based collection
    const collectionName = getTodayCollectionName();
    const collection = db.collection<ChatMessage>(collectionName);

    const chatMessage: ChatMessage = {
      steamId,
      steamName: currentSteamName,
      avatar: currentAvatar,
      message: message.trim(),
      timestamp: new Date(),
      isPro: currentIsPro,
    };

    await collection.insertOne(chatMessage);
    await client.close();

    return NextResponse.json({ success: true, message: chatMessage });
  } catch (error) {
    console.error('Failed to send chat message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

