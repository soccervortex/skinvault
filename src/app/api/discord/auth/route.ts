import { NextResponse } from 'next/server';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/api/discord/callback`;

// Generate Discord OAuth authorization URL
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    if (!DISCORD_CLIENT_ID) {
      return NextResponse.json({ error: 'Discord client ID not configured' }, { status: 500 });
    }

    // Create state parameter with steamId and timestamp for security
    const state = Buffer.from(JSON.stringify({
      steamId,
      timestamp: Date.now(),
    })).toString('base64');

    // Discord OAuth2 scopes for user installs
    // Note: For user installs, we only need 'identify' to get user info
    // The bot itself is installed separately via user install flow
    // 'guilds' is not needed for user installs (only for server installs)
    const scopes = ['identify'];
    
    console.log('[Discord Auth] Generating OAuth URL for user install with scopes:', scopes.join(' '));
    
    // Build authorization URL
    const authUrl = `https://discord.com/api/oauth2/authorize?` +
      `client_id=${DISCORD_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `state=${encodeURIComponent(state)}`;
    
    console.log('[Discord Auth] Generated auth URL (redirect_uri hidden for security)');

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Discord auth error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}





