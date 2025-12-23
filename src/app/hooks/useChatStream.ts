import { useEffect, useRef, useState } from 'react';

interface StreamMessage {
  type: 'connected' | 'new_messages' | 'error' | 'heartbeat';
  channel?: string;
  messages?: any[];
  message?: string;
  timestamp?: number;
}

export function useChatStream(
  channel: string,
  currentUserId: string | null,
  enabled: boolean = true,
  lastMessageId?: string
) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastMessageIdRef = useRef<string>(lastMessageId || '');
  const channelRef = useRef<string>(channel);

  // Update lastMessageId ref when prop changes
  useEffect(() => {
    if (lastMessageId) {
      lastMessageIdRef.current = lastMessageId;
    }
  }, [lastMessageId]);

  // Clear messages when channel changes
  useEffect(() => {
    if (channelRef.current !== channel) {
      setMessages([]);
      channelRef.current = channel;
      lastMessageIdRef.current = lastMessageId || '';
    }
  }, [channel, lastMessageId]);

  useEffect(() => {
    if (!enabled || !currentUserId || !channel) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Build SSE URL
    const params = new URLSearchParams({
      channel,
      currentUserId,
    });
    if (lastMessageIdRef.current) {
      params.set('lastMessageId', lastMessageIdRef.current);
    }

    const eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: StreamMessage = JSON.parse(event.data);

        if (data.type === 'connected') {
          setIsConnected(true);
        } else if (data.type === 'new_messages' && data.messages) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = data.messages!.filter(m => !existingIds.has(m.id));
            
            if (newMessages.length > 0) {
              // Update last message ID
              const latestId = newMessages[newMessages.length - 1].id;
              if (latestId) {
                lastMessageIdRef.current = latestId;
              }
              return [...prev, ...newMessages];
            }
            return prev;
          });
        } else if (data.type === 'error') {
          console.error('SSE error:', data.message);
        }
        // Ignore heartbeat messages
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      // Silently handle errors - don't log to avoid console spam
      setIsConnected(false);
      
      // Close and cleanup on error
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [channel, currentUserId, enabled]);

  return { messages, isConnected, clearMessages: () => setMessages([]) };
}

