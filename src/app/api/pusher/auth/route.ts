import { NextResponse } from 'next/server';
import Pusher from 'pusher';

// Lazy initialization - only create Pusher instance when credentials are available
function getPusherInstance(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER || 'eu';

  if (!appId || !key || !secret) {
    console.warn('Pusher credentials not configured. Check your environment variables.');
    return null;
  }

  return new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
}

export async function POST(request: Request) {
  try {
    // Check if Pusher is configured
    const pusher = getPusherInstance();
    if (!pusher) {
      return NextResponse.json(
        { error: 'Pusher not configured. Please set PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY, and PUSHER_SECRET environment variables.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { socket_id, channel_name } = body;

    if (!socket_id || !channel_name) {
      return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
    }

    // For public channels, use authorizeChannel
    // For presence channels, use authorizeChannel (same method)
    const auth = pusher.authorizeChannel(socket_id, channel_name);

    return NextResponse.json(auth);
  } catch (error: any) {
    console.error('Pusher auth error:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: 'Authentication failed', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

