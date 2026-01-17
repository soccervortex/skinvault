import { NextResponse } from 'next/server';
import { getProUntil } from '@/app/utils/pro-storage';
import { getTodayDMCollectionName, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';
import { fetchSteamProfile, getCurrentUserInfo } from '../messages/route';
import { getChatDatabase } from '@/app/utils/mongodb-client';
import Pusher from 'pusher';

interface DMMessage {
  _id?: string;
  dmId: string; // Format: steamId1_steamId2 (sorted)
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: Date;
  editedAt?: Date;
}

interface DMInvite {
  _id?: string;
  fromSteamId: string;
  toSteamId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

// Generate DM ID from two Steam IDs (sorted to ensure consistency)
function generateDMId(steamId1: string, steamId2: string): string {
  return [steamId1, steamId2].sort().join('_');
}

// GET: Get DM messages for a specific DM
export async function GET(request: Request) {
  try {
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
    // Use connection pool
    const db = await getChatDatabase();

    // Get messages from last 30 days initially (can load more with cursor)
    // This is much faster than querying 365 days of collections
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const threeHundredSixtyFiveDaysAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    
    // Cursor-based pagination support
    const beforeTimestamp = searchParams.get('beforeTimestamp');
    const beforeTimestampDate = beforeTimestamp ? new Date(beforeTimestamp) : null;
    const loadAll = searchParams.get('loadAll') === 'true'; // Option to load all 365 days
    const pageSize = parseInt(searchParams.get('limit') || '50'); // Default 50 for faster initial load
    
    // Use fewer collections for initial load (30 days), more if explicitly requested
    const daysToLoad = loadAll ? 365 : 30;
    const collectionNames = getDMCollectionNamesForDays(daysToLoad);
    const minDate = loadAll ? threeHundredSixtyFiveDaysAgo : thirtyDaysAgo;
    
    // Build query with cursor
    const queryFilter: any = {
      dmId,
      timestamp: { $gte: minDate }
    };
    
    if (beforeTimestampDate) {
      queryFilter.timestamp.$lt = beforeTimestampDate; // Get messages older than cursor
    }
    
    // Query all 365 days of collections, but prioritize recent ones for speed
    // We check recent collections first, then continue through all 365 days
    let allMessages: DMMessage[] = [];
    
    // Query all collections in reverse order (newest first)
    // This ensures we get messages from all 365 days, but recent ones appear first
    for (const collectionName of collectionNames.reverse()) {
      // Stop early if we have enough messages for pagination (but still check all if loadAll is true)
      // For loadAll, we want to check all collections to ensure we get everything
      if (!loadAll && allMessages.length >= pageSize + 1) {
        break; // Early exit for non-loadAll requests
      }
      
      const collection = db.collection<DMMessage>(collectionName);
      // Use projection to only fetch needed fields
      const projection = {
        _id: 1,
        dmId: 1,
        senderId: 1,
        receiverId: 1,
        message: 1,
        timestamp: 1,
        editedAt: 1,
      };
      
      const messages = await collection
        .find(queryFilter, { projection })
        .sort({ timestamp: -1 }) // Sort descending for cursor pagination
        .limit(loadAll ? 1000 : pageSize + 1) // For loadAll, fetch more to ensure we get all messages
        .toArray();
      
      allMessages.push(...messages);
      
      // For loadAll, continue through all collections to ensure we get everything
      // For regular requests, stop once we have enough
      if (!loadAll && allMessages.length >= pageSize + 1) {
        break;
      }
    }
    
    // Sort by timestamp descending
    allMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Check if there are more messages
    const hasMore = allMessages.length > pageSize;
    // Take only pageSize messages
    const messages = allMessages.slice(0, pageSize);
    // Reverse to show oldest first in chat
    const sortedMessages = messages.reverse();

    // Don't close connection - it's pooled and reused

    // Get unique Steam IDs and fetch current user info (only for messages we're returning)
    const uniqueSteamIds = [...new Set(sortedMessages.map(msg => [msg.senderId, msg.receiverId]).flat())];
    
    // Fetch user info and metadata in parallel for better performance
    const [userInfoMap, bannedUsers, timeoutUsers, pinnedMessages] = await Promise.all([
      getCurrentUserInfo(uniqueSteamIds),
      (async () => {
        const { dbGet } = await import('@/app/utils/database');
        return await dbGet<string[]>('banned_steam_ids', false) || [];
      })(),
      (async () => {
    const { dbGet, dbSet } = await import('@/app/utils/database');
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
        return activeTimeouts;
      })(),
      (async () => {
        const { dbGet } = await import('@/app/utils/database');
        return await dbGet<Record<string, any>>('pinned_messages', false) || {};
      })(),
    ]);

    return NextResponse.json({
      messages: sortedMessages.map(msg => {
        const senderInfo = userInfoMap.get(msg.senderId);
        const isBanned = bannedUsers.includes(msg.senderId);
        const timeoutUntil = timeoutUsers[msg.senderId];
        const isTimedOut = timeoutUntil && new Date(timeoutUntil) > new Date();
        const messageId = msg._id?.toString() || '';
        const isPinned = pinnedMessages[messageId]?.messageType === 'dm';

        return {
          id: messageId,
          dmId: msg.dmId,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          senderName: senderInfo?.steamName || 'Unknown User',
          senderAvatar: senderInfo?.avatar || '',
          senderIsPro: senderInfo?.isPro || false,
          message: msg.message,
          timestamp: msg.timestamp,
          editedAt: msg.editedAt,
          isBanned,
          isTimedOut,
          isPinned,
        };
      }),
      hasMore,
      nextCursor: sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].timestamp.toISOString() : null,
    });
  } catch (error: any) {
    console.error('Failed to get DM messages:', error);
    // If MongoDB connection fails, return empty messages instead of error
    if (error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return NextResponse.json({ messages: [] });
    }
    return NextResponse.json({ error: 'Failed to get DM messages' }, { status: 500 });
  }
}

// POST: Send a DM message
export async function POST(request: Request) {
  try {
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

    // Check if users have blocked each other (user-to-user block)
    const userBlocks = await dbGet<Record<string, boolean>>('user_blocks', false) || {};
    const blockKey = [senderId, receiverId].sort().join('_');
    if (userBlocks[blockKey] === true) {
      return NextResponse.json({ error: 'Cannot send message to this user' }, { status: 403 });
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
    const db = await getChatDatabase();
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
    
    // Auto-setup index for new collection if needed
    const { setupIndexesForCollection } = await import('@/app/utils/mongodb-auto-index');
    setupIndexesForCollection(collectionName).catch(() => {});

    const dmMessage: DMMessage = {
      dmId,
      senderId,
      receiverId,
      message: message.trim(),
      timestamp: new Date(),
    };

    await collection.insertOne(dmMessage);
    // Don't close connection - it's pooled and reused

    // Trigger Pusher event for real-time updates to both users
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

        // Trigger to both users' DM channels
        const dmChannel1 = `dm_${senderId}`;
        const dmChannel2 = `dm_${receiverId}`;
        
        const messageData = {
          type: 'new_messages',
          messages: [{
            id: dmMessage._id?.toString() || '',
            dmId: dmMessage.dmId,
            senderId: dmMessage.senderId,
            receiverId: dmMessage.receiverId,
            message: dmMessage.message,
            timestamp: dmMessage.timestamp,
          }],
        };

        await Promise.all([
          pusher.trigger(dmChannel1, 'new_messages', messageData),
          pusher.trigger(dmChannel2, 'new_messages', messageData),
        ]);
      }
    } catch (pusherError) {
      console.error('Failed to trigger Pusher event:', pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({ success: true, message: dmMessage });
  } catch (error: any) {
    console.error('Failed to send DM message:', error);
    // If MongoDB connection fails, return error
    if (error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return NextResponse.json({ error: 'Chat service is currently unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

