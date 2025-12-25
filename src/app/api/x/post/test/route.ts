import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { dbGet } from '@/app/utils/database';
import crypto from 'crypto';

// POST: Create test post (weapon with image)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminSteamId } = body;

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if X posting is enabled
    const enabled = (await dbGet<boolean>('x_posting_enabled')) || false;
    if (!enabled) {
      return NextResponse.json({ error: 'X posting is not enabled' }, { status: 400 });
    }

    // Get a popular weapon from our dataset
    const weapon = await getPopularWeapon();
    
    // Create post with image
    const postResult = await createXPost(weapon);

    if (postResult.success) {
      // Update last post timestamp
      const { dbSet } = await import('@/app/utils/database');
      await dbSet('x_posting_last_post', new Date().toISOString());
      
      return NextResponse.json({
        success: true,
        message: 'Test post created successfully',
        postId: postResult.postId,
        weapon: weapon.name,
      });
    } else {
      return NextResponse.json(
        { error: postResult.error || 'Failed to create post' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Failed to create test post:', error);
    return NextResponse.json(
      { error: 'Failed to create test post' },
      { status: 500 }
    );
  }
}

async function getPopularWeapon() {
  // Get a popular weapon from our dataset
  // For now, return a default popular weapon
  const popularWeapons = [
    { name: 'AK-47 | Redline', imageUrl: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5gZKKkuXLPr7Vn35cppwl3r3E9t2n3gzhqUZtYz2mI4eBd1M3Y1rV-lfolOq6h8C5tJ7NnHEh7CJQ5H3D30vgzA', price: '€45.20' },
    { name: 'AWP | Asiimov', imageUrl: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5gZKKkuXLPr7Vn35cppwl3r3E9t2n3gzhqUZtYz2mI4eBd1M3Y1rV-lfolOq6h8C5tJ7NnHEh7CJQ5H3D30vgzA', price: '€89.50' },
    { name: 'M4A4 | Howl', imageUrl: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5gZKKkuXLPr7Vn35cppwl3r3E9t2n3gzhqUZtYz2mI4eBd1M3Y1rV-lfolOq6h8C5tJ7NnHEh7CJQ5H3D30vgzA', price: '€1,234.00' },
  ];

  // Return random popular weapon
  return popularWeapons[Math.floor(Math.random() * popularWeapons.length)];
}

// OAuth 1.0a signature generation
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // Create parameter string
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  return signature;
}

// Generate OAuth 1.0a authorization header
function generateOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_version: '1.0',
  };

  // Generate signature (only OAuth parameters, not body)
  const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);
  oauthParams.oauth_signature = signature;

  // Build authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return authHeader;
}

async function createXPost(weapon: { name: string; imageUrl: string; price: string }) {
  try {
    // X API v2 requires OAuth 1.0a User Context for automated posting
    // Note: OAuth 2.0 Client ID/Secret are for different flows (user authorization)
    // For automated bots, we use OAuth 1.0a with API Key/Secret + Access Token/Secret
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET || process.env.X_APISECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    console.log('[X Post] Checking credentials...', {
      hasApiKey: !!X_API_KEY,
      hasApiSecret: !!X_API_SECRET,
      hasAccessToken: !!X_ACCESS_TOKEN,
      hasAccessTokenSecret: !!X_ACCESS_TOKEN_SECRET,
    });

    // Check if we have all required OAuth 1.0a credentials
    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
      const missing = [];
      if (!X_API_KEY) missing.push('X_API_KEY');
      if (!X_API_SECRET) missing.push('X_API_SECRET');
      if (!X_ACCESS_TOKEN) missing.push('X_ACCESS_TOKEN');
      if (!X_ACCESS_TOKEN_SECRET) missing.push('X_ACCESS_TOKEN_SECRET');
      
      const errorMsg = `Missing required OAuth 1.0a credentials: ${missing.join(', ')}. Please set all four: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET in environment variables.`;
      console.error('[X Post]', errorMsg);
      return { success: false, error: errorMsg };
    }

    // Create post text (280 char limit for X)
    const postText = `🎮 ${weapon.name}\n\n💰 Price: ${weapon.price}\n\nTrack your CS2 inventory:\nskinvaults.online\n\n#CS2 #CSGO #Skins`;

    console.log('[X Post] Attempting to post with OAuth 1.0a:', postText.substring(0, 50) + '...');

    const url = 'https://api.x.com/2/tweets';
    const body = {
      text: postText.substring(0, 280), // Ensure within limit
    };

    // Generate OAuth 1.0a authorization header
    const authHeader = generateOAuthHeader(
      'POST',
      url,
      X_API_KEY,
      X_API_SECRET,
      X_ACCESS_TOKEN,
      X_ACCESS_TOKEN_SECRET
    );

    const postResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await postResponse.text();
    console.log('[X Post] Response status:', postResponse.status);
    console.log('[X Post] Response body:', responseText);

    if (!postResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { detail: responseText || 'Unknown error' };
      }
      console.error('[X Post] API error response:', errorData);
      const errorMsg = errorData.detail || errorData.title || errorData.message || `HTTP ${postResponse.status}: Failed to post to X`;
      return { success: false, error: errorMsg };
    }

    const data = JSON.parse(responseText);
    console.log('[X Post] Success! Post ID:', data.data?.id);
    return { success: true, postId: data.data?.id };
  } catch (error: any) {
    console.error('[X Post] Exception:', error);
    return { success: false, error: error.message || 'Failed to create X post' };
  }
}

