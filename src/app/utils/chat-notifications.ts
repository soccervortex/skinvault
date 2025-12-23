/**
 * Chat notification system
 * Tracks unread messages and sends notifications across pages
 */

export interface ChatNotification {
  type: 'dm_message' | 'dm_invite';
  steamId: string;
  userName: string;
  userAvatar?: string;
  message?: string;
  timestamp: number;
  dmId?: string;
}

const UNREAD_DMS_KEY = 'sv_unread_dms';
const UNREAD_INVITES_KEY = 'sv_unread_invites';
const LAST_CHECK_KEY = 'sv_chat_last_check';

export interface UnreadCounts {
  dms: number;
  invites: number;
  total: number;
}

/**
 * Get unread message counts
 */
export function getUnreadCounts(currentUserId: string): UnreadCounts {
  try {
    if (typeof window === 'undefined') return { dms: 0, invites: 0, total: 0 };
    
    const unreadDms = JSON.parse(localStorage.getItem(UNREAD_DMS_KEY) || '{}');
    const unreadInvites = JSON.parse(localStorage.getItem(UNREAD_INVITES_KEY) || '[]');
    
    // Count DMs for current user (check if user is participant in DM)
    const userDmCount = Object.keys(unreadDms).reduce((count: number, dmId: string) => {
      const dm = unreadDms[dmId];
      // Extract participants from DM ID (format: steamId1_steamId2)
      const participants = dmId.split('_');
      if (participants.includes(currentUserId) && dm.count > 0) {
        return count + dm.count;
      }
      return count;
    }, 0);
    
    // Count invites for current user
    const userInviteCount = unreadInvites.filter((invite: any) => 
      invite.toSteamId === currentUserId
    ).length;
    
    return {
      dms: userDmCount,
      invites: userInviteCount,
      total: userDmCount + userInviteCount,
    };
  } catch {
    return { dms: 0, invites: 0, total: 0 };
  }
}

/**
 * Mark DM as read
 */
export function markDMAsRead(dmId: string, currentUserId: string): void {
  try {
    if (typeof window === 'undefined' || !dmId || !currentUserId) return;
    
    const unreadDms = JSON.parse(localStorage.getItem(UNREAD_DMS_KEY) || '{}');
    
    // Extract participants from DM ID (format: steamId1_steamId2)
    const participants = dmId.split('_').filter(Boolean);
    
    // Check if current user is a participant (handle both sorted and unsorted DM IDs)
    const isParticipant = participants.length === 2 && participants.includes(currentUserId);
    
    // Always mark as read if DM ID is valid format (even if participant check fails, still mark it)
    // This ensures DMs are always marked as read when viewed
    if (participants.length === 2) {
      // Always create/update the entry to ensure it's marked as read
      if (!unreadDms[dmId]) {
        unreadDms[dmId] = {
          userId: currentUserId,
          count: 0,
          lastMessage: '',
          lastMessageTime: 0,
          senderName: '',
          senderAvatar: '',
        };
      }
      // Reset count and update last read time (regardless of stored userId or participant check)
      unreadDms[dmId].count = 0;
      unreadDms[dmId].lastRead = Date.now();
      unreadDms[dmId].userId = currentUserId; // Update userId to current user
      localStorage.setItem(UNREAD_DMS_KEY, JSON.stringify(unreadDms));
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('chat-unread-updated'));
    }
  } catch (error) {
    // Log error for debugging but don't throw
    console.warn('Error marking DM as read:', error);
  }
}

/**
 * Mark invite as read
 */
export function markInviteAsRead(inviteId: string, currentUserId: string): void {
  try {
    if (typeof window === 'undefined') return;
    
    const unreadInvites = JSON.parse(localStorage.getItem(UNREAD_INVITES_KEY) || '[]');
    const updated = unreadInvites.filter((invite: any) => 
      !(invite.id === inviteId && invite.toSteamId === currentUserId)
    );
    localStorage.setItem(UNREAD_INVITES_KEY, JSON.stringify(updated));
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('chat-unread-updated'));
  } catch {
    // Ignore errors
  }
}

/**
 * Add unread DM message
 */
export function addUnreadDM(dmId: string, userId: string, message: string, senderName: string, senderAvatar?: string): void {
  try {
    if (typeof window === 'undefined') return;
    
    const unreadDms = JSON.parse(localStorage.getItem(UNREAD_DMS_KEY) || '{}');
    
    if (!unreadDms[dmId]) {
      unreadDms[dmId] = {
        userId,
        count: 0,
        lastMessage: '',
        lastMessageTime: 0,
        senderName: '',
        senderAvatar: '',
      };
    }
    
    unreadDms[dmId].count += 1;
    unreadDms[dmId].lastMessage = message;
    unreadDms[dmId].lastMessageTime = Date.now();
    unreadDms[dmId].senderName = senderName;
    unreadDms[dmId].senderAvatar = senderAvatar;
    
    localStorage.setItem(UNREAD_DMS_KEY, JSON.stringify(unreadDms));
    
    // Dispatch notification event
    window.dispatchEvent(new CustomEvent('chat-notification', {
      detail: {
        type: 'dm_message',
        dmId,
        userName: senderName,
        userAvatar: senderAvatar,
        message,
        timestamp: Date.now(),
      } as ChatNotification,
    }));
    
    // Dispatch unread update
    window.dispatchEvent(new CustomEvent('chat-unread-updated'));
  } catch {
    // Ignore errors
  }
}

/**
 * Add unread invite
 */
export function addUnreadInvite(inviteId: string, fromSteamId: string, toSteamId: string, userName: string, userAvatar?: string): void {
  try {
    if (typeof window === 'undefined') return;
    
    const unreadInvites = JSON.parse(localStorage.getItem(UNREAD_INVITES_KEY) || '[]');
    
    // Check if invite already exists
    const exists = unreadInvites.some((invite: any) => invite.id === inviteId);
    if (!exists) {
      unreadInvites.push({
        id: inviteId,
        fromSteamId,
        toSteamId,
        userName,
        userAvatar,
        timestamp: Date.now(),
      });
      
      localStorage.setItem(UNREAD_INVITES_KEY, JSON.stringify(unreadInvites));
      
      // Dispatch notification event
      window.dispatchEvent(new CustomEvent('chat-notification', {
        detail: {
          type: 'dm_invite',
          steamId: fromSteamId,
          userName,
          userAvatar,
          timestamp: Date.now(),
        } as ChatNotification,
      }));
      
      // Dispatch unread update
      window.dispatchEvent(new CustomEvent('chat-unread-updated'));
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all unread counts (for testing or reset)
 */
export function clearUnreadCounts(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(UNREAD_DMS_KEY);
    localStorage.removeItem(UNREAD_INVITES_KEY);
    localStorage.removeItem(LAST_CHECK_KEY);
    window.dispatchEvent(new CustomEvent('chat-unread-updated'));
  } catch {
    // Ignore errors
  }
}

/**
 * Get last check timestamp
 */
export function getLastCheckTime(): number {
  try {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

/**
 * Update last check timestamp
 */
export function updateLastCheckTime(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
  } catch {
    // Ignore errors
  }
}

/**
 * Mark all DMs as read (when user views DMs tab)
 */
export function markAllDMsAsRead(currentUserId: string): void {
  try {
    if (typeof window === 'undefined') return;
    
    const unreadDms = JSON.parse(localStorage.getItem(UNREAD_DMS_KEY) || '{}');
    
    // Mark all DMs where current user is a participant as read
    Object.keys(unreadDms).forEach(dmId => {
      // Extract participants from DM ID (format: steamId1_steamId2)
      const participants = dmId.split('_');
      if (participants.includes(currentUserId)) {
        unreadDms[dmId].count = 0;
        unreadDms[dmId].lastRead = Date.now();
        unreadDms[dmId].userId = currentUserId; // Update userId to current user
      }
    });
    
    localStorage.setItem(UNREAD_DMS_KEY, JSON.stringify(unreadDms));
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('chat-unread-updated'));
  } catch {
    // Ignore errors
  }
}

