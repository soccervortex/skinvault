"use client";

import { useEffect } from 'react';
import { preloadChatData } from '@/app/utils/chat-preloader';

/**
 * Global chat preloader component
 * Preloads chat data in the background when user is logged in
 * This ensures chat loads instantly when user navigates to chat page
 */
export default function ChatPreloader() {
  useEffect(() => {
    // Check if user is logged in
    if (typeof window === 'undefined') return;
    
    const checkAndPreload = () => {
      try {
        const stored = window.localStorage.getItem('steam_user');
        if (stored) {
          const parsedUser = JSON.parse(stored);
          if (parsedUser?.steamId) {
            // Preload chat data in background
            preloadChatData(parsedUser.steamId).catch(() => {
              // Silently fail - this is background preloading
            });
          }
        }
      } catch (error) {
        // Silently fail
      }
    };

    // Preload immediately
    checkAndPreload();

    // Also preload when localStorage changes (user logs in)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'steam_user') {
        checkAndPreload();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also check periodically (every 30 seconds) to refresh preloaded data
    const interval = setInterval(() => {
      checkAndPreload();
    }, 30000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return null; // This component doesn't render anything
}

