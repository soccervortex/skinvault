import { NextResponse } from 'next/server';
import { checkDbHealth, getDbStatus } from '@/app/utils/database';
import { isOwner } from '@/app/utils/owner-ids';

const ADMIN_HEADER = 'x-admin-key';

export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const health = await checkDbHealth();
    const status = getDbStatus();

    return NextResponse.json({
      status,
      health,
      kv: {
        configured: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
        available: health.kv,
      },
      mongodb: {
        configured: !!process.env.MONGODB_URI,
        available: health.mongodb,
      },
    });
  } catch (error: any) {
    console.error('Failed to check database health:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to check database health' 
    }, { status: 500 });
  }
}

