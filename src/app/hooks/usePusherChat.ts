import { useEffect, useRef, useState, useCallback } from 'react';
import Pusher from 'pusher-js';
import { getPusherClient } from '@/app/utils/pusher-client';

/**
 * Chat hook using Pusher WebSockets for real-time updates.
 * Much faster and more reliable than SSE, especially on Vercel.
 */
interface StreamMessage {
  type: 'connected' | 'new_messages' | 'error' | 'heartbeat';
  channel?: string;
  messages?: any[];
  message?: string;
  timestamp?: number;
}

export function usePusherChat(
  channel: string,
  currentUserId: string | null,
  enabled: boolean = true,
  lastMessageId?: string
) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<any>(null);
  const lastMessageIdRef = useRef<string>(lastMessageId || '');
  const channelNameRef = useRef<string>(channel);
  const isMountedRef = useRef(true);

  // Update lastMessageId ref when prop changes
  useEffect(() => {
    if (lastMessageId) {
      lastMessageIdRef.current = lastMessageId;
    }
  }, [lastMessageId]);

  // Clear messages when channel changes
  useEffect(() => {
    if (channelNameRef.current !== channel) {
      setMessages([]);
      channelNameRef.current = channel;
      lastMessageIdRef.current = lastMessageId || '';
    }
  }, [channel, lastMessageId]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unbind_all();
      channelRef.current = null;
    }
    if (pusherRef.current) {
      pusherRef.current.disconnect();
      pusherRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || !currentUserId || !channel) {
      cleanup();
      return;
    }

    // Cleanup existing connection
    cleanup();

    // Initialize Pusher
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu';

    if (!pusherKey) {
      console.error('Pusher key not configured');
      return;
    }

    // Use public channels (no auth needed) - simpler and works without auth endpoint
    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      // No authEndpoint needed for public channels
    });

    pusherRef.current = pusher;

    // Subscribe to channel
    // Use public channels (no auth needed) instead of presence channels for now
    // This avoids auth issues if Pusher isn't fully configured yet
    const channelName = channel.startsWith('dm_') ? channel : channel;
    const pusherChannel = pusher.subscribe(channelName);

    channelRef.current = pusherChannel;

    // Handle connection events
    pusher.connection.bind('connected', () => {
      if (isMountedRef.current) {
        setIsConnected(true);
      }
    });

    pusher.connection.bind('disconnected', () => {
      if (isMountedRef.current) {
        setIsConnected(false);
      }
    });

    pusher.connection.bind('error', (error: any) => {
      console.error('Pusher connection error:', error);
      if (isMountedRef.current) {
        setIsConnected(false);
      }
    });

    // Handle subscription success
    pusherChannel.bind('pusher:subscription_succeeded', () => {
      if (isMountedRef.current) {
        setIsConnected(true);
        // Send initial connection message
        setMessages(prev => [...prev]);
      }
    });

    // Listen for new messages
    pusherChannel.bind('new_messages', (data: StreamMessage) => {
      if (!isMountedRef.current) return;

      if (data.type === 'new_messages' && data.messages) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = data.messages!.filter(m => m.id && !existingIds.has(m.id));
          
          if (newMessages.length > 0) {
            const latestId = newMessages[newMessages.length - 1].id;
            if (latestId) {
              lastMessageIdRef.current = latestId;
            }
            return [...prev, ...newMessages];
          }
          return prev;
        });
      }
    });

    // Listen for heartbeat
    pusherChannel.bind('heartbeat', (data: StreamMessage) => {
      // Just keep connection alive
    });

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [channel, currentUserId, enabled, cleanup]);

  return { messages, isConnected, clearMessages: () => setMessages([]) };
}

