import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

// GET: List all collections in the database (admin only)
export async function GET(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const db = await getDatabase();

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

    // Don't close connection - it's from shared pool

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

