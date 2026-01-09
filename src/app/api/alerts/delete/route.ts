import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

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

// Delete a price alert
export async function POST(request: Request) {
  try {
    const { alertId, steamId } = await request.json();

    if (!alertId || !steamId) {
      return NextResponse.json({ error: 'Missing alertId or steamId' }, { status: 400 });
    }

    const alertsKey = 'price_alerts';
    const normalizedSteamId = String(steamId || '').trim();
    const alerts = await dbGet<Record<string, PriceAlert>>(alertsKey, false) || {};
    
    // Verify the alert exists and belongs to the user
    const alert = alerts[alertId];
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    if (String(alert.steamId || '').trim() !== normalizedSteamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete the alert
    delete alerts[alertId];
    await dbSet(alertsKey, alerts);

    const updatedAlerts = Object.values(alerts).filter(a => String(a?.steamId || '').trim() === normalizedSteamId);
    updatedAlerts.sort((a, b) => {
      const ta = new Date(String(a?.createdAt || 0)).getTime();
      const tb = new Date(String(b?.createdAt || 0)).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    const res = NextResponse.json({ success: true, alerts: updatedAlerts }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error) {
    console.error('Delete alert error:', error);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}









