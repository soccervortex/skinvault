import { NextResponse } from 'next/server';
import { dbGet, dbSet, hasDiscordAccessServer } from '@/app/utils/database';
import { OWNER_STEAM_IDS } from '@/app/utils/owner-ids';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// Helper to check if user has Discord access (Pro or consumable)
async function hasDiscordAccess(steamId: string): Promise<boolean> {
  // Check Pro status
  const data = (await dbGet<Record<string, string>>('pro_users', false)) || {};
  let proUntil = data[steamId] || null;
  if ((OWNER_STEAM_IDS as any).includes(steamId) && !proUntil) {
    proUntil = '2999-01-01T00:00:00.000Z';
  }
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

    const discordConnectionsKey = 'discord_connections';
    const connections = await dbGet<Record<string, any>>(discordConnectionsKey, false) || {};
    const connection = connections[steamId];

    if (!connection) {
      if (!hasAccess) {
        return NextResponse.json({
          connected: false,
          hasAccess: false,
          reason: 'Pro subscription or Discord access required',
          requiresPro: true,
        });
      }
      return NextResponse.json({ connected: false, hasAccess: true, requiresPro: false });
    }

    // We consider the account "linked" as long as a Discord ID exists.
    const discordId = String(connection.discordId || '').trim() || null;
    const discordUsername = connection.discordUsername;
    const discordAvatar = connection.discordAvatar;
    const connectedAt = connection.connectedAt;

    if (!discordId) {
      if (!hasAccess) {
        return NextResponse.json({
          connected: false,
          hasAccess: false,
          reason: 'Pro subscription or Discord access required',
          requiresPro: true,
        });
      }
      return NextResponse.json({ connected: false, hasAccess: true, requiresPro: false });
    }

    // If the user doesn't currently have access, keep the link but report that access is missing.
    if (!hasAccess) {
      return NextResponse.json({
        connected: true,
        hasAccess: false,
        reason: 'Pro subscription or Discord access required',
        requiresPro: true,
        discordId,
        discordUsername,
        discordAvatar,
        connectedAt,
      });
    }

    // Check if connection is expired
    if (connection.expiresAt && Date.now() > connection.expiresAt) {
      const refreshToken = String(connection.refreshToken || '').trim();
      const refreshed = refreshToken ? await refreshDiscordAccessToken(refreshToken) : null;
      if (!refreshed) {
        // Do not delete the stored link; just signal that a reconnect may be needed.
        return NextResponse.json({
          connected: true,
          hasAccess: true,
          requiresPro: false,
          discordId,
          discordUsername,
          discordAvatar,
          connectedAt,
          tokenExpired: true,
          needsReconnect: true,
        });
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
        hasAccess: true,
        requiresPro: false,
        discordId: connections[steamId].discordId,
        discordUsername: connections[steamId].discordUsername,
        discordAvatar: connections[steamId].discordAvatar,
        connectedAt: connections[steamId].connectedAt,
      });
    }

    return NextResponse.json({
      connected: true,
      hasAccess: true,
      requiresPro: false,
      discordId,
      discordUsername,
      discordAvatar,
      connectedAt,
    });
  } catch (error) {
    console.error('Discord status error:', error);
    return NextResponse.json({ error: 'Failed to get Discord status' }, { status: 500 });
  }
}






