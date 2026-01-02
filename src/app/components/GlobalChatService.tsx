"use client";

import { useEffect } from 'react';
import { getUnreadCounts, addUnreadDM, addUnreadInvite, getLastCheckTime, updateLastCheckTime } from '@/app/utils/chat-notifications';

/**
 * Global chat service that runs on every page
 * Polls for new messages and updates unread counts in real-time
 */
export default function GlobalChatService() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Get current user
    let currentUserId: string | null = null;
    try {
      const stored = window.localStorage.getItem('steam_user');
      if (stored) {
        const user = JSON.parse(stored);
        currentUserId = user?.steamId || null;
      }
    } catch {
      // Ignore errors
    }

    if (!currentUserId) return;

    let isActive = true;
    let lastCheck = getLastCheckTime();

    const pollForUpdates = async () => {
      if (!isActive || !currentUserId) return;

      try {
        // Poll for DM invites
        const invitesRes = await fetch(`/api/chat/dms/invites?steamId=${currentUserId}&type=pending`);
        if (invitesRes.ok) {
          const invitesData = await invitesRes.json();
          const newInvites = invitesData.invites || [];
          
          // Track new invites
          newInvites.forEach((invite: any) => {
            if (invite.createdAt && new Date(invite.createdAt).getTime() > lastCheck) {
              addUnreadInvite(
                invite.id,
                invite.fromSteamId || invite.otherUserId,
                currentUserId!,
                invite.otherUserName || 'Unknown User',
                invite.otherUserAvatar
              );
            }
          });
        }

        // Poll for DM list to check for new messages (only if not on chat page)
        if (window.location.pathname !== '/chat') {
          const dmListRes = await fetch(`/api/chat/dms/list?steamId=${currentUserId}`);
          if (dmListRes.ok) {
            const dmListData = await dmListRes.json();
            const dms = dmListData.dms || [];
            
            // For each DM, check if there are new messages (limit to 5 most recent for performance)
            const recentDms = dms.slice(0, 5);
            for (const dm of recentDms) {
              try {
                const [steamId1, steamId2] = dm.dmId.split('_');
                const dmRes: Response = await fetch(`/api/chat/dms?steamId1=${steamId1}&steamId2=${steamId2}&currentUserId=${currentUserId}`);
                
                if (dmRes.ok) {
                  const dmData = await dmRes.json();
                  const messages = dmData.messages || [];
                  
                  if (messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    
                    // Only track if message is from other user and is new
                    if (lastMessage.senderId !== currentUserId && 
                        lastMessage.timestamp && 
                        new Date(lastMessage.timestamp).getTime() > lastCheck) {
                      addUnreadDM(
                        dm.dmId,
                        currentUserId,
                        lastMessage.message,
                        lastMessage.senderName || 'Unknown User',
                        lastMessage.senderAvatar
                      );
                    }
                  }
                }
              } catch (error) {
                // Ignore individual DM errors
              }
            }
          }
        }

        // Update last check time
        updateLastCheckTime();
        lastCheck = Date.now();
        
        // Dispatch unread update event
        window.dispatchEvent(new CustomEvent('chat-unread-updated'));
      } catch (error) {
        console.warn('Failed to poll for chat updates:', error);
      }
    };

    // Poll immediately, then every 3 seconds
    pollForUpdates();
    const interval = setInterval(pollForUpdates, 3000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  return null;
}

