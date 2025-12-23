import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getDMCollectionNamesForDays } from '@/app/utils/chat-collections';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

interface DMMessage {
  _id?: string;
  dmId: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: Date;
}

interface DMInvite {
  _id?: string;
  fromSteamId: string;
  toSteamId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

// GET: Get list of DMs for a user
export async function GET(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ dms: [] });
    }

    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);

    // Get all accepted DM invites for this user
    const invitesCollection = db.collection<DMInvite>('dm_invites');
    const invites = await invitesCollection.find({
      $or: [
        { fromSteamId: steamId, status: 'accepted' },
        { toSteamId: steamId, status: 'accepted' }
      ]
    }).toArray();

    // Get latest message for each DM
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const collectionNames = getDMCollectionNamesForDays(7);
    
    const dmList: Array<{
      dmId: string;
      otherUserId: string;
      lastMessage: string;
      lastMessageTime: Date;
      unreadCount?: number;
    }> = [];

    for (const invite of invites) {
      const otherUserId = invite.fromSteamId === steamId ? invite.toSteamId : invite.fromSteamId;
      const dmId = [steamId, otherUserId].sort().join('_');

      // Find latest message in this DM
      let latestMessage: DMMessage | null = null;
      for (const collectionName of collectionNames) {
        const collection = db.collection<DMMessage>(collectionName);
        const messages = await collection
          .find({ 
            dmId,
            timestamp: { $gte: sevenDaysAgo }
          })
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray();
        
        if (messages.length > 0) {
          if (!latestMessage || messages[0].timestamp > latestMessage.timestamp) {
            latestMessage = messages[0];
          }
        }
      }

      if (latestMessage) {
        dmList.push({
          dmId,
          otherUserId,
          lastMessage: latestMessage.message,
          lastMessageTime: latestMessage.timestamp,
        });
      }
    }

    await client.close();

    // Sort by last message time
    dmList.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

    return NextResponse.json({ dms: dmList });
  } catch (error) {
    console.error('Failed to get DM list:', error);
    return NextResponse.json({ error: 'Failed to get DM list' }, { status: 500 });
  }
}

