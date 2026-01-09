import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';

interface PriceAlert {
  id: string;
  steamId: string;
  discordId: string;
  marketHashName: string;
  targetPrice: number;
  currency: string;
  condition: 'above' | 'below';
  triggered: boolean;
  createdAt: string;
}

// Get all price alerts for a user
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = String(url.searchParams.get('steamId') || '').trim();
    const marketHashName = String(url.searchParams.get('marketHashName') || '').trim();

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const alertsKey = 'price_alerts';
    const allAlerts = await dbGet<Record<string, PriceAlert>>(alertsKey, false) || {};
    
    // Filter alerts for this user
    let userAlerts = Object.values(allAlerts).filter((alert) => String(alert?.steamId || '').trim() === steamId);
    if (marketHashName) {
      userAlerts = userAlerts.filter((alert) => String(alert?.marketHashName || '').trim() === marketHashName);
    }

    userAlerts.sort((a, b) => {
      const ta = new Date(String(a?.createdAt || 0)).getTime();
      const tb = new Date(String(b?.createdAt || 0)).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    const res = NextResponse.json({ alerts: userAlerts }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error) {
    console.error('List alerts error:', error);
    return NextResponse.json({ error: 'Failed to list alerts' }, { status: 500 });
  }
}









