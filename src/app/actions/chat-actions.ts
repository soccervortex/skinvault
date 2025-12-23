'use server';

import { getProUntil } from '@/app/utils/pro-storage';
import { getTodayDMCollectionName } from '@/app/utils/chat-collections';
import { getDatabase } from '@/app/utils/mongodb-client';
import Pusher from 'pusher';
import { fetchSteamProfile } from '@/app/api/chat/messages/route';

interface DMMessage {
  _id?: string;
  dmId: string;
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

export async function sendDMMessage(
  senderId: string,
  receiverId: string,
  message: string
): Promise<{ success: true; message: DMMessage } | { success: false; error: string }> {
  try {
    if (!senderId || !receiverId || !message?.trim()) {
      return { success: false, error: 'Missing required fields' };
    }

    // Check if DM chat is disabled
    const { dbGet, dbSet } = await import('@/app/utils/database');
    const dmChatDisabled = (await dbGet<boolean>('dm_chat_disabled', false)) || false;
    if (dmChatDisabled) {
      return { success: false, error: 'DM chat is currently disabled' };
    }

    // Check if user is banned or timed out
    const bannedUsers = await dbGet<string[]>('banned_steam_ids', false) || [];
    const timeoutUsers = await dbGet<Record<string, string>>('timeout_users', false) || {};
    
    if (bannedUsers.includes(senderId)) {
      return { success: false, error: 'You are banned from chat' };
    }

    // Check if users have blocked each other
    const userBlocks = await dbGet<Record<string, boolean>>('user_blocks', false) || {};
    const blockKey = [senderId, receiverId].sort().join('_');
    if (userBlocks[blockKey] === true) {
      return { success: false, error: 'Cannot send message to this user' };
    }

    if (timeoutUsers[senderId]) {
      const timeoutUntil = new Date(timeoutUsers[senderId]);
      const now = new Date();
      if (timeoutUntil > now) {
        const minutesLeft = Math.ceil((timeoutUntil.getTime() - now.getTime()) / (1000 * 60));
        return { success: false, error: `You are timed out for ${minutesLeft} more minute(s)` };
      } else {
        // Timeout expired, clean it up
        delete timeoutUsers[senderId];
        await dbSet('timeout_users', timeoutUsers);
      }
    }

    // Check if DM exists (check invites)
    const db = await getDatabase();
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
      return { success: false, error: 'DM not accepted. Please wait for the other user to accept your invite.' };
    }

    // Fetch current sender information
    const [profileInfo, proUntil] = await Promise.all([
      fetchSteamProfile(senderId),
      getProUntil(senderId),
    ]);

    const senderName = profileInfo.name || 'Unknown User';
    const senderAvatar = profileInfo.avatar || '';
    const senderIsPro = proUntil ? new Date(proUntil) > new Date() : false;

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

    const result = await collection.insertOne(dmMessage);
    const insertedMessage = { ...dmMessage, _id: result.insertedId };

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
            id: insertedMessage._id?.toString() || '',
            dmId: insertedMessage.dmId,
            senderId: insertedMessage.senderId,
            receiverId: insertedMessage.receiverId,
            senderName,
            senderAvatar,
            senderIsPro,
            message: insertedMessage.message,
            timestamp: insertedMessage.timestamp,
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

    return { success: true, message: insertedMessage };
  } catch (error: any) {
    console.error('Failed to send DM message:', error);
    if (error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return { success: false, error: 'Chat service is currently unavailable' };
    }
    return { success: false, error: 'Failed to send message' };
  }
}

export async function acceptDMInvite(
  inviteId: string,
  steamId: string
): Promise<{ success: true; status: 'accepted' } | { success: false; error: string }> {
  try {
    if (!inviteId || !steamId) {
      return { success: false, error: 'Missing required fields' };
    }

    const { ObjectId } = await import('mongodb');
    const db = await getDatabase();
    const collection = db.collection<DMInvite>('dm_invites');

    // Convert inviteId string to ObjectId
    let invite;
    try {
      invite = await collection.findOne({ _id: new ObjectId(inviteId) } as any);
    } catch (error) {
      return { success: false, error: 'Invalid invite ID' };
    }

    if (!invite) {
      return { success: false, error: 'Invite not found' };
    }

    if (invite.toSteamId !== steamId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (invite.status !== 'pending') {
      return { success: false, error: 'Invite already processed' };
    }

    await collection.updateOne(
      { _id: new ObjectId(inviteId) } as any,
      { $set: { status: 'accepted' } }
    );

    return { success: true, status: 'accepted' };
  } catch (error: any) {
    console.error('Failed to accept DM invite:', error);
    if (error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return { success: false, error: 'Chat service is currently unavailable' };
    }
    return { success: false, error: 'Failed to accept invite' };
  }
}

export async function sendDMInvite(
  fromSteamId: string,
  toSteamId: string
): Promise<{ success: true; invite: DMInvite } | { success: false; error: string }> {
  try {
    if (!fromSteamId || !toSteamId) {
      return { success: false, error: 'Missing required fields' };
    }

    if (fromSteamId === toSteamId) {
      return { success: false, error: 'Cannot send DM invite to yourself' };
    }

    // Check if either user is banned
    const { dbGet } = await import('@/app/utils/database');
    const bannedUsers = await dbGet<string[]>('banned_steam_ids', false) || [];
    
    if (bannedUsers.includes(fromSteamId)) {
      return { success: false, error: 'You are banned and cannot send DM invites' };
    }
    
    if (bannedUsers.includes(toSteamId)) {
      return { success: false, error: 'Cannot send DM invite to a banned user' };
    }

    // Check if users have blocked each other
    const userBlocks = await dbGet<Record<string, boolean>>('user_blocks', false) || {};
    const blockKey = [fromSteamId, toSteamId].sort().join('_');
    if (userBlocks[blockKey] === true) {
      return { success: false, error: 'Cannot send DM invite to this user' };
    }

    const db = await getDatabase();
    const collection = db.collection<DMInvite>('dm_invites');

    // Check if invite already exists
    const existingInvite = await collection.findOne({
      $or: [
        { fromSteamId, toSteamId },
        { fromSteamId: toSteamId, toSteamId: fromSteamId }
      ]
    });

    if (existingInvite) {
      if (existingInvite.status === 'accepted') {
        return { success: false, error: 'DM already exists' };
      }
      if (existingInvite.status === 'pending' && existingInvite.fromSteamId === fromSteamId) {
        return { success: false, error: 'Invite already sent' };
      }
    }

    const invite: DMInvite = {
      fromSteamId,
      toSteamId,
      status: 'pending',
      createdAt: new Date(),
    };

    const result = await collection.insertOne(invite);
    const insertedInvite = { ...invite, _id: result.insertedId };

    return { success: true, invite: insertedInvite };
  } catch (error: any) {
    console.error('Failed to send DM invite:', error);
    if (error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return { success: false, error: 'Chat service is currently unavailable' };
    }
    return { success: false, error: 'Failed to send invite' };
  }
}

interface GlobalMessage {
  _id?: string;
  steamId: string;
  steamName: string;
  avatar: string;
  message: string;
  timestamp: Date;
  editedAt?: Date;
  isPro: boolean;
}

export async function sendGlobalMessage(
  steamId: string,
  message: string
): Promise<{ success: true; message: GlobalMessage } | { success: false; error: string }> {
  try {
    if (!steamId || !message?.trim()) {
      return { success: false, error: 'Missing required fields' };
    }

    // Check if global chat is disabled
    const { dbGet, dbSet } = await import('@/app/utils/database');
    const globalChatDisabled = (await dbGet<boolean>('global_chat_disabled', false)) || false;
    if (globalChatDisabled) {
      return { success: false, error: 'Global chat is currently disabled' };
    }

    // Check if user is banned or timed out
    const bannedUsers = await dbGet<string[]>('banned_steam_ids', false) || [];
    const timeoutUsers = await dbGet<Record<string, string>>('timeout_users', false) || {};
    
    if (bannedUsers.includes(steamId)) {
      return { success: false, error: 'You are banned from chat' };
    }

    if (timeoutUsers[steamId]) {
      const timeoutUntil = new Date(timeoutUsers[steamId]);
      const now = new Date();
      if (timeoutUntil > now) {
        const minutesLeft = Math.ceil((timeoutUntil.getTime() - now.getTime()) / (1000 * 60));
        return { success: false, error: `You are timed out for ${minutesLeft} more minute(s)` };
      } else {
        // Timeout expired, clean it up
        delete timeoutUsers[steamId];
        await dbSet('timeout_users', timeoutUsers);
      }
    }

    // Fetch current user information
    const [profileInfo, proUntil] = await Promise.all([
      Promise.race([
        fetchSteamProfile(steamId),
        new Promise<{ name: string; avatar: string }>((resolve) => 
          setTimeout(() => resolve({ name: 'Unknown User', avatar: '' }), 2000)
        )
      ]),
      getProUntil(steamId),
    ]);

    const currentSteamName = profileInfo.name || 'Unknown User';
    const currentAvatar = profileInfo.avatar || '';
    const currentIsPro = proUntil ? new Date(proUntil) > new Date() : false;

    // Use today's date-based collection
    const { getTodayCollectionName } = await import('@/app/utils/chat-collections');
    const collectionName = getTodayCollectionName();
    const db = await getDatabase();
    const collection = db.collection<GlobalMessage>(collectionName);
    
    // Auto-setup index for new collection if needed
    const { setupIndexesForCollection } = await import('@/app/utils/mongodb-auto-index');
    setupIndexesForCollection(collectionName).catch(() => {});

    const globalMessage: GlobalMessage = {
      steamId,
      steamName: currentSteamName,
      avatar: currentAvatar,
      message: message.trim(),
      timestamp: new Date(),
      isPro: currentIsPro,
    };

    const result = await collection.insertOne(globalMessage);
    const insertedMessage = { ...globalMessage, _id: result.insertedId };

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

        const messageData = {
          type: 'new_messages',
          messages: [{
            id: insertedMessage._id?.toString() || '',
            steamId: insertedMessage.steamId,
            steamName: insertedMessage.steamName,
            avatar: insertedMessage.avatar,
            message: insertedMessage.message,
            timestamp: insertedMessage.timestamp,
            isPro: insertedMessage.isPro,
          }],
        };

        await pusher.trigger('global', 'new_messages', messageData);
      }
    } catch (pusherError) {
      console.error('Failed to trigger Pusher event:', pusherError);
      // Don't fail the request if Pusher fails
    }

    return { success: true, message: insertedMessage };
  } catch (error: any) {
    console.error('Failed to send global message:', error);
    if (error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return { success: false, error: 'Chat service is currently unavailable' };
    }
    return { success: false, error: 'Failed to send message' };
  }
}

