/**
 * DM List Persistence
 * Prevents DMs from disappearing by persisting to localStorage
 */

const DM_LIST_STORAGE_KEY = 'sv_dm_list_v1';

export interface PersistedDM {
  dmId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  persistedAt: number; // timestamp when persisted
}

/**
 * Save DM list to localStorage
 */
export function saveDMList(dmList: any[], steamId: string): void {
  try {
    if (typeof window === 'undefined') return;
    
    const persisted: PersistedDM[] = dmList.map(dm => ({
      dmId: dm.dmId,
      otherUserId: dm.otherUserId,
      otherUserName: dm.otherUserName || `User ${dm.otherUserId.slice(-4)}`,
      otherUserAvatar: dm.otherUserAvatar || '',
      lastMessage: dm.lastMessage || 'No messages yet',
      lastMessageTime: typeof dm.lastMessageTime === 'string' 
        ? dm.lastMessageTime 
        : dm.lastMessageTime instanceof Date 
          ? dm.lastMessageTime.toISOString()
          : new Date().toISOString(),
      persistedAt: Date.now(),
    }));
    
    const key = `${DM_LIST_STORAGE_KEY}_${steamId}`;
    window.localStorage.setItem(key, JSON.stringify(persisted));
  } catch (error) {
    console.error('Failed to save DM list:', error);
  }
}

/**
 * Load DM list from localStorage
 */
export function loadDMList(steamId: string): PersistedDM[] {
  try {
    if (typeof window === 'undefined') return [];
    
    const key = `${DM_LIST_STORAGE_KEY}_${steamId}`;
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    
    const persisted: PersistedDM[] = JSON.parse(stored);
    
    // Only return DMs persisted in last 24 hours (to avoid stale data)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return persisted.filter(dm => dm.persistedAt > oneDayAgo);
  } catch (error) {
    console.error('Failed to load DM list:', error);
    return [];
  }
}

/**
 * Merge server DM list with persisted DM list
 * Server data takes precedence, but persisted DMs are kept if not in server response
 */
export function mergeDMList(serverDMs: any[], steamId: string): any[] {
  const persisted = loadDMList(steamId);
  const serverDmIds = new Set(serverDMs.map(dm => dm.dmId));
  
  // Add persisted DMs that aren't in server response (newly accepted invites)
  const merged = [...serverDMs];
  persisted.forEach(persistedDM => {
    if (!serverDmIds.has(persistedDM.dmId)) {
      merged.push({
        dmId: persistedDM.dmId,
        otherUserId: persistedDM.otherUserId,
        otherUserName: persistedDM.otherUserName,
        otherUserAvatar: persistedDM.otherUserAvatar,
        lastMessage: persistedDM.lastMessage,
        lastMessageTime: new Date(persistedDM.lastMessageTime),
      });
    }
  });
  
  // Sort by last message time
  merged.sort((a, b) => {
    const timeA = typeof a.lastMessageTime === 'string' 
      ? new Date(a.lastMessageTime).getTime()
      : a.lastMessageTime instanceof Date
        ? a.lastMessageTime.getTime()
        : 0;
    const timeB = typeof b.lastMessageTime === 'string'
      ? new Date(b.lastMessageTime).getTime()
      : b.lastMessageTime instanceof Date
        ? b.lastMessageTime.getTime()
        : 0;
    return timeB - timeA;
  });
  
  return merged;
}

