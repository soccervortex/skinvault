import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getCollectionNamesForDays, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';

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

interface DMMessage {
  _id?: string;
  dmId: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: Date;
  editedAt?: Date;
}

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

// SSE endpoint for real-time chat updates
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || 'global'; // 'global' or dmId
  const lastMessageId = searchParams.get('lastMessageId') || '';
  const currentUserId = searchParams.get('currentUserId') || '';

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial connection message
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'connected', channel });

      let lastCheckedId = lastMessageId;
      let isActive = true;

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        isActive = false;
        controller.close();
      });

      // Poll for new messages (SSE keeps connection alive)
      const pollInterval = setInterval(async () => {
        if (!isActive || !MONGODB_URI) {
          clearInterval(pollInterval);
          controller.close();
          return;
        }

        try {
          const client = await getMongoClient();
          const db = client.db(MONGODB_DB_NAME);

          if (channel === 'global') {
            // Check global chat for new messages
            const collectionNames = getCollectionNamesForDays(2);
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            for (const collectionName of collectionNames) {
              const collection = db.collection<ChatMessage>(collectionName);
              const query: any = { timestamp: { $gte: twentyFourHoursAgo } };
              
              if (lastCheckedId) {
                try {
                  const { ObjectId } = await import('mongodb');
                  query._id = { $gt: new ObjectId(lastCheckedId) };
                } catch {
                  // If lastCheckedId is not a valid ObjectId, ignore it
                }
              }
              
              const newMessages = await collection
                .find(query)
                .sort({ timestamp: 1 })
                .limit(10)
                .toArray();

              if (newMessages.length > 0) {
                const { dbGet } = await import('@/app/utils/database');
                const { getCurrentUserInfo } = await import('../messages/route');
                const pinnedMessages = await dbGet<Record<string, any>>('pinned_messages', false) || {};
                const bannedUsers = await dbGet<string[]>('banned_steam_ids', false) || [];
                const timeoutUsers = await dbGet<Record<string, string>>('timeout_users', false) || {};

                const uniqueSteamIds = [...new Set(newMessages.map(msg => msg.steamId))];
                const userInfoMap = await getCurrentUserInfo(uniqueSteamIds);

                const formattedMessages = newMessages.map(msg => {
                  const currentUserInfo = userInfoMap.get(msg.steamId);
                  const isBanned = bannedUsers.includes(msg.steamId);
                  const timeoutUntil = timeoutUsers[msg.steamId];
                  const isTimedOut = timeoutUntil && new Date(timeoutUntil) > new Date();
                  const messageId = msg._id?.toString() || '';
                  const isPinned = pinnedMessages[messageId]?.messageType === 'global';

                  return {
                    id: messageId,
                    steamId: msg.steamId,
                    steamName: currentUserInfo?.steamName || msg.steamName,
                    avatar: currentUserInfo?.avatar || msg.avatar,
                    message: msg.message,
                    timestamp: msg.timestamp,
                    editedAt: msg.editedAt,
                    isPro: currentUserInfo?.isPro ?? msg.isPro,
                    isBanned,
                    isTimedOut,
                    timeoutUntil: isTimedOut ? timeoutUntil : null,
                    isPinned,
                  };
                });

                send({ type: 'new_messages', messages: formattedMessages });
                lastCheckedId = newMessages[newMessages.length - 1]._id?.toString() || lastCheckedId;
              }
            }
          } else {
            // Check DM for new messages
            const [steamId1, steamId2] = channel.split('_');
            if (steamId1 && steamId2) {
              const dmId = channel;
              const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              const collectionNames = getDMCollectionNamesForDays(7);

              for (const collectionName of collectionNames) {
                const collection = db.collection<DMMessage>(collectionName);
                const query: any = { 
                  dmId,
                  timestamp: { $gte: sevenDaysAgo }
                };
                
                if (lastCheckedId) {
                  try {
                    const { ObjectId } = await import('mongodb');
                    query._id = { $gt: new ObjectId(lastCheckedId) };
                  } catch {
                    // If lastCheckedId is not a valid ObjectId, ignore it
                  }
                }

                const newMessages = await collection
                  .find(query)
                  .sort({ timestamp: 1 })
                  .limit(10)
                  .toArray();

                if (newMessages.length > 0) {
                  const { dbGet } = await import('@/app/utils/database');
                  const { getCurrentUserInfo } = await import('../messages/route');
                  const pinnedMessages = await dbGet<Record<string, any>>('pinned_messages', false) || {};
                  const bannedUsers = await dbGet<string[]>('banned_steam_ids', false) || [];
                  const timeoutUsers = await dbGet<Record<string, string>>('timeout_users', false) || {};

                  const uniqueSteamIds = [...new Set(newMessages.map(msg => [msg.senderId, msg.receiverId]).flat())];
                  const userInfoMap = await getCurrentUserInfo(uniqueSteamIds);

                  const formattedMessages = newMessages.map(msg => {
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
                  });

                  send({ type: 'new_messages', messages: formattedMessages });
                  lastCheckedId = newMessages[newMessages.length - 1]._id?.toString() || lastCheckedId;
                }
              }
            }
          }

          await client.close();
        } catch (error) {
          console.error('SSE poll error:', error);
          send({ type: 'error', message: 'Failed to fetch messages' });
        }
      }, 500); // Check every 500ms for near-instant updates

      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        if (isActive) {
          send({ type: 'heartbeat', timestamp: Date.now() });
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds

      // Cleanup on close
      return () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        isActive = false;
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

