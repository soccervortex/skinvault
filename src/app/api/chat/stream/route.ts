import { getCollectionNamesForDays, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';
import { getChatDatabase } from '@/app/utils/mongodb-client';

// Vercel needs nodejs runtime for SSE streaming
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

// Use connection pool from mongodb-client utility

// Modern SSE endpoint using Next.js streaming
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || 'global';
    const lastMessageId = searchParams.get('lastMessageId') || '';
    const currentUserId = searchParams.get('currentUserId') || '';

    // Use modern streaming response
    const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isActive = true;
      let lastCheckedId = lastMessageId;
      let pollInterval: NodeJS.Timeout | null = null;
      let heartbeatInterval: NodeJS.Timeout | null = null;

      const send = (data: any) => {
        if (!isActive) return;
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          // Stream closed, cleanup
          isActive = false;
          cleanup();
        }
      };

      const cleanup = () => {
        isActive = false;
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        cleanup();
      });

      // Send initial connection message
      send({ type: 'connected', channel });

      // Start heartbeat (MongoDB connection will be checked when needed)
      heartbeatInterval = setInterval(() => {
        send({ type: 'heartbeat', timestamp: Date.now() });
      }, 30000);

      // Start heartbeat (keep connection alive)
      heartbeatInterval = setInterval(() => {
        if (isActive) {
          send({ type: 'heartbeat', timestamp: Date.now() });
        }
      }, 30000);

      // Poll for new messages
      pollInterval = setInterval(async () => {
        if (!isActive) {
          cleanup();
          return;
        }

        try {
          const db = await getChatDatabase();

          if (channel === 'global') {
            // Global chat messages
            const collectionNames = getCollectionNamesForDays(2);
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            for (const collectionName of collectionNames) {
              if (!isActive) break;
              
              const collection = db.collection<ChatMessage>(collectionName);
              const query: any = { timestamp: { $gte: twentyFourHoursAgo } };
              
              if (lastCheckedId) {
                try {
                  const { ObjectId } = await import('mongodb');
                  query._id = { $gt: new ObjectId(lastCheckedId) };
                } catch {
                  // Invalid ObjectId, ignore
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
            // DM messages
            const [steamId1, steamId2] = channel.split('_');
            if (steamId1 && steamId2) {
              const dmId = channel;
              const threeHundredSixtyFiveDaysAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
              const collectionNames = getDMCollectionNamesForDays(365);

              for (const collectionName of collectionNames) {
                if (!isActive) break;
                
                const collection = db.collection<DMMessage>(collectionName);
                const query: any = { 
                  dmId,
                  timestamp: { $gte: threeHundredSixtyFiveDaysAgo }
                };
                
                if (lastCheckedId) {
                  try {
                    const { ObjectId } = await import('mongodb');
                    query._id = { $gt: new ObjectId(lastCheckedId) };
                  } catch {
                    // Invalid ObjectId, ignore
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
                      senderName:
                        (senderInfo?.steamName && senderInfo.steamName !== 'Unknown User' ? senderInfo.steamName : '') ||
                        msg.senderId ||
                        'Unknown User',
                      senderAvatar: (senderInfo?.avatar && String(senderInfo.avatar).trim() ? senderInfo.avatar : '') || '',
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

          // Don't close connection - it's pooled and reused
        } catch (error: any) {
          // Silently handle errors - don't spam client with error messages
          // Continue polling even on error
        }
      }, 2000); // Poll every 2 seconds (more reasonable than 500ms)
    },
  });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    // Always return a valid SSE response, even on error
    console.error('SSE endpoint error:', error);
    const fallbackStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', channel: 'global' })}\n\n`));
          // Send heartbeat to keep connection alive
          const heartbeat = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`));
            } catch {
              clearInterval(heartbeat);
              try {
                controller.close();
              } catch {
                // Already closed
              }
            }
          }, 30000);
          request.signal.addEventListener('abort', () => {
            clearInterval(heartbeat);
            try {
              controller.close();
            } catch {
              // Already closed
            }
          });
        } catch {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      },
    });
    
    return new Response(fallbackStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }
}
