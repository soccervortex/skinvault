import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';

// Find Discord connection by username (searches through all connections)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    
    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 });
    }

    const discordConnectionsKey = 'discord_connections';
    const connections = (await dbGet<Record<string, any>>(discordConnectionsKey)) || {};
    
    // Normalize search query (remove discriminator if present, lowercase, trim)
    const normalizedQuery = username.split('#')[0].toLowerCase().trim().replace(/\s+/g, '');
    
    console.log(`[Discord Search] Looking for username: "${username}" (normalized: "${normalizedQuery}")`);
    console.log(`[Discord Search] Found ${Object.keys(connections).length} connections in database`);
    
    // Search through all connections
    for (const [steamId, connection] of Object.entries(connections)) {
      if (!connection.discordUsername) continue;
      
      // Check if connection is expired
      if (connection.expiresAt && Date.now() > connection.expiresAt) {
        console.log(`[Discord Search] Skipping expired connection for ${steamId}`);
        continue; // Skip expired connections
      }
      
      // Normalize stored username (handle both old format with # and new format without)
      const storedUsername = String(connection.discordUsername).split('#')[0].toLowerCase().trim().replace(/\s+/g, '');
      
      console.log(`[Discord Search] Comparing: "${storedUsername}" (from "${connection.discordUsername}") with "${normalizedQuery}"`);
      
      // Match username (case-insensitive, without discriminator)
      // Also try partial match (in case of extra characters)
      if (storedUsername === normalizedQuery || 
          storedUsername.includes(normalizedQuery) || 
          normalizedQuery.includes(storedUsername)) {
        console.log(`[Discord Search] ✅ Match found! Steam ID: ${steamId}, Discord ID: ${connection.discordId}`);
        return NextResponse.json({ 
          discordId: connection.discordId, 
          steamId,
          username: connection.discordUsername 
        });
      }
    }
    
    console.log(`[Discord Search] ❌ No match found for "${username}"`);

    return NextResponse.json({ error: 'Discord username not found' }, { status: 404 });
  } catch (error) {
    console.error('Find Discord user error:', error);
    return NextResponse.json({ error: 'Failed to find Discord user' }, { status: 500 });
  }
}

