import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';
import { isOwner } from '@/app/utils/owner-ids';
import { getProUntil } from '@/app/utils/pro-storage';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getCollectionNamesForRange, getChatCollectionName, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';

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

    // Fetch Steam profile with timeout and retry
    let steamName = 'Unknown User';
    let avatar = '';
    try {
      const steamUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const textRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`, {
        signal: controller.signal,
        cache: 'no-store', // Always fetch fresh data
      });
      clearTimeout(timeoutId);
      
      if (textRes.ok) {
        const text = await textRes.text();
        const nameMatch = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
        const avatarMatch = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
        
        steamName = nameMatch?.[1] || 'Unknown User';
        avatar = avatarMatch?.[1] || '';
      }
    } catch (error) {
      console.warn('Failed to fetch Steam profile:', error);
      // Will use default 'Unknown User' and empty avatar
    }

    // Get chat messages using date-based collections
    let messages: any[] = [];
    if (hasMongoConfig()) {
      const db = await getDatabase();

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

      // Don't close connection - it's from shared pool
    }

    // Count timeout history (from backups)
    let timeoutCount = 0;
    if (hasMongoConfig()) {
      try {
        const db = await getDatabase();
        const backupsCollection = db.collection('chat_backups');
        
        const backups = await backupsCollection.find({}).toArray();
        timeoutCount = backups.reduce((count, backup) => {
          if (backup.messages && Array.isArray(backup.messages)) {
            const userMessages = backup.messages.filter((msg: any) => msg.steamId === steamId);
            return count + userMessages.length;
          }
          return count;
        }, 0);
        
        // Don't close connection - it's from shared pool
      } catch (error) {
        console.error('Failed to count timeout history:', error);
      }
    }

    // Get DM messages for this user
    let dmMessages: any[] = [];
    if (hasMongoConfig()) {
      try {
        const db = await getDatabase();
        
        // Get all DMs where this user is sender or receiver
        const threeHundredSixtyFiveDaysAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const dmCollectionNames = getDMCollectionNamesForDays(365);
        
        const dmQuery: any = {
          $or: [
            { senderId: steamId },
            { receiverId: steamId }
          ],
          timestamp: { $gte: threeHundredSixtyFiveDaysAgo }
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
        
        // Get user info for DM participants (optimized - only fetch if not already known)
        const uniqueSteamIds = [...new Set(allDMs.flatMap(msg => [msg.senderId, msg.receiverId]))];
        const userInfoMap = new Map<string, { name: string; avatar: string }>();

        // Use cached Steam profile for the main user
        userInfoMap.set(steamId, { name: steamName, avatar });

        // Only fetch profiles for other users (limit to 10 to avoid timeout)
        const otherUserIds = uniqueSteamIds.filter(id => id !== steamId).slice(0, 10);
        
        // Fetch profiles in parallel with shorter timeout
        await Promise.all(otherUserIds.map(async (id) => {
          try {
            const steamUrl = `https://steamcommunity.com/profiles/${id}/?xml=1`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // Reduced timeout
            const textRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`, {
              signal: controller.signal,
              cache: 'no-store',
            });
            clearTimeout(timeoutId);
            
            if (textRes.ok) {
              const text = await textRes.text();
              const name = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || `User ${id.slice(-4)}`;
              const avatar = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || '';
              userInfoMap.set(id, { name, avatar });
            } else {
              userInfoMap.set(id, { name: `User ${id.slice(-4)}`, avatar: '' });
            }
          } catch (error) {
            // Use fallback
            userInfoMap.set(id, { name: `User ${id.slice(-4)}`, avatar: '' });
          }
        }));

        // For remaining users, use fallback
        uniqueSteamIds.forEach(id => {
          if (!userInfoMap.has(id)) {
            userInfoMap.set(id, { name: `User ${id.slice(-4)}`, avatar: '' });
          }
        });

        dmMessages = allDMs
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 1000)
          .map(msg => {
            const senderInfo = userInfoMap.get(msg.senderId) || { name: `User ${msg.senderId.slice(-4)}`, avatar: '' };
            return {
              id: msg._id?.toString(),
              dmId: msg.dmId,
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              senderName: senderInfo.name,
              senderAvatar: senderInfo.avatar,
              message: msg.message,
              timestamp: msg.timestamp,
              otherUserId: msg.senderId === steamId ? msg.receiverId : msg.senderId,
            };
          });
        
        // Don't close connection - it's from shared pool
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

