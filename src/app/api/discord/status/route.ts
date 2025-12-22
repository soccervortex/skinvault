import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getProUntil } from '@/app/utils/pro-storage';

// Helper to check if user has Discord access (Pro or consumable)
async function hasDiscordAccess(steamId: string): Promise<boolean> {
  // Check Pro status
  const proUntil = await getProUntil(steamId);
  const isPro = !!(proUntil && new Date(proUntil) > new Date());
  if (isPro) return true;

  // Check for Discord access consumable
  try {
    const rewardsKey = 'user_rewards';
    const existingRewards = await kv.get<Record<string, any[]>>(rewardsKey) || {};
    const userRewards = existingRewards[steamId] || [];
    return userRewards.some((r: any) => r?.type === 'discord_access');
  } catch {
    return false;
  }
}

// Get Discord connection status for a Steam account
// Discord connection requires Pro subscription OR Discord access consumable
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Check if user has Discord access (Pro or consumable)
    const hasAccess = await hasDiscordAccess(steamId);

    if (!hasAccess) {
      // User doesn't have access, disconnect them if they have a connection
      const discordConnectionsKey = 'discord_connections';
      const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
      if (connections[steamId]) {
        delete connections[steamId];
        await kv.set(discordConnectionsKey, connections);
      }
      return NextResponse.json({ 
        connected: false, 
        reason: 'Pro subscription or Discord access required',
        requiresPro: true 
      });
    }

    const discordConnectionsKey = 'discord_connections';
    const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
    const connection = connections[steamId];

    if (!connection) {
      return NextResponse.json({ connected: false, requiresPro: false });
    }

    // Check if connection is expired
    if (connection.expiresAt && Date.now() > connection.expiresAt) {
      // Remove expired connection
      delete connections[steamId];
      await kv.set(discordConnectionsKey, connections);
      return NextResponse.json({ connected: false, expired: true, requiresPro: false });
    }

    return NextResponse.json({
      connected: true,
      discordId: connection.discordId,
      discordUsername: connection.discordUsername,
      discordAvatar: connection.discordAvatar,
      connectedAt: connection.connectedAt,
    });
  } catch (error) {
    console.error('Discord status error:', error);
    return NextResponse.json({ error: 'Failed to get Discord status' }, { status: 500 });
  }
}






