import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Delete a price alert
export async function POST(request: Request) {
  try {
    const { alertId, steamId } = await request.json();

    if (!alertId || !steamId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const alertsKey = 'price_alerts';
    const alerts = await kv.get<Record<string, any>>(alertsKey) || {};
    
    // Verify ownership
    if (alerts[alertId] && alerts[alertId].steamId === steamId) {
      delete alerts[alertId];
      await kv.set(alertsKey, alerts);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Alert not found or unauthorized' }, { status: 404 });
  } catch (error) {
    console.error('Delete alert error:', error);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}

