import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getProUntil } from '@/app/utils/pro-storage';
import { getPriceTrackerLimit } from '@/app/utils/pro-limits';

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

// Create a price alert (Pro users only)
export async function POST(request: Request) {
  try {
    const { steamId, marketHashName, targetPrice, currency, condition } = await request.json();

    if (!steamId || !marketHashName || !targetPrice || !currency || !condition) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user is Pro or has Discord access
    const proUntil = await getProUntil(steamId);
    const isPro = proUntil && new Date(proUntil) > new Date();
    
    // Get price tracker limit (unlimited for Pro, 3 for Discord access, 0 for free)
    const maxAlerts = await getPriceTrackerLimit(isPro, steamId);
    
    if (maxAlerts === 0) {
      return NextResponse.json({ 
        error: 'Pro subscription or Discord access required. Discord price alerts require Pro subscription or Discord access consumable. Please upgrade to Pro or purchase Discord access to use this feature.',
        requiresPro: true
      }, { status: 403 });
    }
    
    // Check current alert count
    const alertsKey = 'price_alerts';
    const existingAlerts = await kv.get<Record<string, PriceAlert>>(alertsKey) || {};
    const userAlerts = Object.values(existingAlerts).filter(a => a.steamId === steamId);
    
    if (userAlerts.length >= maxAlerts) {
      return NextResponse.json({ 
        error: 'Failed to create alert',
        limitReached: true,
        maxAlerts,
        currentCount: userAlerts.length,
      }, { status: 403 });
    }

    // Check Discord connection (Pro already verified above)
    const discordConnectionsKey = 'discord_connections';
    const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
    const connection = connections[steamId];

    if (!connection || (connection.expiresAt && Date.now() > connection.expiresAt)) {
      return NextResponse.json({ 
        error: 'Discord not connected or expired. Discord must be connected to receive price alerts.',
        requiresPro: false
      }, { status: 400 });
    }

    // Create alert
    const alertId = `${steamId}_${marketHashName}_${Date.now()}`;
    const alert: PriceAlert = {
      id: alertId,
      steamId,
      discordId: connection.discordId,
      marketHashName,
      targetPrice: parseFloat(targetPrice),
      currency,
      condition,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    // Store alert
    const alerts = await kv.get<Record<string, PriceAlert>>(alertsKey) || {};
    alerts[alertId] = alert;
    await kv.set(alertsKey, alerts);

    return NextResponse.json({ success: true, alertId });
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}

