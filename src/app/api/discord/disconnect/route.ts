import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Disconnect Discord from Steam account
export async function POST(request: Request) {
  try {
    const { steamId } = await request.json();
    
    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Remove Discord connection
    const discordConnectionsKey = 'discord_connections';
    const connections = await kv.get<Record<string, any>>(discordConnectionsKey) || {};
    
    if (connections[steamId]) {
      delete connections[steamId];
      await kv.set(discordConnectionsKey, connections);
    }

    // Remove all price trackers for this user
    const alertsKey = 'price_alerts';
    const alerts = await kv.get<Record<string, any>>(alertsKey) || {};
    const userAlertIds = Object.keys(alerts).filter(alertId => alerts[alertId].steamId === steamId);
    
    if (userAlertIds.length > 0) {
      userAlertIds.forEach(alertId => {
        delete alerts[alertId];
      });
      await kv.set(alertsKey, alerts);
    }

    return NextResponse.json({ success: true, removedAlerts: userAlertIds.length });
  } catch (error) {
    console.error('Discord disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect Discord' }, { status: 500 });
  }
}

