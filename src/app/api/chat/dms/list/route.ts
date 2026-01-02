import { NextResponse } from 'next/server';

// Chat DMs list endpoint - returns empty list for now
// This endpoint was causing 504 errors, so we'll return a quick response
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId parameter' }, { status: 400 });
    }

    // Return empty list immediately to prevent timeout
    // TODO: Implement actual chat functionality with MongoDB if needed
    return NextResponse.json({
      dms: [],
      count: 0,
    });
  } catch (e: any) {
    console.error('Chat DMs list failed', e);
    return NextResponse.json(
      { error: e.message || 'Internal error', dms: [], count: 0 },
      { status: 500 }
    );
  }
}

