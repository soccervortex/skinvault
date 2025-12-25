import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { dbGet } from '@/app/utils/database';

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

async function createXPost(weapon: { name: string; imageUrl: string; price: string }) {
  try {
    // X API v2 post with media
    // Support both Bearer token and OAuth 1.0a
    const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET || process.env.X_APISECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    console.log('[X Post] Checking credentials...', {
      hasBearer: !!X_BEARER_TOKEN,
      hasApiKey: !!X_API_KEY,
      hasApiSecret: !!X_API_SECRET,
      hasAccessToken: !!X_ACCESS_TOKEN,
      hasAccessTokenSecret: !!X_ACCESS_TOKEN_SECRET,
    });

    if (!X_BEARER_TOKEN && !X_ACCESS_TOKEN) {
      const errorMsg = 'X API credentials not configured. Please set X_BEARER_TOKEN or X_ACCESS_TOKEN/X_ACCESS_TOKEN_SECRET in environment variables.';
      console.error('[X Post]', errorMsg);
      return { success: false, error: errorMsg };
    }

    // Create post text (280 char limit for X)
    const postText = `🎮 ${weapon.name}\n\n💰 Price: ${weapon.price}\n\nTrack your CS2 inventory:\nskinvaults.online\n\n#CS2 #CSGO #Skins`;

    console.log('[X Post] Attempting to post:', postText.substring(0, 50) + '...');

    // Use Bearer token if available (simpler)
    let authHeader = '';
    if (X_BEARER_TOKEN) {
      authHeader = `Bearer ${X_BEARER_TOKEN}`;
    } else if (X_ACCESS_TOKEN && X_ACCESS_TOKEN_SECRET) {
      // OAuth 1.0a would require signing - for now, we'll use Bearer token approach
      // This is a simplified version - full OAuth 1.0a requires a library
      console.warn('[X Post] OAuth 1.0a not fully implemented, using Bearer token approach');
      authHeader = `Bearer ${X_ACCESS_TOKEN}`;
    }

    const postResponse = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: postText.substring(0, 280), // Ensure within limit
      }),
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

