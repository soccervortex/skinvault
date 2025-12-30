import { NextResponse } from 'next/server';
import { recordFirstLogin } from '@/app/utils/pro-storage';
import { updateUserCount } from '@/app/lib/user-milestones';
import { notifyNewUser, notifyUserLogin } from '@/app/utils/discord-webhook';

/**
 * Get Steam username from Steam ID using Steam API
 */
async function getSteamUsername(steamId: string): Promise<string | null> {
  try {
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      console.warn('[First Login] STEAM_API_KEY not configured, cannot fetch username');
      return null;
    }

    // Use Steam API GetPlayerSummaries
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
    
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error('[First Login] Failed to fetch Steam username:', response.status);
      return null;
    }

    const data = await response.json();
    const players = data.response?.players;
    
    if (players && players.length > 0) {
      return players[0].personaname || players[0].realname || null;
    }

    return null;
  } catch (error) {
    console.error('[First Login] Error fetching Steam username:', error);
    return null;
  }
}

// Record first login date when user logs in via Steam
export async function POST(request: Request) {
  try {
    const { steamId, steamName } = await request.json();

    if (!steamId || typeof steamId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid steamId' }, { status: 400 });
    }

    // Validate Steam ID format (should be numeric, 17 digits)
    if (!/^\d{17}$/.test(steamId)) {
      console.warn('Invalid Steam ID format:', steamId);
      return NextResponse.json({ error: 'Invalid Steam ID format' }, { status: 400 });
    }

    // Fetch Steam username if not provided
    let finalSteamName = steamName;
    if (!finalSteamName || finalSteamName === 'Unknown') {
      const fetchedName = await getSteamUsername(steamId);
      if (fetchedName) {
        finalSteamName = fetchedName;
      }
    }

    // Record first login (only records if not already recorded)
    const isNewUser = await recordFirstLogin(steamId);
    
    // Update user count if this is a new user
    if (isNewUser) {
      await updateUserCount();
      
      // Send Discord notification for new user
      notifyNewUser(steamId, finalSteamName).catch(error => {
        console.error('Failed to send new user notification:', error);
      });
    } else {
      // Send Discord notification for regular login (existing user)
      notifyUserLogin(steamId, finalSteamName).catch(error => {
        console.error('Failed to send login notification:', error);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record first login:', error);
    return NextResponse.json({ error: 'Failed to record first login' }, { status: 500 });
  }
}
