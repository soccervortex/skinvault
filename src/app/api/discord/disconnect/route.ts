import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { dbGet, dbSet } from '@/app/utils/database';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

// Disconnect Discord from Steam account
export async function POST(request: NextRequest) {
  try {
    const requesterSteamId = getSteamIdFromRequest(request);
    if (!requesterSteamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { steamId } = await request.json();
    
    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    if (String(steamId) !== requesterSteamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Remove Discord connection
    const discordConnectionsKey = 'discord_connections';
    const connections = await dbGet<Record<string, any>>(discordConnectionsKey) || {};
    
    if (connections[steamId]) {
      delete connections[steamId];
      await dbSet(discordConnectionsKey, connections);
    }

    // Remove all price trackers for this user
    const alertsKey = 'price_alerts';
    const alerts = await dbGet<Record<string, any>>(alertsKey) || {};
    const userAlertIds = Object.keys(alerts).filter(alertId => alerts[alertId].steamId === steamId);
    
    if (userAlertIds.length > 0) {
      userAlertIds.forEach(alertId => {
        delete alerts[alertId];
      });
      await dbSet(alertsKey, alerts);
    }

    return NextResponse.json({ success: true, removedAlerts: userAlertIds.length });
  } catch (error) {
    console.error('Discord disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect Discord' }, { status: 500 });
  }
}

