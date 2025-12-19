import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// List all price alerts for a user
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('steamId');
    
    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const alertsKey = 'price_alerts';
    const alerts = await kv.get<Record<string, any>>(alertsKey) || {};
    
    const userAlerts = Object.values(alerts).filter(
      (alert: any) => alert.steamId === steamId
    );

    return NextResponse.json({ alerts: userAlerts });
  } catch (error) {
    console.error('List alerts error:', error);
    return NextResponse.json({ error: 'Failed to list alerts' }, { status: 500 });
  }
}

