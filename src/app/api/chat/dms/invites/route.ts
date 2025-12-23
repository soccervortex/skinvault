import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { fetchSteamProfile } from '../../messages/route';
import { getDatabase } from '@/app/utils/mongodb-client';

const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

interface DMInvite {
  _id?: string;
  fromSteamId: string;
  toSteamId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

// Use connection pool from mongodb-client utility

// GET: Get invites for a user (pending, sent, received)
export async function GET(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ invites: [] });
    }

    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');
    const type = searchParams.get('type') || 'all'; // 'all', 'sent', 'received', 'pending'

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Use connection pool
    const db = await getDatabase();
    const collection = db.collection<DMInvite>('dm_invites');

    let query: any = {};
    if (type === 'sent') {
      query = { fromSteamId: steamId };
    } else if (type === 'received') {
      query = { toSteamId: steamId };
    } else if (type === 'pending') {
      query = { toSteamId: steamId, status: 'pending' };
    } else {
      query = {
        $or: [
          { fromSteamId: steamId },
          { toSteamId: steamId }
        ]
      };
    }

    const invites = await collection.find(query).sort({ createdAt: -1 }).toArray();
    // Don't close connection - it's pooled and reused

    // Get user blocks to filter out blocked users
    const { dbGet } = await import('@/app/utils/database');
    const userBlocks = await dbGet<Record<string, boolean>>('user_blocks', false) || {};

    // Fetch user info for invites and filter blocked users
    const invitesWithInfo = await Promise.all(invites.map(async (invite) => {
      const otherUserId = invite.fromSteamId === steamId ? invite.toSteamId : invite.fromSteamId;
      
      // Skip if users have blocked each other
      const blockKey = [steamId, otherUserId].sort().join('_');
      if (userBlocks[blockKey] === true) {
        return null; // Filter out blocked users
      }
      
      const profileInfo = await fetchSteamProfile(otherUserId);
      
      return {
        id: invite._id?.toString(),
        fromSteamId: invite.fromSteamId,
        toSteamId: invite.toSteamId,
        otherUserId,
        otherUserName: profileInfo.name || 'Unknown User',
        otherUserAvatar: profileInfo.avatar || '',
        status: invite.status,
        createdAt: invite.createdAt,
        isSent: invite.fromSteamId === steamId,
      };
    }));

    // Filter out null values (blocked users)
    const filteredInvites = invitesWithInfo.filter(invite => invite !== null);

    return NextResponse.json({ invites: filteredInvites });
  } catch (error: any) {
    console.error('Failed to get DM invites:', error);
    // If MongoDB is not configured or connection fails, return empty invites instead of error
    if (!MONGODB_URI || error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return NextResponse.json({ invites: [] });
    }
    return NextResponse.json({ error: 'Failed to get invites' }, { status: 500 });
  }
}

// POST: Send a DM invite
export async function POST(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { fromSteamId, toSteamId } = body;

    if (!fromSteamId || !toSteamId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (fromSteamId === toSteamId) {
      return NextResponse.json({ error: 'Cannot send DM invite to yourself' }, { status: 400 });
    }

    // Check if either user is banned
    const { dbGet } = await import('@/app/utils/database');
    const bannedUsers = await dbGet<string[]>('banned_steam_ids', false) || [];
    
    if (bannedUsers.includes(fromSteamId)) {
      return NextResponse.json({ error: 'You are banned and cannot send DM invites' }, { status: 403 });
    }
    
    if (bannedUsers.includes(toSteamId)) {
      return NextResponse.json({ error: 'Cannot send DM invite to a banned user' }, { status: 403 });
    }

    // Check if users have blocked each other (user-to-user block)
    const userBlocks = await dbGet<Record<string, boolean>>('user_blocks', false) || {};
    const blockKey = [fromSteamId, toSteamId].sort().join('_');
    if (userBlocks[blockKey] === true) {
      return NextResponse.json({ error: 'Cannot send DM invite to this user' }, { status: 403 });
    }

    // Use connection pool
    const db = await getDatabase();
    const collection = db.collection<DMInvite>('dm_invites');

    // Check if invite already exists
    const existingInvite = await collection.findOne({
      $or: [
        { fromSteamId, toSteamId },
        { fromSteamId: toSteamId, toSteamId: fromSteamId }
      ]
    });

    if (existingInvite) {
      if (existingInvite.status === 'accepted') {
        // Don't close connection - it's pooled and reused
        return NextResponse.json({ error: 'DM already exists' }, { status: 400 });
      }
      if (existingInvite.status === 'pending' && existingInvite.fromSteamId === fromSteamId) {
        // Don't close connection - it's pooled and reused
        return NextResponse.json({ error: 'Invite already sent' }, { status: 400 });
      }
    }

    const invite: DMInvite = {
      fromSteamId,
      toSteamId,
      status: 'pending',
      createdAt: new Date(),
    };

    await collection.insertOne(invite);
    // Don't close connection - it's pooled and reused

    return NextResponse.json({ success: true, invite });
  } catch (error: any) {
    console.error('Failed to send DM invite:', error);
    // If MongoDB is not configured or connection fails, return error
    if (!MONGODB_URI || error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return NextResponse.json({ error: 'Chat service is currently unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
  }
}

// PATCH: Accept or decline a DM invite
export async function PATCH(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { inviteId, steamId, action } = body; // action: 'accept' or 'decline'

    if (!inviteId || !steamId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Use connection pool
    const db = await getDatabase();
    const collection = db.collection<DMInvite>('dm_invites');

    // Convert inviteId string to ObjectId
    let invite;
    try {
      invite = await collection.findOne({ _id: new ObjectId(inviteId) } as any);
    } catch (error) {
      // Don't close connection - it's pooled and reused
      return NextResponse.json({ error: 'Invalid invite ID' }, { status: 400 });
    }

    if (!invite) {
      // Don't close connection - it's pooled and reused
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.toSteamId !== steamId) {
      // Don't close connection - it's pooled and reused
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (invite.status !== 'pending') {
      // Don't close connection - it's pooled and reused
      return NextResponse.json({ error: 'Invite already processed' }, { status: 400 });
    }

    await collection.updateOne(
      { _id: new ObjectId(inviteId) } as any,
      { $set: { status: action === 'accept' ? 'accepted' : 'declined' } }
    );

    // Don't close connection - it's pooled and reused

    return NextResponse.json({ 
      success: true, 
      status: action === 'accept' ? 'accepted' : 'declined' 
    });
  } catch (error: any) {
    console.error('Failed to update DM invite:', error);
    // If MongoDB is not configured or connection fails, return error
    if (!MONGODB_URI || error?.message?.includes('MongoDB') || error?.message?.includes('connection')) {
      return NextResponse.json({ error: 'Chat service is currently unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 });
  }
}

