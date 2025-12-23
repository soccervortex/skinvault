import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

const TYPING_USERS_KEY = 'typing_users'; // Format: { "steamId": { channel: 'global'|'dmId', timestamp: Date } }

// POST: Set typing status
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { steamId, steamName, channel = 'global' } = body;

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const typingUsers = await dbGet<Record<string, { channel: string; steamName: string; timestamp: string }>>(TYPING_USERS_KEY, false) || {};
    
    typingUsers[steamId] = {
      channel,
      steamName: steamName || 'User',
      timestamp: new Date().toISOString(),
    };

    await dbSet(TYPING_USERS_KEY, typingUsers);

    // Auto-clear typing status after 5 seconds
    setTimeout(async () => {
      try {
        const current = await dbGet<Record<string, any>>(TYPING_USERS_KEY, false) || {};
        if (current[steamId]?.timestamp === typingUsers[steamId].timestamp) {
          delete current[steamId];
          await dbSet(TYPING_USERS_KEY, current);
        }
      } catch {
        // Ignore cleanup errors
      }
    }, 5000);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to set typing status:', error);
    return NextResponse.json({ error: 'Failed to set typing status' }, { status: 500 });
  }
}

// GET: Get typing users for a channel
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || 'global';
    const currentUserId = searchParams.get('currentUserId');

    const typingUsers = await dbGet<Record<string, { channel: string; steamName: string; timestamp: string }>>(TYPING_USERS_KEY, false) || {};
    
    // Filter by channel and remove expired (older than 5 seconds)
    const now = Date.now();
    const activeTyping = Object.entries(typingUsers)
      .filter(([steamId, data]) => {
        if (data.channel !== channel) return false;
        if (steamId === currentUserId) return false; // Don't show own typing
        const timestamp = new Date(data.timestamp).getTime();
        return (now - timestamp) < 5000; // Only show if typed within last 5 seconds
      })
      .map(([steamId, data]) => ({
        steamId,
        steamName: data.steamName,
      }));

    return NextResponse.json({ typingUsers: activeTyping });
  } catch (error) {
    console.error('Failed to get typing users:', error);
    return NextResponse.json({ error: 'Failed to get typing users' }, { status: 500 });
  }
}

