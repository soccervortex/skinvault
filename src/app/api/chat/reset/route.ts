import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getCollectionNamesForDays, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';

const MONGODB_URI = process.env.MONGODB_URI || '';

// This endpoint can be called by a cron job (e.g., Vercel Cron) to reset chat daily
export async function POST(request: Request) {
  try {
    // Optional: Add authentication header for cron jobs
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const db = await getDatabase();
    const backupsCollection = db.collection('chat_backups');
    const dmBackupsCollection = db.collection('dm_backups');

    // Backup and clear global chat (24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const collectionNames = getCollectionNamesForDays(2);
    
    const allMessages: any[] = [];
    for (const collectionName of collectionNames) {
      const collection = db.collection(collectionName);
      const messages = await collection
        .find({ timestamp: { $gte: twentyFourHoursAgo } })
        .toArray();
      allMessages.push(...messages);
    }

    if (allMessages.length > 0) {
      const backup = {
        backupDate: new Date(),
        messageCount: allMessages.length,
        messages: allMessages,
      };
      await backupsCollection.insertOne(backup);
    }

    let deletedCount = 0;
    for (const collectionName of collectionNames) {
      const collection = db.collection(collectionName);
      const result = await collection.deleteMany({ timestamp: { $lt: twentyFourHoursAgo } });
      deletedCount += result.deletedCount;
    }

    // Backup and clear DMs (365 days)
    const threeHundredSixtyFiveDaysAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const dmCollectionNames = getDMCollectionNamesForDays(365);
    
    const allDMMessages: any[] = [];
    for (const collectionName of dmCollectionNames) {
      const collection = db.collection(collectionName);
      const messages = await collection
        .find({ timestamp: { $gte: threeHundredSixtyFiveDaysAgo } })
        .toArray();
      allDMMessages.push(...messages);
    }

    if (allDMMessages.length > 0) {
      const dmBackup = {
        backupDate: new Date(),
        messageCount: allDMMessages.length,
        messages: allDMMessages,
      };
      await dmBackupsCollection.insertOne(dmBackup);
    }

    let deletedDMCount = 0;
    for (const collectionName of dmCollectionNames) {
      const collection = db.collection(collectionName);
      const result = await collection.deleteMany({ timestamp: { $lt: threeHundredSixtyFiveDaysAgo } });
      deletedDMCount += result.deletedCount;
    }

    // Don't close connection - it's from shared pool

    return NextResponse.json({ 
      success: true, 
      message: `Backed up ${allMessages.length} chat messages and ${allDMMessages.length} DM messages`,
      backedUp: allMessages.length,
      deleted: deletedCount,
      dmBackedUp: allDMMessages.length,
      dmDeleted: deletedDMCount,
    });
  } catch (error) {
    console.error('Failed to reset chat:', error);
    return NextResponse.json({ error: 'Failed to reset chat' }, { status: 500 });
  }
}

