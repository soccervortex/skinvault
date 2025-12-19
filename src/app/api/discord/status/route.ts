import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Get Discord connection status for a Steam account
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const discordConnectionsKey = 'discord_connections';
    const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
    const connection = connections[steamId];

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    // Check if connection is expired
    if (connection.expiresAt && Date.now() > connection.expiresAt) {
      return NextResponse.json({ connected: false, expired: true });
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


