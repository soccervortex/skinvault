import { NextResponse } from 'next/server';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { isOwner } from '@/app/utils/owner-ids';
import { dbGet, dbSet } from '@/app/utils/database';

const ADMIN_HEADER = 'x-admin-key';
const BANNED_KEY = 'banned_steam_ids';

export async function POST(request: Request) {
  try {
    // Check if user is owner
    const url = new URL(request.url);
    const steamIdParam = url.searchParams.get('steamId');
    
    // Also check from request body
    const body = await request.json().catch(() => null);
    const bodySteamId = body?.steamId;
    
    // Use body steamId if available, otherwise check query param
    // For owner check, we'd need to get it from the request somehow
    // For now, we'll just check the admin key
    
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;

    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawSteamId = bodySteamId || steamIdParam;
    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    // Store banned Steam IDs (uses database abstraction - KV + MongoDB)
    try {
      const banned = await dbGet<string[]>(BANNED_KEY) || [];
      if (!banned.includes(steamId)) {
        banned.push(steamId);
        await dbSet(BANNED_KEY, banned);
      }
      return NextResponse.json({ steamId, banned: true });
    } catch (error) {
      console.error('Failed to ban Steam ID:', error);
      return NextResponse.json({ error: 'Failed to ban Steam ID' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to ban Steam ID:', error);
    return NextResponse.json({ error: 'Failed to ban Steam ID' }, { status: 500 });
  }
}

// GET: Check if Steam ID is banned
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawSteamId = url.searchParams.get('steamId');
    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    try {
      const banned = await dbGet<string[]>(BANNED_KEY) || [];
      return NextResponse.json({ steamId, banned: banned.includes(steamId) });
    } catch (error) {
      console.error('Failed to check ban status:', error);
      return NextResponse.json({ steamId, banned: false });
    }
  } catch (error) {
    console.error('Failed to check ban status:', error);
    return NextResponse.json({ error: 'Failed to check ban status' }, { status: 500 });
  }
}

