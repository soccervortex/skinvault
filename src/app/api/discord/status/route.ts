import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getProUntil } from '@/app/utils/pro-storage';

// Get Discord connection status for a Steam account
// Discord connection requires active Pro subscription
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Check Pro status first - Discord requires Pro
    const proUntil = await getProUntil(steamId);
    const isPro = !!(proUntil && new Date(proUntil) > new Date());

    if (!isPro) {
      // User is not Pro, disconnect them if they have a connection
      const discordConnectionsKey = 'discord_connections';
      const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
      if (connections[steamId]) {
        delete connections[steamId];
        await kv.set(discordConnectionsKey, connections);
      }
      return NextResponse.json({ 
        connected: false, 
        reason: 'Pro subscription required',
        requiresPro: true 
      });
    }

    const discordConnectionsKey = 'discord_connections';
    const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
    const connection = connections[steamId];

    if (!connection) {
      return NextResponse.json({ connected: false, requiresPro: true });
    }

    // Check if connection is expired
    if (connection.expiresAt && Date.now() > connection.expiresAt) {
      // Remove expired connection
      delete connections[steamId];
      await kv.set(discordConnectionsKey, connections);
      return NextResponse.json({ connected: false, expired: true, requiresPro: true });
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






