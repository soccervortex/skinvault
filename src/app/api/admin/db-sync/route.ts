import { NextResponse } from 'next/server';
import { syncAllDataToKV, checkDbHealth } from '@/app/utils/database';

const ADMIN_HEADER = 'x-admin-key';

/**
 * POST /api/admin/db-sync
 * Manually trigger sync from MongoDB to KV
 * Useful when KV recovers after being down
 */
export async function POST(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const health = await checkDbHealth();
    
    if (!health.kv) {
      return NextResponse.json({ 
        error: 'KV is not available. Cannot sync.',
        health 
      }, { status: 400 });
    }

    if (!health.mongodb) {
      return NextResponse.json({ 
        error: 'MongoDB is not configured or unavailable.',
        health 
      }, { status: 400 });
    }

    const result = await syncAllDataToKV();

    return NextResponse.json({
      success: true,
      message: `Synced ${result.synced} keys from MongoDB to KV (${result.failed} failed, ${result.total} total)`,
      result,
      health,
    });
  } catch (error: any) {
    console.error('Failed to sync databases:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to sync databases' 
    }, { status: 500 });
  }
}

