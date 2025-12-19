import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Get wishlist for a user (for Discord bot)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');
    
    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const wishlistKey = `sv_wishlist_kv_${steamId}`;
    const wishlist = await kv.get<any[]>(wishlistKey) || [];
    
    return NextResponse.json({ wishlist, count: wishlist.length });
  } catch (error) {
    console.error('Get wishlist error:', error);
    return NextResponse.json({ error: 'Failed to get wishlist' }, { status: 500 });
  }
}

// Sync wishlist to KV (called from client)
export async function POST(request: Request) {
  try {
    const { steamId, wishlist } = await request.json();
    
    if (!steamId || !Array.isArray(wishlist)) {
      return NextResponse.json({ error: 'Missing steamId or wishlist' }, { status: 400 });
    }

    const wishlistKey = `sv_wishlist_kv_${steamId}`;
    await kv.set(wishlistKey, wishlist);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sync wishlist error:', error);
    return NextResponse.json({ error: 'Failed to sync wishlist' }, { status: 500 });
  }
}

