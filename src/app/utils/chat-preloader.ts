/**
 * Global chat preloader
 * Preloads chat data in the background when user is logged in
 * Stores data in sessionStorage for instant access when chat page loads
 */

const CHAT_PRELOAD_KEY = 'sv_chat_preload';
const CHAT_PRELOAD_TTL = 30 * 1000; // 30 seconds

interface PreloadedChatData {
  messages: any[];
  dmList: any[];
  dmInvites: any[];
  timestamp: number;
}

export async function preloadChatData(steamId: string): Promise<void> {
  try {
    // Check if we have recent preloaded data
    const cached = sessionStorage.getItem(CHAT_PRELOAD_KEY);
    if (cached) {
      const data: PreloadedChatData = JSON.parse(cached);
      if (Date.now() - data.timestamp < CHAT_PRELOAD_TTL) {
        return; // Already preloaded recently
      }
    }

    // Preload all chat data in parallel
    const [messagesRes, dmListRes, invitesRes] = await Promise.all([
      fetch('/api/chat/messages'),
      fetch(`/api/chat/dms/list?steamId=${steamId}`),
      fetch(`/api/chat/dms/invites?steamId=${steamId}&type=pending`),
    ]);

    const preloadedData: PreloadedChatData = {
      messages: messagesRes.ok ? (await messagesRes.json()).messages || [] : [],
      dmList: dmListRes.ok ? (await dmListRes.json()).dms || [] : [],
      dmInvites: invitesRes.ok ? (await invitesRes.json()).invites || [] : [],
      timestamp: Date.now(),
    };

    // Store in sessionStorage
    sessionStorage.setItem(CHAT_PRELOAD_KEY, JSON.stringify(preloadedData));
  } catch (error) {
    console.warn('Failed to preload chat data:', error);
  }
}

export function getPreloadedChatData(): PreloadedChatData | null {
  try {
    const cached = sessionStorage.getItem(CHAT_PRELOAD_KEY);
    if (!cached) return null;

    const data: PreloadedChatData = JSON.parse(cached);
    
    // Check if data is still fresh
    if (Date.now() - data.timestamp > CHAT_PRELOAD_TTL) {
      sessionStorage.removeItem(CHAT_PRELOAD_KEY);
      return null;
    }

    return data;
  } catch (error) {
    return null;
  }
}

export function clearPreloadedChatData(): void {
  sessionStorage.removeItem(CHAT_PRELOAD_KEY);
}

