import { NextResponse } from 'next/server';
import { getProUntil } from '@/app/utils/pro-storage';
import { dbGet, dbSet, hasDiscordAccessServer } from '@/app/utils/database';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// Helper to check if user has Discord access (Pro or consumable)
async function hasDiscordAccess(steamId: string): Promise<boolean> {
  // Check Pro status
  const proUntil = await getProUntil(steamId);
  const isPro = !!(proUntil && new Date(proUntil) > new Date());
  if (isPro) return true;

  // Check for Discord access consumable
  return await hasDiscordAccessServer(steamId);
}

async function refreshDiscordAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null> {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) return null;

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) return null;

    const tokenData = await tokenResponse.json().catch(() => null);
    const accessToken = String(tokenData?.access_token || '').trim();
    const nextRefresh = String(tokenData?.refresh_token || '').trim() || refreshToken;
    const expiresIn = Number(tokenData?.expires_in || 0);
    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;

    return {
      accessToken,
      refreshToken: nextRefresh,
      expiresAt: Date.now() + expiresIn * 1000,
    };
  } catch {
    return null;
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
      return NextResponse.json({ 
        connected: false, 
        reason: 'Pro subscription or Discord access required',
        requiresPro: true 
      });
    }

    const discordConnectionsKey = 'discord_connections';
    const connections = await dbGet<Record<string, any>>(discordConnectionsKey) || {};
    const connection = connections[steamId];

    if (!connection) {
      return NextResponse.json({ connected: false, requiresPro: false });
    }

    // Check if connection is expired
    if (connection.expiresAt && Date.now() > connection.expiresAt) {
      const refreshToken = String(connection.refreshToken || '').trim();
      const refreshed = refreshToken ? await refreshDiscordAccessToken(refreshToken) : null;
      if (!refreshed) {
        // Remove expired connection if it can't be refreshed
        delete connections[steamId];
        await dbSet(discordConnectionsKey, connections);
        return NextResponse.json({ connected: false, expired: true, requiresPro: false });
      }

      connections[steamId] = {
        ...connection,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
      };
      await dbSet(discordConnectionsKey, connections);

      return NextResponse.json({
        connected: true,
        discordId: connections[steamId].discordId,
        discordUsername: connections[steamId].discordUsername,
        discordAvatar: connections[steamId].discordAvatar,
        connectedAt: connections[steamId].connectedAt,
      });
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






