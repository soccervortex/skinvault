import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Disconnect Discord from Steam account
export async function POST(request: Request) {
  try {
    const { steamId } = await request.json();
    
    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Remove Discord connection
    const discordConnectionsKey = 'discord_connections';
    const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
    
    if (connections[steamId]) {
      delete connections[steamId];
      await kv.set(discordConnectionsKey, connections);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Discord disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect Discord' }, { status: 500 });
  }
}

