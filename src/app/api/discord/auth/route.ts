import { NextResponse } from 'next/server';

// Discord OAuth2 authorization URL
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/discord/callback`;

// Generate Discord OAuth URL
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');
    
    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    if (!DISCORD_CLIENT_ID) {
      return NextResponse.json({ error: 'Discord OAuth not configured' }, { status: 500 });
    }

    // Generate state token to verify callback
    const state = Buffer.from(JSON.stringify({ steamId, timestamp: Date.now() })).toString('base64');
    
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?` +
      `client_id=${DISCORD_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=identify` +
      `&state=${encodeURIComponent(state)}`;

    return NextResponse.json({ authUrl: discordAuthUrl });
  } catch (error) {
    console.error('Discord auth error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}

