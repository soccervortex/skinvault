import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getCollectionNamesForDays } from '@/app/utils/chat-collections';

const MONGODB_URI = process.env.MONGODB_URI || '';

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

    const db = await getDatabase();
    const backupsCollection = db.collection('chat_backups');

    // Get all messages from last 24 hours using date-based collections
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const collectionNames = getCollectionNamesForDays(2); // Today and yesterday
    
    const allMessages: any[] = [];
    for (const collectionName of collectionNames) {
      const collection = db.collection(collectionName);
      const messages = await collection
        .find({ timestamp: { $gte: twentyFourHoursAgo } })
        .toArray();
      allMessages.push(...messages);
    }

    // Create backup document
    if (allMessages.length > 0) {
      const backup = {
        backupDate: new Date(),
        messageCount: allMessages.length,
        messages: allMessages,
      };

      await backupsCollection.insertOne(backup);
    }

    // Clear old messages from collections (older than 24 hours)
    for (const collectionName of collectionNames) {
      const collection = db.collection(collectionName);
      await collection.deleteMany({ timestamp: { $lt: twentyFourHoursAgo } });
    }

    // Don't close connection - it's from shared pool

    return NextResponse.json({ 
      success: true, 
      message: `Backed up ${allMessages.length} messages and cleared old chat`,
      backupDate: allMessages.length > 0 ? new Date() : null,
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

    const db = await getDatabase();
    const backupsCollection = db.collection('chat_backups');

    const backups = await backupsCollection
      .find({})
      .sort({ backupDate: -1 })
      .limit(100)
      .toArray();

    // Don't close connection - it's from shared pool

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

