import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { isOwner } from '@/app/utils/owner-ids';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

// GET: List all collections in the database (admin only)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminSteamId = searchParams.get('adminSteamId');

    // Verify admin
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);

    // Get all collections
    const collections = await db.listCollections().toArray();
    
    // Get document counts for each collection
    const collectionsWithCounts = await Promise.all(
      collections.map(async (coll) => {
        const collection = db.collection(coll.name);
        const count = await collection.countDocuments();
        return {
          name: coll.name,
          count,
          type: coll.name.startsWith('chats_') ? 'chat' : 
                coll.name.startsWith('dms_') ? 'dm' :
                coll.name === 'chat_reports' ? 'reports' :
                coll.name === 'dm_invites' ? 'dm_invites' :
                coll.name === 'chat_backups' ? 'backup' :
                coll.name === 'dm_backups' ? 'dm_backup' :
                'other',
        };
      })
    );

    await client.close();

    // Sort by type and name
    collectionsWithCounts.sort((a, b) => {
      if (a.type !== b.type) {
        const typeOrder = ['chat', 'dm', 'reports', 'dm_invites', 'backup', 'dm_backup', 'other'];
        return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ 
      collections: collectionsWithCounts,
      total: collectionsWithCounts.length,
    });
  } catch (error) {
    console.error('Failed to get collections:', error);
    return NextResponse.json({ error: 'Failed to get collections' }, { status: 500 });
  }
}

