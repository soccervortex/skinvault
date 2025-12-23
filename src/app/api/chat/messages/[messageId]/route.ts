import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { getCollectionNamesForDays, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';
import { isOwner } from '@/app/utils/owner-ids';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

interface ChatMessage {
  _id?: string;
  steamId: string;
  steamName: string;
  avatar: string;
  message: string;
  timestamp: Date;
  isPro: boolean;
}

interface DMMessage {
  _id?: string;
  dmId: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: Date;
}

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

// PATCH: Edit a message
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const { messageId } = await params;
    const { searchParams } = new URL(request.url);
    const userSteamId = searchParams.get('userSteamId');
    const messageType = searchParams.get('type') || 'global';
    const dmId = searchParams.get('dmId');
    const body = await request.json();
    const { newMessage } = body;

    if (!userSteamId || !newMessage || !newMessage.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);

    let updated = false;

    if (messageType === 'global') {
      const collectionNames = getCollectionNamesForDays(2);
      
      for (const collectionName of collectionNames) {
        const collection = db.collection<ChatMessage>(collectionName);
        const message = await collection.findOne({ _id: new ObjectId(messageId) } as any);
        
        if (message) {
          const isAdmin = isOwner(userSteamId);
          if (message.steamId !== userSteamId && !isAdmin) {
            await client.close();
            return NextResponse.json({ error: 'Unauthorized - you can only edit your own messages' }, { status: 403 });
          }
          
          const result = await collection.updateOne(
            { _id: new ObjectId(messageId) } as any,
            { $set: { message: newMessage.trim(), editedAt: new Date() } }
          );
          if (result.modifiedCount > 0) {
            updated = true;
            break;
          }
        }
      }
    } else if (messageType === 'dm' && dmId) {
      const collectionNames = getDMCollectionNamesForDays(7);
      
      for (const collectionName of collectionNames) {
        const collection = db.collection<DMMessage>(collectionName);
        const message = await collection.findOne({ 
          _id: new ObjectId(messageId),
          dmId 
        } as any);
        
        if (message) {
          const isAdmin = isOwner(userSteamId);
          if (message.senderId !== userSteamId && !isAdmin) {
            await client.close();
            return NextResponse.json({ error: 'Unauthorized - you can only edit your own messages' }, { status: 403 });
          }
          
          const result = await collection.updateOne(
            { _id: new ObjectId(messageId), dmId } as any,
            { $set: { message: newMessage.trim(), editedAt: new Date() } }
          );
          if (result.modifiedCount > 0) {
            updated = true;
            break;
          }
        }
      }
    }

    await client.close();

    if (!updated) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Message edited successfully' });
  } catch (error) {
    console.error('Failed to edit message:', error);
    return NextResponse.json({ error: 'Failed to edit message' }, { status: 500 });
  }
}

// DELETE: Delete a message
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const { messageId } = await params;
    const { searchParams } = new URL(request.url);
    const userSteamId = searchParams.get('userSteamId');
    const messageType = searchParams.get('type') || 'global'; // 'global' or 'dm'
    const dmId = searchParams.get('dmId'); // Required for DM messages

    if (!userSteamId) {
      return NextResponse.json({ error: 'Missing userSteamId' }, { status: 400 });
    }

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);

    let deleted = false;
    let messageOwner: string | null = null;

    if (messageType === 'global') {
      // Search in date-based collections for global chat
      const collectionNames = getCollectionNamesForDays(2); // Today and yesterday
      
      for (const collectionName of collectionNames) {
        const collection = db.collection<ChatMessage>(collectionName);
        const message = await collection.findOne({ _id: new ObjectId(messageId) } as any);
        
        if (message) {
          messageOwner = message.steamId;
          
          // Check permissions: user can delete own message, owner can delete any
          const isAdmin = isOwner(userSteamId);
          if (message.steamId !== userSteamId && !isAdmin) {
            await client.close();
            return NextResponse.json({ error: 'Unauthorized - you can only delete your own messages' }, { status: 403 });
          }
          
          const result = await collection.deleteOne({ _id: new ObjectId(messageId) } as any);
          if (result.deletedCount > 0) {
            deleted = true;
            break;
          }
        }
      }
    } else if (messageType === 'dm' && dmId) {
      // Search in DM collections
      const collectionNames = getDMCollectionNamesForDays(7);
      
      for (const collectionName of collectionNames) {
        const collection = db.collection<DMMessage>(collectionName);
        const message = await collection.findOne({ 
          _id: new ObjectId(messageId),
          dmId 
        } as any);
        
        if (message) {
          messageOwner = message.senderId;
          
          // Check permissions: user can delete own message, owner can delete any
          const isAdmin = isOwner(userSteamId);
          if (message.senderId !== userSteamId && !isAdmin) {
            await client.close();
            return NextResponse.json({ error: 'Unauthorized - you can only delete your own messages' }, { status: 403 });
          }
          
          const result = await collection.deleteOne({ 
            _id: new ObjectId(messageId),
            dmId 
          } as any);
          if (result.deletedCount > 0) {
            deleted = true;
            break;
          }
        }
      }
    }

    await client.close();

    if (!deleted) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Message deleted successfully' 
    });
  } catch (error) {
    console.error('Failed to delete message:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}

