import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';

const ADMIN_HEADER = 'x-admin-key';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');
    
    if (!steamId || !isOwner(steamId as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;

    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const { kv } = await import('@vercel/kv');
      const failedKey = 'failed_purchases';
      const failed = await kv.get<Array<any>>(failedKey) || [];
      
      // Sort by timestamp (newest first)
      const sorted = failed.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return NextResponse.json({ failedPurchases: sorted });
    } catch (error) {
      console.error('Failed to get failed purchases:', error);
      return NextResponse.json({ error: 'Failed to get failed purchases' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to get failed purchases:', error);
    return NextResponse.json({ error: 'Failed to get failed purchases' }, { status: 500 });
  }
}

