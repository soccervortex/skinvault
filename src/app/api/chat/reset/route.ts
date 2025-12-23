import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

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

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    const chatsCollection = db.collection('chats');
    const backupsCollection = db.collection('chat_backups');

    // Get all messages from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messages = await chatsCollection
      .find({ timestamp: { $gte: twentyFourHoursAgo } })
      .toArray();

    // Create backup document
    if (messages.length > 0) {
      const backup = {
        backupDate: new Date(),
        messageCount: messages.length,
        messages: messages,
      };

      await backupsCollection.insertOne(backup);
    }

    // Clear messages older than 24 hours
    const result = await chatsCollection.deleteMany({ timestamp: { $lt: twentyFourHoursAgo } });

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: `Backed up ${messages.length} messages and cleared ${result.deletedCount} old messages`,
      backedUp: messages.length,
      deleted: result.deletedCount,
    });
  } catch (error) {
    console.error('Failed to reset chat:', error);
    return NextResponse.json({ error: 'Failed to reset chat' }, { status: 500 });
  }
}

