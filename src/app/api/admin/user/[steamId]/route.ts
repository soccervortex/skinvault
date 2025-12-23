import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { dbGet } from '@/app/utils/database';
import { isOwner } from '@/app/utils/owner-ids';
import { getProUntil } from '@/app/utils/pro-storage';
import { getCollectionNamesForRange, getChatCollectionName, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ steamId: string }> }
) {
  try {
    const { steamId } = await params;
    const { searchParams } = new URL(request.url);
    const adminSteamId = searchParams.get('adminSteamId');
    const timeFilter = searchParams.get('time') || 'lifetime'; // 30min, 1hour, 24hours, lifetime
    const searchQuery = searchParams.get('search') || '';

    // Verify admin
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get user info
    const bannedUsers = await dbGet<string[]>('banned_steam_ids') || [];
    const timeoutUsers = await dbGet<Record<string, string>>('timeout_users') || {};
    const isBanned = bannedUsers.includes(steamId);
    const timeoutUntil = timeoutUsers[steamId];
    const isTimedOut = timeoutUntil && new Date(timeoutUntil) > new Date();
    const proUntil = await getProUntil(steamId);
    const isPro = proUntil && new Date(proUntil) > new Date();

    // Fetch Steam profile
    let steamName = 'Unknown User';
    let avatar = '';
    try {
      const steamUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
      const textRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`);
      const text = await textRes.text();
      steamName = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || 'Unknown User';
      avatar = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || '';
    } catch (error) {
      console.warn('Failed to fetch Steam profile:', error);
    }

    // Get chat messages using date-based collections
    let messages: any[] = [];
    if (MONGODB_URI) {
      const client = await getMongoClient();
      const db = client.db(MONGODB_DB_NAME);

      // Calculate time filter and collection names
      let timeFilterDate: Date | null = null;
      let collectionNames: string[] = [];
      
      switch (timeFilter) {
        case '30min':
          timeFilterDate = new Date(Date.now() - 30 * 60 * 1000);
          collectionNames = [getChatCollectionName(new Date())]; // Today only
          break;
        case '1hour':
          timeFilterDate = new Date(Date.now() - 60 * 60 * 1000);
          collectionNames = [getChatCollectionName(new Date())]; // Today only
          break;
        case '24hours':
          timeFilterDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          collectionNames = getCollectionNamesForRange(timeFilterDate, new Date());
          break;
        case 'lifetime':
        default:
          timeFilterDate = null;
          // Get collections for last 30 days (reasonable limit)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          collectionNames = getCollectionNamesForRange(thirtyDaysAgo, new Date());
          break;
      }

      const query: any = { steamId };
      if (timeFilterDate) {
        query.timestamp = { $gte: timeFilterDate };
      }
      if (searchQuery) {
        query.message = { $regex: searchQuery, $options: 'i' };
      }

      // Query all relevant collections in parallel
      const messagePromises = collectionNames.map(async (collectionName) => {
        const collection = db.collection(collectionName);
        return collection.find(query).sort({ timestamp: -1 }).toArray();
      });
      
      const messageArrays = await Promise.all(messagePromises);
      const allMessages = messageArrays.flat();
      
      // Sort and limit
      messages = allMessages
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 1000);

      await client.close();
    }

    // Count timeout history (from backups)
    let timeoutCount = 0;
    if (MONGODB_URI) {
      try {
        const client = await getMongoClient();
        const db = client.db(MONGODB_DB_NAME);
        const backupsCollection = db.collection('chat_backups');
        
        const backups = await backupsCollection.find({}).toArray();
        timeoutCount = backups.reduce((count, backup) => {
          if (backup.messages && Array.isArray(backup.messages)) {
            const userMessages = backup.messages.filter((msg: any) => msg.steamId === steamId);
            return count + userMessages.length;
          }
          return count;
        }, 0);
        
        await client.close();
      } catch (error) {
        console.error('Failed to count timeout history:', error);
      }
    }

    // Get DM messages for this user
    let dmMessages: any[] = [];
    if (MONGODB_URI) {
      try {
        const client = await getMongoClient();
        const db = client.db(MONGODB_DB_NAME);
        
        // Get all DMs where this user is sender or receiver
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const dmCollectionNames = getDMCollectionNamesForDays(7);
        
        const dmQuery: any = {
          $or: [
            { senderId: steamId },
            { receiverId: steamId }
          ],
          timestamp: { $gte: sevenDaysAgo }
        };
        
        if (searchQuery) {
          dmQuery.message = { $regex: searchQuery, $options: 'i' };
        }
        
        const dmPromises = dmCollectionNames.map(async (collectionName) => {
          const collection = db.collection(collectionName);
          return collection.find(dmQuery).sort({ timestamp: -1 }).toArray();
        });
        
        const dmArrays = await Promise.all(dmPromises);
        const allDMs = dmArrays.flat();
        
        dmMessages = allDMs
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 1000)
          .map(msg => ({
            id: msg._id?.toString(),
            dmId: msg.dmId,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
            message: msg.message,
            timestamp: msg.timestamp,
            otherUserId: msg.senderId === steamId ? msg.receiverId : msg.senderId,
          }));
        
        await client.close();
      } catch (error) {
        console.error('Failed to get DM messages:', error);
      }
    }

    return NextResponse.json({
      user: {
        steamId,
        steamName,
        avatar,
        isBanned,
        isTimedOut,
        timeoutUntil: isTimedOut ? timeoutUntil : null,
        isPro,
        proUntil,
        messageCount: messages.length,
        totalMessageCount: timeoutCount + messages.length,
      },
      messages: messages.map(msg => ({
        id: msg._id?.toString(),
        message: msg.message,
        timestamp: msg.timestamp,
      })),
      dmMessages,
    });
  } catch (error) {
    console.error('Failed to get user info:', error);
    return NextResponse.json({ error: 'Failed to get user info' }, { status: 500 });
  }
}

