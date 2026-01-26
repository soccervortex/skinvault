import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

// Get Steam ID from Discord ID
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const discordId = url.searchParams.get('discordId');
    
    if (!discordId) {
      return NextResponse.json({ error: 'Missing discordId' }, { status: 400 });
    }

    const discordConnectionsKey = 'discord_connections';
    const connections = await dbGet<Record<string, any>>(discordConnectionsKey) || {};
    
    // Find Steam ID by Discord ID
    for (const [steamId, connection] of Object.entries(connections)) {
      if (connection && connection.discordId === discordId) {
        // Check if connection is still valid
        if (connection.expiresAt && Date.now() > connection.expiresAt) {
          continue; // Skip expired connections
        }
        return NextResponse.json({ steamId, discordId, username: connection.discordUsername });
      }
    }

    // Fallback: check user_settings (manual Discord ID entry)
    try {
      if (hasMongoConfig()) {
        const db = await getDatabase();
        const col = db.collection<any>('user_settings');
        const doc = await col.findOne({ discordId: String(discordId) } as any);
        const steamId = String(doc?._id || doc?.steamId || '').trim();
        if (/^\d{17}$/.test(steamId)) {
          return NextResponse.json({ steamId, discordId, username: null });
        }
      }
    } catch {
    }

    return NextResponse.json({ error: 'Discord account not connected' }, { status: 404 });
  } catch (error) {
    console.error('Get Steam ID error:', error);
    return NextResponse.json({ error: 'Failed to get Steam ID' }, { status: 500 });
  }
}

