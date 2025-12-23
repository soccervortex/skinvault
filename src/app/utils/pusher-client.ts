/**
 * Centralized Pusher Client
 * Singleton pattern to reuse connection across components
 */

import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;
let connectionPromise: Promise<Pusher> | null = null;

export function getPusherClient(): Pusher | null {
  if (typeof window === 'undefined') return null;
  
  if (pusherInstance) {
    return pusherInstance;
  }
  
  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'eu';
  
  if (!pusherKey) {
    console.warn('[Pusher] Key not configured, real-time features disabled');
    return null;
  }
  
  pusherInstance = new Pusher(pusherKey, {
    cluster: pusherCluster,
    enabledTransports: ['ws', 'wss'],
    forceTLS: true,
    // No authEndpoint for public channels - simpler and works without auth endpoint
  });
  
  // Log connection events for debugging
  pusherInstance.connection.bind('connected', () => {
    console.log('[Pusher] Connected');
  });
  
  pusherInstance.connection.bind('disconnected', () => {
    console.log('[Pusher] Disconnected');
  });
  
  pusherInstance.connection.bind('error', (error: any) => {
    console.error('[Pusher] Connection error:', error);
  });
  
  pusherInstance.connection.bind('state_change', (states: any) => {
    console.log('[Pusher] State changed:', states.previous, '->', states.current);
  });
  
  return pusherInstance;
}

export function disconnectPusher(): void {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
    connectionPromise = null;
  }
}

