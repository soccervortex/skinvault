import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { setupChatIndexes, CHAT_INDEXES } from '@/app/utils/mongodb-indexes';

const MONGODB_URI = process.env.MONGODB_URI || '';

/**
 * API route to set up MongoDB indexes for optimal chat performance
 * This should be run once after deployment or when new collections are created
 * 
 * Access: Admin only (check owner IDs)
 */
export async function POST(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    // Check if user is admin/owner
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');
    
    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const { isOwner } = await import('@/app/utils/owner-ids');
    if (!isOwner(steamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Use shared connection pool
    const db = await getDatabase();
    
    try {
      // Get client from database for setupChatIndexes
      const { getMongoClient } = await import('@/app/utils/mongodb-client');
      const client = await getMongoClient();
      await setupChatIndexes(client, db.databaseName);
      
      // Also create indexes on existing collections manually
      
      // Get all collections
      const collections = await db.listCollections().toArray();
      
      const results: string[] = [];
      
      for (const col of collections) {
        if (col.name.startsWith('chats_') || col.name.startsWith('dms_')) {
          const collection = db.collection(col.name);
          
          // Create timestamp index for sorting
          try {
            await collection.createIndex({ timestamp: -1 }, { name: 'timestamp_desc' });
            results.push(`✅ Created timestamp index on ${col.name}`);
          } catch (error: any) {
            if (error?.code === 85) {
              results.push(`⚠️  Index already exists on ${col.name}`);
            } else {
              results.push(`❌ Failed to create index on ${col.name}: ${error.message}`);
            }
          }
          
          // For DM collections, also create compound index
          if (col.name.startsWith('dms_')) {
            try {
              await collection.createIndex({ dmId: 1, timestamp: -1 }, { name: 'dmId_timestamp_desc' });
              results.push(`✅ Created dmId_timestamp index on ${col.name}`);
            } catch (error: any) {
              if (error?.code === 85) {
                results.push(`⚠️  Index already exists on ${col.name}`);
              }
            }
          }
        } else if (col.name === 'dm_invites') {
          const collection = db.collection(col.name);
          try {
            await collection.createIndex({ fromSteamId: 1, toSteamId: 1, status: 1 }, { name: 'invite_lookup' });
            results.push(`✅ Created invite_lookup index on ${col.name}`);
          } catch (error: any) {
            if (error?.code === 85) {
              results.push(`⚠️  Index already exists on ${col.name}`);
            }
          }
        }
      }
      
      // Don't close connection - it's from shared pool
      
      return NextResponse.json({
        success: true,
        message: 'Index setup complete',
        results,
      });
    } catch (error: any) {
      // Don't close connection - it's from shared pool
      throw error;
    }
  } catch (error: any) {
    console.error('Failed to setup indexes:', error);
    return NextResponse.json(
      { error: 'Failed to setup indexes', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET: Show index definitions (for reference)
 */
export async function GET() {
  return NextResponse.json({
    indexes: CHAT_INDEXES,
    instructions: [
      '1. Run POST /api/admin/setup-indexes?steamId=YOUR_STEAM_ID to create indexes',
      '2. Or manually run in MongoDB Compass/Shell:',
      '3. For global chat: db.chats_YYYY-MM-DD.createIndex({ timestamp: -1 })',
      '4. For DMs: db.dms_YYYY-MM-DD.createIndex({ dmId: 1, timestamp: -1 })',
      '5. For invites: db.dm_invites.createIndex({ fromSteamId: 1, toSteamId: 1, status: 1 })',
    ],
  });
}

