import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/api/discord/callback`;

// Discord OAuth callback - exchange code for token and link to Steam account
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_auth_failed`);
    }

    // Decode state to get steamId
    let steamId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      steamId = stateData.steamId;
      
      // Verify state is recent (within 10 minutes)
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_auth_expired`);
      }
    } catch {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_auth_invalid`);
    }

    // Exchange code for access token
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
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_token_failed`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get Discord user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_user_failed`);
    }

    const discordUser = await userResponse.json();

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
      
      // Queue welcome message via bot gateway
      try {
        const welcomeQueueKey = 'discord_dm_queue';
        const welcomeQueue = await kv.get<Array<{ discordId: string; message: string; timestamp: number }>>(welcomeQueueKey) || [];
        const welcomeMessage = `🎉 **Thanks for connecting with SkinVault Bot!**

You can now:
• Set up **price alerts** for CS2 skins
• Get notified when prices hit your target
• Use **/wishlist** to view your tracked items
• Manage alerts from your profile at skinvaults.vercel.app

**Commands:**
\`/wishlist\` - View your wishlist with prices
\`/help\` - Get help with commands

Happy trading! 🚀`;
        
        welcomeQueue.push({
          discordId: discordUser.id,
          message: welcomeMessage,
          timestamp: Date.now(),
        });
        await kv.set(welcomeQueueKey, welcomeQueue);
      } catch (welcomeError) {
        console.error('Failed to queue welcome message:', welcomeError);
        // Don't fail the connection if welcome message fails
      }
    } catch (error) {
      console.error('Failed to store Discord connection:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_storage_failed`);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?discord=connected`);
  } catch (error) {
    console.error('Discord callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/pro?error=discord_callback_failed`);
  }
}

