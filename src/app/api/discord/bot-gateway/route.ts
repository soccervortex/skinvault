import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

export const runtime = 'nodejs';

interface BotGatewayRequest {
  action: 'send_dm' | 'send_welcome' | 'check_alerts';
  discordId?: string;
  message?: string;
}

type DMQueueDoc = {
  _id?: any;
  discordId: string;
  message: string;
  createdAt: Date;
};

async function withAuth(request: Request, handler: (request: Request) => Promise<NextResponse>) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.DISCORD_BOT_API_TOKEN;

  if (expectedToken) {
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      console.error('[Bot Gateway] Unauthorized request - token mismatch or missing');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[Bot Gateway] No DISCORD_BOT_API_TOKEN set - allowing unauthenticated requests');
  }
  return handler(request);
}

async function postHandler(request: Request): Promise<NextResponse> {
  if (!hasMongoConfig()) {
    console.error('[Bot Gateway] MongoDB is not configured. Aborting.');
    return NextResponse.json({ error: 'Internal server error - DB not configured' }, { status: 503 });
  }

  try {
    const body: BotGatewayRequest = await request.json();
    const { action, discordId, message } = body;
    const db = await getDatabase();
    const collection = db.collection<DMQueueDoc>('discord_dm_queue');

    switch (action) {
      case 'send_dm':
      case 'send_welcome':
        if (!discordId || !message) {
          return NextResponse.json({ error: 'Missing discordId or message' }, { status: 400 });
        }
        await collection.insertOne({
          discordId,
          message,
          createdAt: new Date(),
        });
        return NextResponse.json({ success: true, queued: true });

      case 'check_alerts': // This now handles fetching and clearing the queue
        const messages = await collection.find({}).sort({ createdAt: 1 }).limit(100).toArray();
        if (messages.length > 0) {
          const idsToDelete = messages.map(m => m._id);
          await collection.deleteMany({ _id: { $in: idsToDelete } });
        }
        return NextResponse.json({
          success: true,
          queue: messages.map((m) => ({
            discordId: m.discordId,
            message: m.message,
            timestamp: new Date(m.createdAt).getTime(),
          })),
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error('Bot gateway POST error:', reason);
    return NextResponse.json({ error: 'Internal server error', reason }, { status: 500 });
  }
}

async function getHandler(request: Request): Promise<NextResponse> {
  if (!hasMongoConfig()) {
    console.error('[Bot Gateway] MongoDB is not configured. Aborting.');
    return NextResponse.json({ error: 'Internal server error - DB not configured' }, { status: 503 });
  }

  try {
    const db = await getDatabase();
    const collection = db.collection<DMQueueDoc>('discord_dm_queue');
    const messages = await collection.find({}).sort({ createdAt: 1 }).limit(100).toArray();
    const queue = messages.map((m) => ({
      discordId: m.discordId,
      message: m.message,
      timestamp: new Date(m.createdAt).getTime(),
    }));
    return NextResponse.json({ success: true, queue, count: queue.length });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error('Bot gateway GET error:', reason);
    return NextResponse.json({ error: 'Internal server error', reason }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return withAuth(request, postHandler);
}

export async function GET(request: Request) {
  return withAuth(request, getHandler);
}

