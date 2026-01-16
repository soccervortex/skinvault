import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

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
    const includeHidden = url.searchParams.get('includeHidden') === '1';

    try {
      const purchasesKey = 'purchase_history';
      let purchases = await dbGet<Array<any>>(purchasesKey) || [];

      if (!includeHidden && !targetSteamId) {
        purchases = purchases.filter((p) => p && p.hidden !== true);
      }
      
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

export async function POST(request: Request) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;

    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const sessionId = String(body?.sessionId || '').trim();

    if (action !== 'hide' || !sessionId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const purchasesKey = 'purchase_history';
    const purchases = (await dbGet<Array<any>>(purchasesKey)) || [];

    let updated = false;
    const next = purchases.map((p) => {
      if (!p || updated) return p;
      if (String(p.sessionId || '').trim() !== sessionId) return p;
      updated = true;
      return {
        ...p,
        hidden: true,
        hiddenAt: new Date().toISOString(),
      };
    });

    if (!updated) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    await dbSet(purchasesKey, next);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update purchase:', error);
    return NextResponse.json({ error: 'Failed to update purchase' }, { status: 500 });
  }
}

