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

export async function GET() {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ messages: [] });
    }

    // Get banned and timeout users
    const { dbGet } = await import('@/app/utils/database');
    const bannedUsers = await dbGet<string[]>('banned_steam_ids') || [];
    const timeoutUsers = await dbGet<Record<string, string>>('timeout_users') || {};

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);

    // Get messages from last 24 hours using date-based collections
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const collectionNames = getCollectionNamesForDays(2); // Get today and yesterday collections
    
    // Query all relevant collections in parallel
    const messagePromises = collectionNames.map(async (collectionName) => {
      const collection = db.collection<ChatMessage>(collectionName);
      return collection
        .find({ timestamp: { $gte: twentyFourHoursAgo } })
        .sort({ timestamp: 1 })
        .toArray();
    });
    
    const messageArrays = await Promise.all(messagePromises);
    const allMessages = messageArrays.flat();
    
    // Sort by timestamp and limit
    const messages = allMessages
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-500); // Get last 500 messages

    await client.close();

    // Get unique Steam IDs from messages
    const uniqueSteamIds = [...new Set(messages.map(msg => msg.steamId))];
    
    // Fetch current user info for all unique users
    const userInfoMap = await getCurrentUserInfo(uniqueSteamIds);

    return NextResponse.json({ 
      messages: messages.map(msg => {
        const currentUserInfo = userInfoMap.get(msg.steamId);
        const isBanned = bannedUsers.includes(msg.steamId);
        const timeoutUntil = timeoutUsers[msg.steamId];
        const isTimedOut = timeoutUntil && new Date(timeoutUntil) > new Date();
        
        // Use current user info if available, otherwise fall back to stored info
        const steamName = currentUserInfo?.steamName || msg.steamName;
        const avatar = currentUserInfo?.avatar || msg.avatar;
        const isPro = currentUserInfo?.isPro ?? msg.isPro;
        
        return {
          id: msg._id?.toString(),
          steamId: msg.steamId,
          steamName,
          avatar,
          message: msg.message,
          timestamp: msg.timestamp,
          isPro,
          isBanned,
          isTimedOut,
          timeoutUntil: isTimedOut ? timeoutUntil : null,
        };
      })
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

    // Check if user is banned or timed out
    const { dbGet } = await import('@/app/utils/database');
    const bannedUsers = await dbGet<string[]>('banned_steam_ids') || [];
    const timeoutUsers = await dbGet<Record<string, string>>('timeout_users') || {};
    
    if (bannedUsers.includes(steamId)) {
      return NextResponse.json({ error: 'You are banned from chat' }, { status: 403 });
    }

    if (timeoutUsers[steamId]) {
      const timeoutUntil = new Date(timeoutUsers[steamId]);
      if (timeoutUntil > new Date()) {
        const minutesLeft = Math.ceil((timeoutUntil.getTime() - Date.now()) / (1000 * 60));
        return NextResponse.json({ 
          error: `You are timed out for ${minutesLeft} more minute(s)` 
        }, { status: 403 });
      }
    }

    // Fetch current user information (name, avatar, pro status)
    const [profileInfo, proUntil] = await Promise.all([
      fetchSteamProfile(steamId),
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

