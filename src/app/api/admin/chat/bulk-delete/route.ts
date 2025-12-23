import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { isOwner } from '@/app/utils/owner-ids';
import { getCollectionNamesForDays, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';

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

// POST: Bulk delete messages
export async function POST(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const adminSteamId = searchParams.get('adminSteamId');
    
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { messageIds, messageType = 'global', dmId } = body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'Invalid messageIds array' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);

    let deletedCount = 0;
    const objectIds = messageIds.map(id => new ObjectId(id));

    if (messageType === 'global') {
      const collectionNames = getCollectionNamesForDays(2);
      
      for (const collectionName of collectionNames) {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({ _id: { $in: objectIds } } as any);
        deletedCount += result.deletedCount;
      }
    } else if (messageType === 'dm' && dmId) {
      const collectionNames = getDMCollectionNamesForDays(7);
      
      for (const collectionName of collectionNames) {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({ 
          _id: { $in: objectIds },
          dmId 
        } as any);
        deletedCount += result.deletedCount;
      }
    }

    await client.close();

    return NextResponse.json({ 
      success: true, 
      deletedCount,
      message: `Deleted ${deletedCount} message(s)` 
    });
  } catch (error) {
    console.error('Failed to bulk delete messages:', error);
    return NextResponse.json({ error: 'Failed to bulk delete messages' }, { status: 500 });
  }
}

