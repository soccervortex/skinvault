"use client";

import { useEffect } from 'react';
import { useToast } from './Toast';
import { ChatNotification } from '@/app/utils/chat-notifications';

/**
 * Global chat notification listener
 * Shows notifications on any page when new messages or invites arrive
 */
export default function ChatNotificationListener() {
  const toast = useToast();

  useEffect(() => {
    const handleNotification = (event: CustomEvent<ChatNotification>) => {
      const notification = event.detail;
      
      // Don't show notifications if user is on chat page (they'll see it there)
      if (window.location.pathname === '/chat') {
        return;
      }
      
      if (notification.type === 'dm_message') {
        toast.info(
          `New message from ${notification.userName}${notification.message ? `: ${notification.message.substring(0, 50)}${notification.message.length > 50 ? '...' : ''}` : ''}`,
          5000
        );
      } else if (notification.type === 'dm_invite') {
        toast.info(
          `New DM invite from ${notification.userName}`,
          5000
        );
      }
    };

    window.addEventListener('chat-notification', handleNotification as EventListener);
    
    return () => {
      window.removeEventListener('chat-notification', handleNotification as EventListener);
    };
  }, [toast]);

  return null;
}

