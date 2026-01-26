import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbGet } from '@/app/utils/database';
import { isAdminRequest } from '@/app/utils/admin-auth';

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const targetSteamId = searchParams.get('steamId'); // Optional filter

    const failedKey = 'failed_purchases';
    let failed = await dbGet<Array<any>>(failedKey, false) || [];
    
    // Filter by target Steam ID if provided
    if (targetSteamId) {
      failed = failed.filter(p => p.steamId === targetSteamId);
    }
    
    // Sort by timestamp (newest first)
    const sorted = failed.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const res = NextResponse.json({ failedPurchases: sorted });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error) {
    console.error('Failed to get failed purchases:', error);
    return NextResponse.json({ error: 'Failed to get failed purchases' }, { status: 500 });
  }
}

