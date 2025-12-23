import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

interface ChatMessage {
  _id?: string;
  steamId: string;
  steamName: string;
  avatar: string;
  message: string;
  timestamp: Date;
  isPro: boolean;
}

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

export async function GET() {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ messages: [] });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
    const collection = db.collection<ChatMessage>('chats');

    // Get messages from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messages = await collection
      .find({ timestamp: { $gte: twentyFourHoursAgo } })
      .sort({ timestamp: 1 })
      .limit(500)
      .toArray();

    await client.close();

    return NextResponse.json({ 
      messages: messages.map(msg => ({
        id: msg._id?.toString(),
        steamId: msg.steamId,
        steamName: msg.steamName,
        avatar: msg.avatar,
        message: msg.message,
        timestamp: msg.timestamp,
        isPro: msg.isPro,
      }))
    });
  } catch (error) {
    console.error('Failed to get chat messages:', error);
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { steamId, steamName, avatar, message, isPro } = body;

    if (!steamId || !steamName || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user is banned or timed out
    const { dbGet } = await import('@/app/utils/database');
    const bannedUsers = await dbGet<string[]>('banned_steam_ids') || [];
    const timeoutUsers = await dbGet<Record<string, string>>('timeout_users') || {};
    
    if (bannedUsers.includes(steamId)) {
      return NextResponse.json({ error: 'You are banned from chat' }, { status: 403 });
    }

    if (timeoutUsers[steamId]) {
      const timeoutUntil = new Date(timeoutUsers[steamId]);
      if (timeoutUntil > new Date()) {
        const minutesLeft = Math.ceil((timeoutUntil.getTime() - Date.now()) / (1000 * 60));
        return NextResponse.json({ 
          error: `You are timed out for ${minutesLeft} more minute(s)` 
        }, { status: 403 });
      }
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
    const collection = db.collection<ChatMessage>('chats');

    const chatMessage: ChatMessage = {
      steamId,
      steamName,
      avatar: avatar || '',
      message: message.trim(),
      timestamp: new Date(),
      isPro: isPro || false,
    };

    await collection.insertOne(chatMessage);
    await client.close();

    return NextResponse.json({ success: true, message: chatMessage });
  } catch (error) {
    console.error('Failed to send chat message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

