import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getProUntil } from '@/app/utils/pro-storage';
import { getTodayDMCollectionName, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';
import { fetchSteamProfile, getCurrentUserInfo } from '../messages/route';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

interface DMMessage {
  _id?: string;
  dmId: string; // Format: steamId1_steamId2 (sorted)
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: Date;
}

interface DMInvite {
  _id?: string;
  fromSteamId: string;
  toSteamId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

// Generate DM ID from two Steam IDs (sorted to ensure consistency)
function generateDMId(steamId1: string, steamId2: string): string {
  return [steamId1, steamId2].sort().join('_');
}

// GET: Get DM messages for a specific DM
export async function GET(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ messages: [] });
    }

    const { searchParams } = new URL(request.url);
    const steamId1 = searchParams.get('steamId1');
    const steamId2 = searchParams.get('steamId2');
    const currentUserId = searchParams.get('currentUserId'); // Current user making the request
    const adminSteamId = searchParams.get('adminSteamId');

    if (!steamId1 || !steamId2) {
      return NextResponse.json({ error: 'Missing steamId1 or steamId2' }, { status: 400 });
    }

    // Check if admin is trying to view someone else's DM
    const { isOwner } = await import('@/app/utils/owner-ids');
    const isAdmin = adminSteamId && isOwner(adminSteamId);
    
    // Verify current user is a participant in this DM (or admin)
    // If admin, allow access without currentUserId requirement
    const isParticipant = currentUserId && (steamId1 === currentUserId || steamId2 === currentUserId);

    // Admins can view any DM, participants can view their own DMs
    if (!isAdmin && !isParticipant) {
      return NextResponse.json({ error: 'Unauthorized - you are not a participant in this DM' }, { status: 403 });
    }

    const dmId = generateDMId(steamId1, steamId2);
    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);

    // Get messages from last 7 days using date-based collections
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const collectionNames = getDMCollectionNamesForDays(7);
    
    const messagePromises = collectionNames.map(async (collectionName) => {
      const collection = db.collection<DMMessage>(collectionName);
      return collection
        .find({ 
          dmId,
          timestamp: { $gte: sevenDaysAgo }
        })
        .sort({ timestamp: 1 })
        .toArray();
    });
    
    const messageArrays = await Promise.all(messagePromises);
    const allMessages = messageArrays.flat();
    
    const messages = allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    await client.close();

    // Get unique Steam IDs and fetch current user info
    const uniqueSteamIds = [...new Set(messages.map(msg => [msg.senderId, msg.receiverId]).flat())];
    const userInfoMap = await getCurrentUserInfo(uniqueSteamIds);

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

    return NextResponse.json({
      messages: messages.map(msg => {
        const senderInfo = userInfoMap.get(msg.senderId);
        const isBanned = bannedUsers.includes(msg.senderId);
        const timeoutUntil = timeoutUsers[msg.senderId];
        const isTimedOut = timeoutUntil && new Date(timeoutUntil) > new Date();

        return {
          id: msg._id?.toString(),
          dmId: msg.dmId,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          senderName: senderInfo?.steamName || 'Unknown User',
          senderAvatar: senderInfo?.avatar || '',
          senderIsPro: senderInfo?.isPro || false,
          message: msg.message,
          timestamp: msg.timestamp,
          isBanned,
          isTimedOut,
        };
      })
    });
  } catch (error) {
    console.error('Failed to get DM messages:', error);
    return NextResponse.json({ error: 'Failed to get DM messages' }, { status: 500 });
  }
}

// POST: Send a DM message
export async function POST(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { senderId, receiverId, message } = body;

    if (!senderId || !receiverId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if DM chat is disabled
    const { dbGet, dbSet } = await import('@/app/utils/database');
    const dmChatDisabled = (await dbGet<boolean>('dm_chat_disabled', false)) || false;
    if (dmChatDisabled) {
      return NextResponse.json({ error: 'DM chat is currently disabled' }, { status: 503 });
    }

    // Check if user is banned or timed out (disable cache for real-time checks)
    const bannedUsers = await dbGet<string[]>('banned_steam_ids', false) || [];
    const timeoutUsers = await dbGet<Record<string, string>>('timeout_users', false) || {};
    
    if (bannedUsers.includes(senderId)) {
      return NextResponse.json({ error: 'You are banned from chat' }, { status: 403 });
    }

    if (timeoutUsers[senderId]) {
      const timeoutUntil = new Date(timeoutUsers[senderId]);
      const now = new Date();
      if (timeoutUntil > now) {
        const minutesLeft = Math.ceil((timeoutUntil.getTime() - now.getTime()) / (1000 * 60));
        console.log(`[DM] User ${senderId} is timed out until ${timeoutUntil.toISOString()}, ${minutesLeft} minutes remaining`);
        return NextResponse.json({ 
          error: `You are timed out for ${minutesLeft} more minute(s)` 
        }, { status: 403 });
      } else {
        // Timeout expired, clean it up
        delete timeoutUsers[senderId];
        await dbSet('timeout_users', timeoutUsers);
      }
    }

    // Check if DM exists (check invites)
    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
    const invitesCollection = db.collection<DMInvite>('dm_invites');
    
    const dmId = generateDMId(senderId, receiverId);
    const invite = await invitesCollection.findOne({
      $or: [
        { fromSteamId: senderId, toSteamId: receiverId },
        { fromSteamId: receiverId, toSteamId: senderId }
      ],
      status: 'accepted'
    });

    if (!invite) {
      await client.close();
      return NextResponse.json({ error: 'DM not accepted. Please wait for the other user to accept your invite.' }, { status: 403 });
    }

    // Fetch current sender information
    const [profileInfo, proUntil] = await Promise.all([
      fetchSteamProfile(senderId),
      getProUntil(senderId),
    ]);

    const currentSteamName = profileInfo.name || 'Unknown User';
    const currentAvatar = profileInfo.avatar || '';
    const currentIsPro = proUntil ? new Date(proUntil) > new Date() : false;

    // Use today's date-based collection
    const collectionName = getTodayDMCollectionName();
    const collection = db.collection<DMMessage>(collectionName);

    const dmMessage: DMMessage = {
      dmId,
      senderId,
      receiverId,
      message: message.trim(),
      timestamp: new Date(),
    };

    await collection.insertOne(dmMessage);
    await client.close();

    return NextResponse.json({ success: true, message: dmMessage });
  } catch (error) {
    console.error('Failed to send DM message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

