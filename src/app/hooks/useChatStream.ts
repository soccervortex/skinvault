import { useEffect, useRef, useState, useCallback } from 'react';

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

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Reconnect with faster exponential backoff
  const reconnect = useCallback(() => {
    if (!isMountedRef.current || !enabled || !currentUserId || !channel) {
      return;
    }

    const maxAttempts = 3; // Reduced to 3 attempts
    if (reconnectAttemptsRef.current >= maxAttempts) {
      // Reset after a longer delay to allow server recovery
      reconnectAttemptsRef.current = 0;
      return;
    }

    // Faster exponential backoff: 0.5s, 1s, 2s (much faster)
    const delay = Math.min(500 * Math.pow(2, reconnectAttemptsRef.current), 2000);
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

      try {
        const eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);
        eventSourceRef.current = eventSource;

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
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          // Reconnect immediately on error (EventSource will handle retries)
          // Only reconnect if it's a connection error
          if (eventSource.readyState === EventSource.CLOSED || eventSource.readyState === EventSource.CONNECTING) {
            // Immediate retry for faster recovery
            reconnect();
          }
        };
      } catch (error) {
        // If EventSource creation fails, try to reconnect
        reconnect();
      }
    }, delay);
  }, [channel, currentUserId, enabled]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || !currentUserId || !channel) {
      cleanup();
      return;
    }

    // Close existing connection before creating new one
    cleanup();

    // Initial connection - connect immediately
    reconnectAttemptsRef.current = 0;
    
    // Build SSE URL
    const params = new URLSearchParams({
      channel,
      currentUserId,
    });
    if (lastMessageIdRef.current) {
      params.set('lastMessageId', lastMessageIdRef.current);
    }

    try {
      const eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);
      eventSourceRef.current = eventSource;

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

      eventSource.onerror = () => {
        if (!isMountedRef.current) return;
        
        setIsConnected(false);
        
        // Close current connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Reconnect immediately on error
        if (eventSource.readyState === EventSource.CLOSED || eventSource.readyState === EventSource.CONNECTING) {
          reconnect();
        }
      };
    } catch (error) {
      // If EventSource creation fails, try to reconnect
      reconnect();
    }

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [channel, currentUserId, enabled, cleanup, reconnect]);

  return { messages, isConnected, clearMessages: () => setMessages([]) };
}
