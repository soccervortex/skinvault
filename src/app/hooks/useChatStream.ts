import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Chat stream hook using Server-Sent Events (SSE) for real-time updates.
 * Note: This uses SSE (EventSource), not WebSockets.
 * SSE can have timeout issues on Vercel, so we use 10 retries with exponential backoff.
 * Browser console may show "EventSource failed loading" errors - these are handled gracefully.
 */
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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const reconnectRef = useRef<(() => void) | null>(null);

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
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on channel change
    }
  }, [channel, lastMessageId]);

  // Cleanup function - ensure complete cleanup
  const cleanup = useCallback(() => {
    isConnectingRef.current = false;
    // Clear any pending connect timeouts
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    // Clear any pending reconnect timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    // Close and cleanup EventSource
    if (eventSourceRef.current) {
      try {
        // Remove all event listeners before closing
        eventSourceRef.current.onopen = null;
        eventSourceRef.current.onmessage = null;
        eventSourceRef.current.onerror = null;
        eventSourceRef.current.close();
      } catch {
        // Ignore cleanup errors
      }
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Reconnect with faster exponential backoff
  const reconnect = useCallback(() => {
    if (!isMountedRef.current || !enabled || !currentUserId || !channel || isConnectingRef.current) {
      return;
    }

    const maxAttempts = 10; // Increased to 10 attempts for better reliability
    if (reconnectAttemptsRef.current >= maxAttempts) {
      // Reset after a delay to allow server recovery
      setTimeout(() => {
        reconnectAttemptsRef.current = 0;
      }, 5000);
      return;
    }

    // Exponential backoff: 0.5s, 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s (capped at 30s)
    const delay = Math.min(500 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      // Build SSE URL
      const params = new URLSearchParams({
        channel,
        currentUserId,
      });
      if (lastMessageIdRef.current) {
        params.set('lastMessageId', lastMessageIdRef.current);
      }

      // Prevent duplicate connections
      if (eventSourceRef.current || isConnectingRef.current) {
        return;
      }
      
      isConnectingRef.current = true;
      try {
        // Suppress EventSource errors in console by wrapping in try-catch
        const eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);
        eventSourceRef.current = eventSource;
        isConnectingRef.current = false;

        eventSource.onopen = () => {
          if (!isMountedRef.current) {
            eventSource.close();
            return;
          }
          setIsConnected(true);
          reconnectAttemptsRef.current = 0; // Reset on successful connection
        };

        eventSource.onmessage = (event) => {
          if (!isMountedRef.current) return;
          
          try {
            const data: StreamMessage = JSON.parse(event.data);

            if (data.type === 'connected') {
              setIsConnected(true);
              reconnectAttemptsRef.current = 0;
            } else if (data.type === 'new_messages' && data.messages) {
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
            // Ignore heartbeat and error messages
          } catch (error) {
            // Ignore parse errors
          }
        };

        eventSource.onerror = (error) => {
          if (!isMountedRef.current) return;
          
          setIsConnected(false);
          
          // Close current connection immediately
          if (eventSourceRef.current) {
            try {
              eventSourceRef.current.close();
            } catch {
              // Ignore close errors
            }
            eventSourceRef.current = null;
          }

          // Reconnect on error - only if connection is closed or connecting
          // Suppress console errors for SSE failures (common on Vercel)
          if (eventSource.readyState === EventSource.CLOSED || eventSource.readyState === EventSource.CONNECTING) {
            reconnectRef.current?.();
          }
        };
      } catch (error) {
        // If EventSource creation fails, try to reconnect
        reconnectRef.current?.();
      }
    }, delay);
  }, [channel, currentUserId, enabled]);

  useEffect(() => {
    reconnectRef.current = reconnect;
  }, [reconnect]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || !currentUserId || !channel) {
      cleanup();
      return;
    }

    // Close existing connection before creating new one - wait a bit to ensure cleanup
    cleanup();
    reconnectAttemptsRef.current = 0;

    // Add delay when channel changes to prevent rapid connection attempts
    // Check if channel changed (more aggressive cleanup needed)
    const channelChanged = channelRef.current !== channel;
    const delay = channelChanged ? 300 : 50; // 300ms delay on channel change, 50ms otherwise
    
    connectTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current || !enabled || !currentUserId || !channel) {
        return;
      }

      // Prevent duplicate connections
      if (eventSourceRef.current || isConnectingRef.current) {
        return;
      }

    // Initial connection
    
    // Build SSE URL
    const params = new URLSearchParams({
      channel,
      currentUserId,
    });
    if (lastMessageIdRef.current) {
      params.set('lastMessageId', lastMessageIdRef.current);
    }

    // Double-check we're not already connecting or connected
    if (eventSourceRef.current || isConnectingRef.current) {
      return;
    }
    
    isConnectingRef.current = true;
    try {
      // Suppress EventSource errors in console by wrapping in try-catch
      const eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);
      eventSourceRef.current = eventSource;
      isConnectingRef.current = false;

      eventSource.onopen = () => {
        if (!isMountedRef.current) {
          eventSource.close();
          isConnectingRef.current = false;
          return;
        }
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset on successful connection
        isConnectingRef.current = false;
      };

      eventSource.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const data: StreamMessage = JSON.parse(event.data);

          if (data.type === 'connected') {
            setIsConnected(true);
            reconnectAttemptsRef.current = 0;
          } else if (data.type === 'new_messages' && data.messages) {
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
          // Ignore heartbeat and error messages
        } catch (error) {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        if (!isMountedRef.current) return;
        
        setIsConnected(false);
        
        // Close current connection
        if (eventSourceRef.current) {
          try {
            eventSourceRef.current.close();
          } catch {
            // Ignore close errors
          }
          eventSourceRef.current = null;
        }

        // Reconnect on error - suppress console errors for SSE failures
        if (eventSource.readyState === EventSource.CLOSED || eventSource.readyState === EventSource.CONNECTING) {
          reconnectRef.current?.();
        }
      };
    } catch (error) {
      isConnectingRef.current = false;
      // If EventSource creation fails, try to reconnect
      reconnectRef.current?.();
    }
    }, channelChanged ? 300 : 50); // 300ms delay on channel change, 50ms otherwise

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [channel, currentUserId, enabled, cleanup, reconnect]);

  return { messages, isConnected, clearMessages: () => setMessages([]) };
}
