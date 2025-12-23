import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { isOwner } from '@/app/utils/owner-ids';

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

// Backup current chat messages before clearing
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminSteamId } = body;

    // Verify admin
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
    const chatsCollection = db.collection('chats');
    const backupsCollection = db.collection('chat_backups');

    // Get all messages from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messages = await chatsCollection
      .find({ timestamp: { $gte: twentyFourHoursAgo } })
      .toArray();

    // Create backup document
    const backup = {
      backupDate: new Date(),
      messageCount: messages.length,
      messages: messages,
    };

    await backupsCollection.insertOne(backup);

    // Clear old messages (older than 24 hours)
    await chatsCollection.deleteMany({ timestamp: { $lt: twentyFourHoursAgo } });

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: `Backed up ${messages.length} messages and cleared old chat`,
      backupDate: backup.backupDate,
    });
  } catch (error) {
    console.error('Failed to backup and clear chat:', error);
    return NextResponse.json({ error: 'Failed to backup chat' }, { status: 500 });
  }
}

// Get backup history (admin only)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminSteamId = searchParams.get('adminSteamId');

    // Verify admin
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!MONGODB_URI) {
      return NextResponse.json({ backups: [] });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
    const backupsCollection = db.collection('chat_backups');

    const backups = await backupsCollection
      .find({})
      .sort({ backupDate: -1 })
      .limit(100)
      .toArray();

    await client.close();

    return NextResponse.json({ 
      backups: backups.map(backup => ({
        id: backup._id?.toString(),
        backupDate: backup.backupDate,
        messageCount: backup.messageCount,
      }))
    });
  } catch (error) {
    console.error('Failed to get backups:', error);
    return NextResponse.json({ error: 'Failed to get backups' }, { status: 500 });
  }
}

