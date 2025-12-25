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
    const enabled = (await dbGet<boolean>('x_posting_enabled', false)) || false;
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
    const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    if (!X_BEARER_TOKEN && !X_ACCESS_TOKEN) {
      return { success: false, error: 'X API credentials not configured. Please set X_BEARER_TOKEN or X_ACCESS_TOKEN in environment variables.' };
    }

    // Create post text (280 char limit for X)
    const postText = `🎮 ${weapon.name}\n\n💰 Price: ${weapon.price}\n\nTrack your CS2 inventory:\nskinvaults.online\n\n#CS2 #CSGO #Skins`;

    // For now, post without image (image upload requires OAuth 1.0a which is more complex)
    // We can add image support later with proper OAuth library
    const postResponse = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${X_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: postText.substring(0, 280), // Ensure within limit
      }),
    });

    if (!postResponse.ok) {
      const errorData = await postResponse.json().catch(() => ({ detail: 'Unknown error' }));
      console.error('X API error response:', errorData);
      return { success: false, error: errorData.detail || errorData.title || 'Failed to post to X' };
    }

    const data = await postResponse.json();
    return { success: true, postId: data.data?.id };
  } catch (error: any) {
    console.error('X API error:', error);
    return { success: false, error: error.message || 'Failed to create X post' };
  }
}

