import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.skinvaults.online';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `${DEFAULT_BASE_URL}/api/discord/callback`;

// Discord OAuth callback - exchange code for token and link to Steam account
export async function GET(request: Request) {
  // Log immediately - this should ALWAYS appear if route is hit
  console.log('[Discord Callback] ===== CALLBACK ROUTE CALLED =====');
  console.log('[Discord Callback] Timestamp:', new Date().toISOString());
  console.log('[Discord Callback] Request URL:', request.url);
  console.log('[Discord Callback] Request method:', request.method);
  console.log('[Discord Callback] Headers:', JSON.stringify(Object.fromEntries(request.headers.entries())));
  
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    console.log('[Discord Callback] Code present:', !!code);
    console.log('[Discord Callback] State present:', !!state);
    
    if (!code) {
      console.error('[Discord Callback] ❌ Missing code parameter');
      return NextResponse.redirect(`${DEFAULT_BASE_URL}/pro?error=discord_auth_failed`);
    }

    // If state is missing, this is most likely a generic Discord install callback (guild install)
    // and not a Steam-account linking flow. In that case we just finish successfully.
    if (!state) {
      console.log('[Discord Callback] ℹ️ No state provided. Treating as install-only callback.');
      return NextResponse.redirect(`${DEFAULT_BASE_URL}/inventory?discord=installed`);
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
        return NextResponse.redirect(`${DEFAULT_BASE_URL}/pro?error=discord_auth_expired`);
      }
    } catch (error) {
      console.error('[Discord Callback] ❌ Failed to decode state:', error);
      return NextResponse.redirect(`${DEFAULT_BASE_URL}/pro?error=discord_auth_invalid`);
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
      return NextResponse.redirect(`${DEFAULT_BASE_URL}/pro?error=discord_token_failed`);
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
      return NextResponse.redirect(`${DEFAULT_BASE_URL}/pro?error=discord_user_failed`);
    }
    
    console.log('[Discord Callback] ✅ User info fetched successfully');

    const discordUser = await userResponse.json();
    console.log(`[Discord Callback] Received Discord user: ${discordUser.id} (${discordUser.username}) for Steam ID: ${steamId}`);

    // Store Discord connection (database abstraction)
    try {
      const discordConnectionsKey = 'discord_connections';
      const connections = await dbGet<Record<string, any>>(discordConnectionsKey) || {};
      
      connections[steamId] = {
        discordId: discordUser.id,
        discordUsername: `${discordUser.username}#${discordUser.discriminator}`,
        discordAvatar: discordUser.avatar,
        accessToken: accessToken, // Store for sending DMs
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        connectedAt: new Date().toISOString(),
      };
      
      await dbSet(discordConnectionsKey, connections);
      console.log(`[Discord Callback] ✅ Stored Discord connection for Steam ID ${steamId} -> Discord ID ${discordUser.id} (${discordUser.username})`);
      
      // Trigger role sync for this user
      try {
        const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online'}/api/discord/sync-roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discordId: discordUser.id,
            steamId: steamId,
            reason: 'discord_connected',
          }),
        });
        if (syncResponse.ok) {
          console.log(`[Discord Callback] ✅ Triggered role sync for ${discordUser.username}`);
        }
      } catch (error) {
        console.error('[Discord Callback] ⚠️ Failed to trigger role sync:', error);
      }
      
      // Queue welcome message for bot to process - THIS MUST RUN
      console.log(`[Discord Callback] 🚀 Starting welcome message queue process...`);
      
      const welcomeMessage = `🎉 **Thanks for connecting to SkinVault Bot!**

**⚠️ IMPORTANT:** Discord bot features require an active **Pro subscription**. If your Pro subscription expires, Discord features will be disabled.

You can now:
• Set **price alerts** for CS2 skins
• Receive notifications when prices hit your target
• Use **/wishlist** to view your tracked items
• Use **/vault** to view your total vault value
• Manage alerts from your profile on skinvaults.online

**Commands (Pro Required):**
\`/wishlist\` - View your wishlist with prices
\`/vault\` - View your total vault value
\`/help\` - Get help with commands

**Note:** All Discord bot commands require Pro. Upgrade at skinvaults.online/pro

Happy trading! 🚀`;
      
      // Queue the message directly for bot to process
      const welcomeQueueKey = 'discord_dm_queue';
      console.log(`[Discord Callback] 📬 STEP 1: Attempting to queue welcome message for Discord user ${discordUser.id}...`);
      
      try {
        console.log(`[Discord Callback] 📬 STEP 2: About to read queue from KV...`);
        const existingQueue = await dbGet<Array<{ discordId: string; message: string; timestamp: number }>>(welcomeQueueKey) || [];
        console.log(`[Discord Callback] 📬 STEP 3: Read queue from KV. Current queue size: ${existingQueue.length}`);
        
        // Check if message already exists for this user (avoid duplicates)
        console.log(`[Discord Callback] 📬 STEP 4: Checking for existing message for user ${discordUser.id}...`);
        const existingIndex = existingQueue.findIndex(msg => msg.discordId === discordUser.id);
        if (existingIndex >= 0) {
          // Update existing message
          console.log(`[Discord Callback] 📬 STEP 5: Updating existing message at index ${existingIndex}`);
          existingQueue[existingIndex] = {
            discordId: discordUser.id,
            message: welcomeMessage,
            timestamp: Date.now(),
          };
        } else {
          // Add new message
          console.log(`[Discord Callback] 📬 STEP 5: Adding NEW message to queue`);
          existingQueue.push({
            discordId: discordUser.id,
            message: welcomeMessage,
            timestamp: Date.now(),
          });
        }
        
        console.log(`[Discord Callback] 📬 STEP 6: Queue size after modification: ${existingQueue.length}`);
        
        // Write to KV with retry logic
        console.log(`[Discord Callback] 📬 STEP 7: Starting KV write with retry logic...`);
        let writeSuccess = false;
        let retries = 3;
        while (retries > 0 && !writeSuccess) {
          try {
            console.log(`[Discord Callback] 📬 STEP 7.${4 - retries}: Attempting KV write (retry ${4 - retries}/3)...`);
            await dbSet(welcomeQueueKey, existingQueue);
            writeSuccess = true;
            console.log(`[Discord Callback] ✅ STEP 7: KV write successful!`);
          } catch (writeError) {
            retries--;
            console.error(`[Discord Callback] ⚠️ KV write failed, retries left: ${retries}`, writeError);
            if (retries > 0) {
              console.log(`[Discord Callback] ⏳ Waiting 500ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            }
          }
        }
        
        if (!writeSuccess) {
          console.error(`[Discord Callback] ❌ STEP 8: ERROR - Failed to write to KV after 3 retries!`);
        } else {
          // Verify the write worked (with a small delay to ensure consistency)
          console.log(`[Discord Callback] 📬 STEP 8: Verifying KV write (waiting 100ms for consistency)...`);
          await new Promise(resolve => setTimeout(resolve, 100));
          const verifyQueue = await dbGet<Array<{ discordId: string; message: string; timestamp: number }>>(welcomeQueueKey) || [];
          console.log(`[Discord Callback] 📬 STEP 9: Verification read complete. Queue size: ${verifyQueue.length}`);
          
          if (verifyQueue.length === 0) {
            console.error(`[Discord Callback] ❌ STEP 9: ERROR - Queue is empty after write! KV write may have failed.`);
          } else {
            const userInQueue = verifyQueue.find(msg => msg.discordId === discordUser.id);
            if (!userInQueue) {
              console.error(`[Discord Callback] ❌ STEP 9: ERROR - User ${discordUser.id} not found in queue after write!`);
              console.error(`[Discord Callback] Queue contents:`, JSON.stringify(verifyQueue.map(m => ({ id: m.discordId, ts: m.timestamp }))));
            } else {
              console.log(`[Discord Callback] ✅ STEP 9: SUCCESS - Verified user ${discordUser.id} is in queue!`);
              console.log(`[Discord Callback] ✅ Welcome message successfully queued and verified!`);
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
      return NextResponse.redirect(`${DEFAULT_BASE_URL}/pro?error=discord_storage_failed`);
    }

    console.log('[Discord Callback] ===== SUCCESS - Redirecting to /inventory =====');
    return NextResponse.redirect(`${DEFAULT_BASE_URL}/inventory?discord=connected`);
  } catch (error) {
    console.error('[Discord Callback] ===== FATAL ERROR =====');
    console.error('[Discord Callback] Error:', error);
    console.error('[Discord Callback] Error details:', error instanceof Error ? error.stack : String(error));
    return NextResponse.redirect(`${DEFAULT_BASE_URL}/pro?error=discord_callback_failed`);
  }
}

