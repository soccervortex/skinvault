import { NextResponse } from 'next/server';
import { getDMCollectionNamesForDays } from '@/app/utils/chat-collections';
import { getDatabase } from '@/app/utils/mongodb-client';

// Fetch Steam profile helper
async function fetchSteamProfile(steamId: string): Promise<{ name: string; avatar: string }> {
  try {
    const steamUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
    const textRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`, {
      cache: 'no-store', // Don't cache in API routes
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
  createdAt: Date | string | { $date: string };
}

// GET: Get list of DMs for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Get user blocks to filter out blocked users
    const { dbGet } = await import('@/app/utils/database');
    const userBlocks = await dbGet<Record<string, boolean>>('user_blocks', false) || {};

    // Use connection pool
    const db = await getDatabase();

    // Get all accepted DM invites for this user
    // Use index for faster query
    const invitesCollection = db.collection<DMInvite>('dm_invites');
    const invites = await invitesCollection
      .find({
        $or: [
          { fromSteamId: steamId, status: 'accepted' },
          { toSteamId: steamId, status: 'accepted' }
        ]
      })
      .sort({ createdAt: -1 }) // Most recent first
      .toArray();
    
    console.log(`[DM List API] Found ${invites.length} accepted invites for ${steamId}`);

    // Get latest message for each DM
    const threeHundredSixtyFiveDaysAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const collectionNames = getDMCollectionNamesForDays(365);
    
    const dmList: Array<{
      dmId: string;
      otherUserId: string;
      otherUserName: string;
      otherUserAvatar: string;
      lastMessage: string;
      lastMessageTime: Date;
      unreadCount?: number;
    }> = [];

    // Also find DMs from messages (in case invite is missing but messages exist)
    const dmIdsFromMessages = new Set<string>();
    for (const collectionName of collectionNames) {
      const collection = db.collection<DMMessage>(collectionName);
      const messages = await collection
        .find({ 
          $or: [
            { senderId: steamId, timestamp: { $gte: threeHundredSixtyFiveDaysAgo } },
            { receiverId: steamId, timestamp: { $gte: threeHundredSixtyFiveDaysAgo } }
          ]
        })
        .toArray();
      
      messages.forEach(msg => {
        dmIdsFromMessages.add(msg.dmId);
      });
    }

    // Combine invites and message-based DMs
    const allDmIds = new Set<string>();
    invites.forEach(invite => {
      const otherUserId = invite.fromSteamId === steamId ? invite.toSteamId : invite.fromSteamId;
      const dmId = [steamId, otherUserId].sort().join('_');
      allDmIds.add(dmId);
      console.log(`[DM List] Added DM from invite: ${dmId} (otherUserId: ${otherUserId})`);
    });
    dmIdsFromMessages.forEach(dmId => {
      allDmIds.add(dmId);
      console.log(`[DM List] Added DM from messages: ${dmId}`);
    });
    
    console.log(`[DM List] Total unique DM IDs: ${allDmIds.size}`);

    // Fetch user profiles for all DMs in parallel
    const otherUserIds = Array.from(allDmIds).map(dmId => {
      const [id1, id2] = dmId.split('_');
      return id1 === steamId ? id2 : id1;
    });
    const uniqueOtherUserIds = [...new Set(otherUserIds)];

    const userProfilePromises = uniqueOtherUserIds.map(async (otherUserId) => {
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

    for (const dmId of allDmIds) {
      const [id1, id2] = dmId.split('_');
      const otherUserId = id1 === steamId ? id2 : id1;
      
      // Skip if users have blocked each other
      const blockKey = [steamId, otherUserId].sort().join('_');
      if (userBlocks[blockKey] === true) {
        continue; // Skip blocked users
      }
      
      const profile = profileMap.get(otherUserId) || { name: `User ${otherUserId.slice(-4)}`, avatar: '' };

      // Find invite for this DM (if exists) - needed for optimization logic
      const invite = invites.find(inv => {
        const invOtherUserId = inv.fromSteamId === steamId ? inv.toSteamId : inv.fromSteamId;
        return invOtherUserId === otherUserId;
      });

      // Find latest message in this DM (optimized - only check recent collections)
      // For performance, only check last 7 days of collections for latest message
      let latestMessage: DMMessage | null = null;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentCollectionNames = getDMCollectionNamesForDays(7);
      
      // Check recent collections first (most likely to have latest message)
      for (const collectionName of recentCollectionNames.reverse()) {
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
          latestMessage = messages[0];
          break; // Found latest, no need to check older collections
        }
      }
      
      // If no recent message found, check older collections (but only if we have an invite)
      if (!latestMessage && invite) {
        for (const collectionName of collectionNames.slice(recentCollectionNames.length)) {
          const collection = db.collection<DMMessage>(collectionName);
          const messages = await collection
            .find({ 
              dmId,
              timestamp: { $gte: threeHundredSixtyFiveDaysAgo }
            })
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray();
          
          if (messages.length > 0) {
            latestMessage = messages[0];
            break;
          }
        }
      }

      // Add DM even if no messages yet (for newly accepted invites) or if messages exist
      // Use invite createdAt if available, otherwise use current time for newly accepted invites
      let lastMessageTime: Date;
      if (latestMessage?.timestamp) {
        lastMessageTime = latestMessage.timestamp instanceof Date ? latestMessage.timestamp : new Date(latestMessage.timestamp);
      } else if (invite?.createdAt) {
        // Handle MongoDB date format
        if (invite.createdAt instanceof Date) {
          lastMessageTime = invite.createdAt;
        } else if (typeof invite.createdAt === 'string') {
          lastMessageTime = new Date(invite.createdAt);
        } else if (invite.createdAt && typeof invite.createdAt === 'object' && '$date' in invite.createdAt) {
          lastMessageTime = new Date((invite.createdAt as any).$date);
        } else {
          lastMessageTime = new Date();
        }
      } else {
        // Use current time for DMs without invite or message
        lastMessageTime = new Date();
      }
      
      // Always add DM if there's an accepted invite, even without messages
      // This ensures newly accepted invites always appear
      const dmEntry = {
        dmId,
        otherUserId,
        otherUserName: profile.name,
        otherUserAvatar: profile.avatar,
        lastMessage: latestMessage?.message || 'No messages yet',
        lastMessageTime,
      };
      
      console.log(`[DM List] Adding DM to list:`, dmEntry);
      dmList.push(dmEntry);
    }

    // Don't close connection - it's pooled and reused

    // Sort by last message time
    dmList.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

    return NextResponse.json({ dms: dmList });
  } catch (error: any) {
    console.error('Failed to get DM list:', error);
    // If MongoDB connection fails, return empty list instead of error
    if (error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return NextResponse.json({ dms: [] });
    }
    return NextResponse.json({ error: 'Failed to get DM list' }, { status: 500 });
  }
}

