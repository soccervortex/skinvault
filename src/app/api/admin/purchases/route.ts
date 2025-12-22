import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { dbGet } from '@/app/utils/database';

const ADMIN_HEADER = 'x-admin-key';

export async function GET(request: Request) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;

    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const targetSteamId = url.searchParams.get('steamId'); // Target user's Steam ID to filter by

    try {
      const purchasesKey = 'purchase_history';
      let purchases = await dbGet<Array<any>>(purchasesKey) || [];
      
      // Filter by target Steam ID if provided
      if (targetSteamId) {
        purchases = purchases.filter(p => p.steamId === targetSteamId);
      }
      
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

