import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/api/discord/callback`;

// Discord OAuth callback - exchange code for token and link to Steam account
export async function GET(request: Request) {
  console.log('[Discord Callback] ===== CALLBACK ROUTE CALLED =====');
  console.log('[Discord Callback] Request URL:', request.url);
  
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    console.log('[Discord Callback] Code present:', !!code);
    console.log('[Discord Callback] State present:', !!state);
    
    if (!code || !state) {
      console.error('[Discord Callback] ❌ Missing code or state parameter');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_auth_failed`);
    }

    // Decode state to get steamId
    let steamId: string;
    try {
      console.log('[Discord Callback] Decoding state parameter...');
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      steamId = stateData.steamId;
      console.log('[Discord Callback] Decoded Steam ID:', steamId);
      
      // Verify state is recent (within 10 minutes)
      const stateAge = Date.now() - stateData.timestamp;
      console.log('[Discord Callback] State age:', stateAge, 'ms');
      if (stateAge > 10 * 60 * 1000) {
        console.error('[Discord Callback] ❌ State expired');
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_auth_expired`);
      }
    } catch (error) {
      console.error('[Discord Callback] ❌ Failed to decode state:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_auth_invalid`);
    }

    // Exchange code for access token
    console.log('[Discord Callback] Exchanging code for access token...');
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID!,
        client_secret: DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Discord Callback] ❌ Token exchange failed:', tokenResponse.status, errorText);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_token_failed`);
    }
    
    console.log('[Discord Callback] ✅ Token exchange successful');

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get Discord user info
    console.log('[Discord Callback] Fetching Discord user info...');
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[Discord Callback] ❌ Failed to fetch user info:', userResponse.status, errorText);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_user_failed`);
    }
    
    console.log('[Discord Callback] ✅ User info fetched successfully');

    const discordUser = await userResponse.json();
    console.log(`[Discord Callback] Received Discord user: ${discordUser.id} (${discordUser.username}) for Steam ID: ${steamId}`);

    // Store Discord connection in KV
    try {
      const discordConnectionsKey = 'discord_connections';
      const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
      
      connections[steamId] = {
        discordId: discordUser.id,
        discordUsername: `${discordUser.username}#${discordUser.discriminator}`,
        discordAvatar: discordUser.avatar,
        accessToken: accessToken, // Store for sending DMs
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        connectedAt: new Date().toISOString(),
      };
      
      await kv.set(discordConnectionsKey, connections);
      console.log(`[Discord Callback] ✅ Stored Discord connection for Steam ID ${steamId} -> Discord ID ${discordUser.id} (${discordUser.username})`);
      
      // Queue welcome message for bot to process
      const welcomeMessage = `🎉 **Thanks for connecting to SkinVault Bot!**

You can now:
• Set **price alerts** for CS2 skins
• Receive notifications when prices hit your target
• Use **/wishlist** to view your tracked items
• Manage alerts from your profile on skinvaults.vercel.app

**Commands:**
\`/wishlist\` - View your wishlist with prices
\`/price\` - Check the price of a skin
\`/vault\` - View your total vault value
\`/stats\` - View your CS2 statistics
\`/help\` - Get help with commands

Happy trading! 🚀`;
      
      // Queue the message directly for bot to process
      const welcomeQueueKey = 'discord_dm_queue';
      console.log(`[Discord Callback] 📬 Attempting to queue welcome message for Discord user ${discordUser.id}...`);
      
      try {
        const existingQueue = await kv.get<Array<{ discordId: string; message: string; timestamp: number }>>(welcomeQueueKey) || [];
        console.log(`[Discord Callback] 📬 Current queue size before add: ${existingQueue.length}`);
        
        // Check if message already exists for this user (avoid duplicates)
        const existingIndex = existingQueue.findIndex(msg => msg.discordId === discordUser.id);
        if (existingIndex >= 0) {
          // Update existing message
          console.log(`[Discord Callback] 📬 Updating existing message for user ${discordUser.id}`);
          existingQueue[existingIndex] = {
            discordId: discordUser.id,
            message: welcomeMessage,
            timestamp: Date.now(),
          };
        } else {
          // Add new message
          console.log(`[Discord Callback] 📬 Adding new message for user ${discordUser.id}`);
          existingQueue.push({
            discordId: discordUser.id,
            message: welcomeMessage,
            timestamp: Date.now(),
          });
        }
        
        console.log(`[Discord Callback] 📬 Queue size before write: ${existingQueue.length}`);
        
        // Write to KV with retry logic
        let writeSuccess = false;
        let retries = 3;
        while (retries > 0 && !writeSuccess) {
          try {
            await kv.set(welcomeQueueKey, existingQueue);
            writeSuccess = true;
            console.log(`[Discord Callback] ✅ KV write successful`);
          } catch (writeError) {
            retries--;
            console.error(`[Discord Callback] ⚠️ KV write failed, retries left: ${retries}`, writeError);
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            }
          }
        }
        
        if (!writeSuccess) {
          console.error(`[Discord Callback] ❌ ERROR: Failed to write to KV after 3 retries!`);
        } else {
          // Verify the write worked (with a small delay to ensure consistency)
          await new Promise(resolve => setTimeout(resolve, 100));
          const verifyQueue = await kv.get<Array<{ discordId: string; message: string; timestamp: number }>>(welcomeQueueKey) || [];
          console.log(`[Discord Callback] ✅ Welcome message queued. Queue size after write: ${verifyQueue.length}`);
          
          if (verifyQueue.length === 0) {
            console.error(`[Discord Callback] ❌ ERROR: Queue is empty after write! KV write may have failed.`);
          } else {
            const userInQueue = verifyQueue.find(msg => msg.discordId === discordUser.id);
            if (!userInQueue) {
              console.error(`[Discord Callback] ❌ ERROR: User ${discordUser.id} not found in queue after write!`);
            } else {
              console.log(`[Discord Callback] ✅ Verified: User ${discordUser.id} is in queue`);
            }
          }
        }
      } catch (welcomeError) {
        console.error('[Discord Callback] ❌ Failed to queue welcome message:', welcomeError);
        console.error('[Discord Callback] Error details:', welcomeError instanceof Error ? welcomeError.stack : String(welcomeError));
        // Don't fail the connection if welcome message fails
      }
    } catch (error) {
      console.error('[Discord Callback] ❌ Failed to store Discord connection:', error);
      console.error('[Discord Callback] Error details:', error instanceof Error ? error.stack : String(error));
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_storage_failed`);
    }

    console.log('[Discord Callback] ===== SUCCESS - Redirecting to /pro =====');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?discord=connected`);
  } catch (error) {
    console.error('[Discord Callback] ===== FATAL ERROR =====');
    console.error('[Discord Callback] Error:', error);
    console.error('[Discord Callback] Error details:', error instanceof Error ? error.stack : String(error));
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_callback_failed`);
  }
}

