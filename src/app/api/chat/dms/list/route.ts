import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getDMCollectionNamesForDays } from '@/app/utils/chat-collections';

// Fetch Steam profile helper
async function fetchSteamProfile(steamId: string): Promise<{ name: string; avatar: string }> {
  try {
    const steamUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
    const textRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    const text = await textRes.text();
    const name = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || 'Unknown User';
    const avatar = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || '';
    return { name, avatar };
  } catch (error) {
    console.warn(`Failed to fetch Steam profile for ${steamId}:`, error);
    return { name: 'Unknown User', avatar: '' };
  }
}

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
      otherUserName: string;
      otherUserAvatar: string;
      lastMessage: string;
      lastMessageTime: Date;
      unreadCount?: number;
    }> = [];

    // Fetch user profiles for all DMs in parallel
    const userProfilePromises = invites.map(async (invite) => {
      const otherUserId = invite.fromSteamId === steamId ? invite.toSteamId : invite.fromSteamId;
      try {
        const profile = await fetchSteamProfile(otherUserId);
        return { otherUserId, profile };
      } catch (error) {
        console.error(`Failed to fetch profile for ${otherUserId}:`, error);
        return { 
          otherUserId, 
          profile: { name: `User ${otherUserId.slice(-4)}`, avatar: '' } 
        };
      }
    });

    const userProfiles = await Promise.all(userProfilePromises);
    const profileMap = new Map(userProfiles.map(up => [up.otherUserId, up.profile]));

    for (const invite of invites) {
      const otherUserId = invite.fromSteamId === steamId ? invite.toSteamId : invite.fromSteamId;
      const dmId = [steamId, otherUserId].sort().join('_');
      const profile = profileMap.get(otherUserId) || { name: `User ${otherUserId.slice(-4)}`, avatar: '' };

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

      // Add DM even if no messages yet (for newly accepted invites)
      dmList.push({
        dmId,
        otherUserId,
        otherUserName: profile.name,
        otherUserAvatar: profile.avatar,
        lastMessage: latestMessage?.message || 'No messages yet',
        lastMessageTime: latestMessage?.timestamp || invite.createdAt,
      });
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

