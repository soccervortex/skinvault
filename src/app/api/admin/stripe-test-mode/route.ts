import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { dbGet, dbSet } from '@/app/utils/database';

const ADMIN_HEADER = 'x-admin-key';
const TEST_MODE_KEY = 'stripe_test_mode';

function checkAuth(request: Request): boolean {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;
  if (expected && adminKey !== expected) {
    return false;
  }
  return true;
}

// GET: Get test mode status
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');
    
    if (!steamId || !isOwner(steamId as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const testMode = await dbGet<boolean>(TEST_MODE_KEY);
      return NextResponse.json({ testMode: testMode === true });
    } catch (error) {
      console.error('Failed to get test mode:', error);
      return NextResponse.json({ testMode: false });
    }
  } catch (error) {
    console.error('Failed to get test mode:', error);
    return NextResponse.json({ error: 'Failed to get test mode' }, { status: 500 });
  }
}

// POST: Set test mode status
export async function POST(request: Request) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const testMode = body.testMode === true;

    try {
      await dbSet(TEST_MODE_KEY, testMode);
      return NextResponse.json({ testMode, message: `Test mode ${testMode ? 'enabled' : 'disabled'}` });
    } catch (error) {
      console.error('Failed to set test mode:', error);
      return NextResponse.json({ error: 'Failed to set test mode' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to set test mode:', error);
    return NextResponse.json({ error: 'Failed to set test mode' }, { status: 500 });
  }
}

