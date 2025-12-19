import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Get Steam ID from Discord ID
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const discordId = url.searchParams.get('discordId');
    
    if (!discordId) {
      return NextResponse.json({ error: 'Missing discordId' }, { status: 400 });
    }

    const discordConnectionsKey = 'discord_connections';
    const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
    
    // Find Steam ID by Discord ID
    for (const [steamId, connection] of Object.entries(connections)) {
      if (connection.discordId === discordId) {
        // Check if connection is still valid
        if (connection.expiresAt && Date.now() > connection.expiresAt) {
          continue; // Skip expired connections
        }
        return NextResponse.json({ steamId, discordId, username: connection.discordUsername });
      }
    }

    return NextResponse.json({ error: 'Discord account not connected' }, { status: 404 });
  } catch (error) {
    console.error('Get Steam ID error:', error);
    return NextResponse.json({ error: 'Failed to get Steam ID' }, { status: 500 });
  }
}

