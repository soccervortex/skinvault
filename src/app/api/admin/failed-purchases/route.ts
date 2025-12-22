import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { dbGet } from '@/app/utils/database';

const ADMIN_HEADER = 'x-admin-key';

export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const targetSteamId = searchParams.get('steamId'); // Optional filter

    const failedKey = 'failed_purchases';
    let failed = await dbGet<Array<any>>(failedKey) || [];
    
    // Filter by target Steam ID if provided
    if (targetSteamId) {
      failed = failed.filter(p => p.steamId === targetSteamId);
    }
    
    // Sort by timestamp (newest first)
    const sorted = failed.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ failedPurchases: sorted });
  } catch (error) {
    console.error('Failed to get failed purchases:', error);
    return NextResponse.json({ error: 'Failed to get failed purchases' }, { status: 500 });
  }
}

