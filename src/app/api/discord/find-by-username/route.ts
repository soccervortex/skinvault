import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Find Discord connection by username (searches through all connections)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    
    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 });
    }

    const discordConnectionsKey = 'discord_connections';
    const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
    
    // Normalize search query (remove discriminator if present, lowercase)
    const normalizedQuery = username.split('#')[0].toLowerCase().trim();
    
    // Search through all connections
    for (const [steamId, connection] of Object.entries(connections)) {
      if (!connection.discordUsername) continue;
      
      // Check if connection is expired
      if (connection.expiresAt && Date.now() > connection.expiresAt) {
        continue; // Skip expired connections
      }
      
      // Normalize stored username (handle both old format with # and new format without)
      const storedUsername = connection.discordUsername.split('#')[0].toLowerCase().trim();
      
      // Match username (case-insensitive, without discriminator)
      if (storedUsername === normalizedQuery) {
        return NextResponse.json({ 
          discordId: connection.discordId, 
          steamId,
          username: connection.discordUsername 
        });
      }
    }

    return NextResponse.json({ error: 'Discord username not found' }, { status: 404 });
  } catch (error) {
    console.error('Find Discord user error:', error);
    return NextResponse.json({ error: 'Failed to find Discord user' }, { status: 500 });
  }
}

