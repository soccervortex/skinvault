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

    const handleCallNotification = (event: Event) => {
      const customEvent = event as CustomEvent<{ callId: string; callerId: string; callType: string }>;
      const { callerId } = customEvent.detail;
      
      // Don't show call notification if user is on chat page (call modal will show)
      if (window.location.pathname === '/chat') {
        return;
      }

      // Get caller name (async but don't await)
      fetch(`/api/chat/dms/list?steamId=${window.localStorage.getItem('steam_user') ? JSON.parse(window.localStorage.getItem('steam_user')!).steamId : ''}`)
        .then(dmListRes => {
          if (dmListRes.ok) {
            return dmListRes.json();
          }
          return null;
        })
        .then(dmListData => {
          if (dmListData) {
            const dms = dmListData.dms || [];
            const callerDM = dms.find((dm: any) => dm.otherUserId === callerId);
            const callerName = callerDM?.otherUserName || 'Unknown User';
            toast.info(
              `Incoming call from ${callerName}`,
              10000
            );
          } else {
            toast.info(
              'Incoming call',
              10000
            );
          }
        })
        .catch(() => {
          toast.info(
            'Incoming call',
            10000
          );
        });
    };

    window.addEventListener('chat-notification', handleNotification as EventListener);
    window.addEventListener('chat-call-incoming', handleCallNotification);
    
    return () => {
      window.removeEventListener('chat-notification', handleNotification as EventListener);
      window.removeEventListener('chat-call-incoming', handleCallNotification);
    };
  }, [toast]);

  return null;
}

