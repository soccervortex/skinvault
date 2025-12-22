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
    const alerts = await dbGet<Record<string, PriceAlert>>(alertsKey) || {};
    
    // Verify the alert exists and belongs to the user
    const alert = alerts[alertId];
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    if (alert.steamId !== steamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete the alert
    delete alerts[alertId];
    await dbSet(alertsKey, alerts);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}









