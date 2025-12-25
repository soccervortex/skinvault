/**
 * New User Welcome Posts
 * Posts on X when a new user joins the platform
 */

import { dbGet, dbSet } from '@/app/utils/database';
import { getFirstLoginDate } from '@/app/utils/pro-storage';
import crypto from 'crypto';

const NEW_USERS_POSTED_KEY = 'new_users_posted'; // Track which users we've already posted about
const NEW_USER_POSTS_ENABLED_KEY = 'new_user_posts_enabled'; // Enable/disable new user posts

export interface NewUser {
  steamId: string;
  steamName: string;
  firstLoginDate: string;
  posted: boolean;
  postId?: string;
}

/**
 * Get Steam username from Steam ID using Steam API
 */
async function getSteamUsername(steamId: string): Promise<string | null> {
  try {
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      console.warn('[New User Post] STEAM_API_KEY not configured, cannot fetch username');
      return null;
    }

    // Use Steam API GetPlayerSummaries
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
    
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error('[New User Post] Failed to fetch Steam username:', response.status);
      return null;
    }

    const data = await response.json();
    const players = data.response?.players;
    
    if (players && players.length > 0) {
      return players[0].personaname || players[0].realname || null;
    }

    return null;
  } catch (error) {
    console.error('[New User Post] Error fetching Steam username:', error);
    return null;
  }
}

/**
 * Get unposted new users (users who joined in the last 24 hours and haven't been posted about)
 * Reads directly from first_logins database
 */
export async function getUnpostedNewUsers(): Promise<NewUser[]> {
  try {
    const postedUsers = (await dbGet<Record<string, { posted: boolean; postId?: string; postedAt?: string }>>(NEW_USERS_POSTED_KEY)) || {};
    console.log('[New User Post] Posted users:', Object.keys(postedUsers).length);
    
    // Read directly from first_logins database (KV or MongoDB)
    const FIRST_LOGINS_KEY = 'first_logins';
    const firstLogins = (await dbGet<Record<string, string>>(FIRST_LOGINS_KEY)) || {};
    console.log('[New User Post] Total first logins:', Object.keys(firstLogins).length);
    console.log('[New User Post] First logins data:', JSON.stringify(firstLogins, null, 2));
    
    const unpostedUsers: NewUser[] = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    console.log('[New User Post] Checking for users between', twentyFourHoursAgo.toISOString(), 'and', now.toISOString());

    // Check all users with first login dates
    for (const [steamId, firstLoginDate] of Object.entries(firstLogins)) {
      // Skip if already posted
      if (postedUsers[steamId]?.posted) {
        console.log(`[New User Post] Skipping ${steamId} - already posted`);
        continue;
      }

      if (!firstLoginDate) {
        console.log(`[New User Post] Skipping ${steamId} - no login date`);
        continue;
      }

      const loginDate = new Date(firstLoginDate);
      console.log(`[New User Post] Checking ${steamId}: loginDate=${loginDate.toISOString()}, twentyFourHoursAgo=${twentyFourHoursAgo.toISOString()}, isRecent=${loginDate >= twentyFourHoursAgo}`);
      
      // Only include users who joined in the last 24 hours
      if (loginDate >= twentyFourHoursAgo) {
        console.log(`[New User Post] User ${steamId} is recent, fetching Steam username...`);
        // Get Steam username
        const steamName = await getSteamUsername(steamId);
        console.log(`[New User Post] Steam username for ${steamId}:`, steamName);
        
        if (steamName) {
          unpostedUsers.push({
            steamId,
            steamName: steamName, // Ensure it's a string, not undefined
            firstLoginDate,
            posted: false,
          });
          console.log(`[New User Post] Added ${steamId} (${steamName}) to unposted users`);
        } else {
          console.log(`[New User Post] Skipping ${steamId} - could not fetch Steam username`);
        }
      } else {
        console.log(`[New User Post] User ${steamId} is too old (${Math.round((now.getTime() - loginDate.getTime()) / (1000 * 60 * 60))} hours ago)`);
      }
    }

    // Sort by first login date (oldest first, so we post about them in order)
    unpostedUsers.sort((a, b) => 
      new Date(a.firstLoginDate).getTime() - new Date(b.firstLoginDate).getTime()
    );

    return unpostedUsers;
  } catch (error) {
    console.error('[New User Post] Failed to get unposted new users:', error);
    return [];
  }
}

/**
 * Create a welcome post for one or more new users
 */
export async function createNewUserWelcomePost(users: NewUser | NewUser[]): Promise<{ success: boolean; postId?: string; error?: string; postedUsers?: NewUser[] }> {
  try {
    // Check if new user posts are enabled
    const enabled = (await dbGet<boolean>(NEW_USER_POSTS_ENABLED_KEY)) ?? true; // Default to enabled
    if (!enabled) {
      return { success: false, error: 'New user posts are disabled' };
    }

    // Normalize to array
    const usersArray = Array.isArray(users) ? users : [users];
    
    if (usersArray.length === 0) {
      return { success: false, error: 'No users provided' };
    }

    let message = '';
    
    if (usersArray.length === 1) {
      // Single user - personalized message
      const user = usersArray[0];
    const welcomeMessages = [
      `Hey ${user.steamName}! 👋 Welcome to SkinVaults! 🎮\n\nWe're excited to have you join our CS2 community! Are you using our website to track your inventory? Let us know what you think! 💬\n\n🔗 skinvaults.online\n\n#CS2Skins #CounterStrike2 #Skinvaults @counterstrike`,
      `Welcome ${user.steamName}! 🎉\n\nThanks for joining SkinVaults! We'd love to hear about your experience using our platform. What features are you most excited about? 🚀\n\n🔗 skinvaults.online\n\n#CS2Skins #CounterStrike2 #Skinvaults @counterstrike`,
      `Hey ${user.steamName}! 👋\n\nWelcome to the SkinVaults family! 🎮 Are you already using our website to manage your CS2 inventory? Share your thoughts with us! 💭\n\n🔗 skinvaults.online\n\n#CS2Skins #CounterStrike2 #Skinvaults @counterstrike`,
    ];
      message = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    } else {
      // Multiple users - combine in one post with all names
      const userNames = usersArray.map(u => u.steamName).join(', ');
      const userCount = usersArray.length;
      
      const multiUserMessages = [
        `Welcome ${userNames}! 👋🎉\n\n${userCount} new users joined SkinVaults! 🎮\n\nThanks for joining our CS2 community! Are you using our website to track your inventory? Let us know what you think! 💬\n\n🔗 skinvaults.online\n\n#CS2Skins #CounterStrike2 #Skinvaults @counterstrike`,
        `Hey ${userNames}! 👋\n\n${userCount} new members joined SkinVaults! 🚀\n\nWe're excited to have you in our CS2 community! What features are you most excited about?\n\n🔗 skinvaults.online\n\n#CS2Skins #CounterStrike2 #Skinvaults @counterstrike`,
        `Welcome ${userNames}! 🎉\n\n${userCount} new users just joined the SkinVaults family! 🎮\n\nAre you already using our website to manage your CS2 inventory? Share your thoughts with us! 💭\n\n🔗 skinvaults.online\n\n#CS2Skins #CounterStrike2 #Skinvaults @counterstrike`,
      ];
      message = multiUserMessages[Math.floor(Math.random() * multiUserMessages.length)];
    }

    // Create post using the automated posting function (without image for welcome posts)
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET || process.env.X_APISECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
      return { success: false, error: 'X API credentials not configured' };
    }

    // Generate OAuth header
    function generateOAuthHeader(method: string, url: string): string {
      const oauthParams: Record<string, string> = {
        oauth_consumer_key: X_API_KEY!,
        oauth_token: X_ACCESS_TOKEN!,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_version: '1.0',
      };

      const sortedParams = Object.keys(oauthParams)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
        .join('&');

      const signatureBaseString = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(sortedParams),
      ].join('&');

      const signingKey = `${encodeURIComponent(X_API_SECRET!)}&${encodeURIComponent(X_ACCESS_TOKEN_SECRET!)}`;
      const signature = crypto.createHmac('sha1', signingKey)
        .update(signatureBaseString)
        .digest('base64');

      oauthParams.oauth_signature = signature;

      return 'OAuth ' + Object.keys(oauthParams)
        .sort()
        .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
        .join(', ');
    }

    // Post to X
    const url = 'https://api.x.com/2/tweets';
    const body = {
      text: message.substring(0, 280), // Ensure within character limit
    };

    const authHeader = generateOAuthHeader('POST', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { detail: responseText || 'Unknown error' };
      }
      return { success: false, error: errorData.detail || errorData.title || errorData.message || 'Failed to post' };
    }

    const data = JSON.parse(responseText);
    const postId = data.data?.id;

    if (postId) {
      // Mark all users as posted
      const postedUsers = (await dbGet<Record<string, { posted: boolean; postId?: string; postedAt?: string }>>(NEW_USERS_POSTED_KEY)) || {};
      const now = new Date().toISOString();
      
      for (const user of usersArray) {
      postedUsers[user.steamId] = {
        posted: true,
        postId,
          postedAt: now,
      };
      }
      
      await dbSet(NEW_USERS_POSTED_KEY, postedUsers);

      const userNames = usersArray.map(u => u.steamName).join(', ');
      console.log(`[New User Post] Successfully posted welcome message for ${usersArray.length} user(s): ${userNames}`);
      return { success: true, postId, postedUsers: usersArray };
    }

    return { success: false, error: 'No post ID returned' };
  } catch (error: any) {
    console.error('[New User Post] Error creating welcome post:', error);
    return { success: false, error: error.message || 'Failed to create welcome post' };
  }
}

/**
 * Check for new users and create welcome posts
 * This should be called periodically (e.g., every hour)
 */
export async function checkAndPostNewUsers(): Promise<{ posted: number; errors: number }> {
  try {
    const unpostedUsers = await getUnpostedNewUsers();
    let posted = 0;
    let errors = 0;

    // Post about new users (limit to 1 per hour to avoid spam)
    for (const user of unpostedUsers.slice(0, 1)) {
      const result = await createNewUserWelcomePost(user);
      if (result.success) {
        posted++;
      } else {
        errors++;
        console.error(`[New User Post] Failed to post for ${user.steamName}:`, result.error);
      }
    }

    return { posted, errors };
  } catch (error) {
    console.error('[New User Post] Error checking for new users:', error);
    return { posted: 0, errors: 1 };
  }
}

