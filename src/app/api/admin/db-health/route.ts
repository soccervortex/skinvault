import { NextResponse } from 'next/server';
import { checkDbHealth, getDbStatus } from '@/app/utils/database';
import { hasMongoConfig } from '@/app/utils/mongodb-client';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

export async function GET(request: NextRequest) {
  if (!isOwnerRequest(request)) {
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
        configured: hasMongoConfig(),
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

