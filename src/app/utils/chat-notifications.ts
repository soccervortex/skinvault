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
    
    // Count DMs for current user
    const userDmCount = Object.values(unreadDms).reduce((count: number, dm: any) => {
      if (dm.userId === currentUserId && dm.count > 0) {
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
    if (typeof window === 'undefined') return;
    
    const unreadDms = JSON.parse(localStorage.getItem(UNREAD_DMS_KEY) || '{}');
    if (unreadDms[dmId]) {
      unreadDms[dmId].count = 0;
      unreadDms[dmId].lastRead = Date.now();
      localStorage.setItem(UNREAD_DMS_KEY, JSON.stringify(unreadDms));
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('chat-unread-updated'));
    }
  } catch {
    // Ignore errors
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

