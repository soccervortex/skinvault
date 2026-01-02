import { NextResponse } from 'next/server';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.skinvaults.online';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `${DEFAULT_BASE_URL}/api/discord/callback`;

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
    // Using 'identify' and 'applications.commands' for user installs
    // integration_type=1 indicates this is a user install (not guild install)
    const scopes = ['identify', 'applications.commands'];
    
    console.log('[Discord Auth] Generating OAuth URL for user install with scopes:', scopes.join(' '));
    
    // Build authorization URL with integration_type=1 for user installs
    const authUrl = `https://discord.com/oauth2/authorize?` +
      `client_id=${DISCORD_CLIENT_ID}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `integration_type=1&` +
      `state=${encodeURIComponent(state)}`;
    
    console.log('[Discord Auth] Generated auth URL with integration_type=1 (user install)');

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Discord auth error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}





