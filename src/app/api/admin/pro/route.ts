import { NextResponse } from 'next/server';
import { grantPro, getProUntil, getAllProUsers } from '@/app/utils/pro-storage';
import { sanitizeSteamId } from '@/app/utils/sanitize';

const ADMIN_HEADER = 'x-admin-key';

function checkAuth(request: Request): boolean {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;
  if (expected && adminKey !== expected) {
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const rawSteamId = body?.steamId as string | undefined;
    const months = Number(body?.months ?? 0);

    // Sanitize and validate SteamID
    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    // Validate months
    if (!months || months <= 0 || months > 120) {
      return NextResponse.json({ error: 'Invalid months value (must be between 1 and 120)' }, { status: 400 });
    }

    const proUntil = await grantPro(steamId, months);
    return NextResponse.json({ steamId, proUntil });
  } catch (error) {
    console.error('Failed to grant Pro:', error);
    return NextResponse.json({ error: 'Failed to grant Pro' }, { status: 500 });
  }
}

// DELETE: Remove Pro status
export async function DELETE(request: Request) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const rawSteamId = url.searchParams.get('steamId');

    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    // Remove Pro by setting expiry to yesterday (more reasonable than 2000)
    const { dbGet, dbSet } = await import('@/app/utils/database');
    const PRO_USERS_KEY = 'pro_users';
    
    try {
      const data = await dbGet<Record<string, string>>(PRO_USERS_KEY) || {};
      // Set to yesterday to mark as expired (more reasonable than 2000-01-01)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      data[steamId] = yesterday.toISOString();
      await dbSet(PRO_USERS_KEY, data);
    } catch (error) {
      console.error('Failed to delete Pro:', error);
      return NextResponse.json({ error: 'Failed to delete Pro' }, { status: 500 });
    }

    return NextResponse.json({ steamId, deleted: true });
  } catch (error) {
    console.error('Failed to delete Pro:', error);
    return NextResponse.json({ error: 'Failed to delete Pro' }, { status: 500 });
  }
}

// PATCH: Edit Pro status (set specific expiry date)
export async function PATCH(request: Request) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const rawSteamId = body?.steamId as string | undefined;
    const proUntil = body?.proUntil as string | undefined;

    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    if (!proUntil) {
      return NextResponse.json({ error: 'Missing proUntil date' }, { status: 400 });
    }

    // Validate date
    const expiryDate = new Date(proUntil);
    if (isNaN(expiryDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const { dbGet, dbSet } = await import('@/app/utils/database');
    const PRO_USERS_KEY = 'pro_users';
    
    try {
      const data = await dbGet<Record<string, string>>(PRO_USERS_KEY) || {};
      data[steamId] = expiryDate.toISOString();
      await dbSet(PRO_USERS_KEY, data);
    } catch (error) {
      console.error('Failed to edit Pro:', error);
      return NextResponse.json({ error: 'Failed to edit Pro' }, { status: 500 });
    }

    return NextResponse.json({ steamId, proUntil: expiryDate.toISOString() });
  } catch (error) {
    console.error('Failed to edit Pro:', error);
    return NextResponse.json({ error: 'Failed to edit Pro' }, { status: 500 });
  }
}

