import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { fetchSteamProfile } from '../../messages/route';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

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

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
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
    await client.close();

    // Fetch user info for invites
    const invitesWithInfo = await Promise.all(invites.map(async (invite) => {
      const otherUserId = invite.fromSteamId === steamId ? invite.toSteamId : invite.fromSteamId;
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

    return NextResponse.json({ invites: invitesWithInfo });
  } catch (error) {
    console.error('Failed to get DM invites:', error);
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

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
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
        await client.close();
        return NextResponse.json({ error: 'DM already exists' }, { status: 400 });
      }
      if (existingInvite.status === 'pending' && existingInvite.fromSteamId === fromSteamId) {
        await client.close();
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
    await client.close();

    return NextResponse.json({ success: true, invite });
  } catch (error) {
    console.error('Failed to send DM invite:', error);
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

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
    const collection = db.collection<DMInvite>('dm_invites');

    // Convert inviteId string to ObjectId
    let invite;
    try {
      invite = await collection.findOne({ _id: new ObjectId(inviteId) } as any);
    } catch (error) {
      await client.close();
      return NextResponse.json({ error: 'Invalid invite ID' }, { status: 400 });
    }

    if (!invite) {
      await client.close();
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.toSteamId !== steamId) {
      await client.close();
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (invite.status !== 'pending') {
      await client.close();
      return NextResponse.json({ error: 'Invite already processed' }, { status: 400 });
    }

    await collection.updateOne(
      { _id: new ObjectId(inviteId) } as any,
      { $set: { status: action === 'accept' ? 'accepted' : 'declined' } }
    );

    await client.close();

    return NextResponse.json({ 
      success: true, 
      status: action === 'accept' ? 'accepted' : 'declined' 
    });
  } catch (error) {
    console.error('Failed to update DM invite:', error);
    return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 });
  }
}

