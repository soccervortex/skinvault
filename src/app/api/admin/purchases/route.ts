import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';

const ADMIN_HEADER = 'x-admin-key';

export async function GET(request: Request) {
  try {
    // Check if user is owner
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
      const purchasesKey = 'purchase_history';
      const purchases = await kv.get<Array<any>>(purchasesKey) || [];
      
      // Sort by timestamp (newest first)
      const sortedPurchases = purchases.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return NextResponse.json({ purchases: sortedPurchases });
    } catch (error) {
      console.error('Failed to get purchases:', error);
      return NextResponse.json({ error: 'Failed to get purchases' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to get purchases:', error);
    return NextResponse.json({ error: 'Failed to get purchases' }, { status: 500 });
  }
}

