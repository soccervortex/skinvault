import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

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
    const steamId = url.searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const alertsKey = 'price_alerts';
    const allAlerts = await kv.get<Record<string, PriceAlert>>(alertsKey) || {};
    
    // Filter alerts for this user
    const userAlerts = Object.values(allAlerts).filter(alert => alert.steamId === steamId);

    return NextResponse.json({ alerts: userAlerts });
  } catch (error) {
    console.error('List alerts error:', error);
    return NextResponse.json({ error: 'Failed to list alerts' }, { status: 500 });
  }
}







