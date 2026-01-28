import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { dbGet, dbSet } from '@/app/utils/database';
import { isOwnerRequest } from '@/app/utils/admin-auth';

const TEST_MODE_KEY = 'stripe_test_mode';

// GET: Get test mode status
export async function GET(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

