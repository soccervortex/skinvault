import { NextResponse } from 'next/server';
import { getProUntil } from '@/app/utils/pro-storage';
import { dbGet, dbSet, hasDiscordAccessServer } from '@/app/utils/database';

// Server-side helper to check if user has Discord access
async function hasDiscordAccess(steamId: string): Promise<boolean> {
  return await hasDiscordAccessServer(steamId);
}

// Server-side helper to get price tracker limit
async function getPriceTrackerLimit(isProUser: boolean, steamId: string): Promise<number> {
  if (isProUser) return Infinity; // Pro users have unlimited
  const hasAccess = await hasDiscordAccess(steamId);
  return hasAccess ? 3 : 0; // 3 for Discord access, 0 otherwise
}

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

    const normalizedSteamId = String(steamId || '').trim();
    const normalizedMarketHashName = String(marketHashName || '').trim();
    const normalizedCurrency = String(currency || '').trim();
    const normalizedCondition = String(condition || '').trim();

    if (!normalizedSteamId || !normalizedMarketHashName || targetPrice === null || targetPrice === undefined || !normalizedCurrency || !normalizedCondition) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user is Pro or has Discord access
    const proUntil = await getProUntil(normalizedSteamId);
    const isPro = !!(proUntil && new Date(proUntil) > new Date());
    
    // Get price tracker limit (unlimited for Pro, 3 for Discord access, 0 for free)
    const maxAlerts = await getPriceTrackerLimit(isPro, normalizedSteamId);
    
    if (maxAlerts === 0) {
      return NextResponse.json({ 
        error: 'Pro subscription or Discord access required. Discord price alerts require Pro subscription or Discord access consumable. Please upgrade to Pro or purchase Discord access to use this feature.',
        requiresPro: true
      }, { status: 403 });
    }
    
    // Check current alert count
    const alertsKey = 'price_alerts';
    const existingAlerts = await dbGet<Record<string, PriceAlert>>(alertsKey, false) || {};
    const userAlerts = Object.values(existingAlerts).filter(a => a.steamId === normalizedSteamId);
    
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
    const connections = await dbGet<Record<string, any>>(discordConnectionsKey, false) || {};
    const connection = connections[normalizedSteamId];

    if (!connection || (connection.expiresAt && Date.now() > connection.expiresAt)) {
      return NextResponse.json({ 
        error: 'Discord not connected or expired. Discord must be connected to receive price alerts.',
        requiresPro: false
      }, { status: 400 });
    }

    // Create alert
    const alertId = `${normalizedSteamId}_${normalizedMarketHashName}_${Date.now()}`;
    const alert: PriceAlert = {
      id: alertId,
      steamId: normalizedSteamId,
      discordId: connection.discordId,
      marketHashName: normalizedMarketHashName,
      targetPrice: parseFloat(targetPrice),
      currency: normalizedCurrency,
      condition: normalizedCondition as any,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    // Store alert
    const alerts = await dbGet<Record<string, PriceAlert>>(alertsKey, false) || {};
    alerts[alertId] = alert;
    await dbSet(alertsKey, alerts);

    // Best-effort confirmation DM (do not fail alert creation if this errors)
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.skinvaults.online';
      const botGatewayUrl = `${base}/api/discord/bot-gateway`;
      const apiToken = process.env.DISCORD_BOT_API_TOKEN;

      await fetch(botGatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify({
          action: 'send_dm',
          discordId: connection.discordId,
          message:
            `✅ Price tracker created!\n\n` +
            `Item: ${normalizedMarketHashName}\n` +
            `Condition: ${normalizedCondition}\n` +
            `Target: ${normalizedCurrency === '1' ? '$' : '€'}${Number(alert.targetPrice).toFixed(2)}`,
        }),
      }).catch(() => null);
    } catch {
      // ignore
    }

    const updatedAlerts = Object.values(alerts).filter(a => a.steamId === normalizedSteamId);
    updatedAlerts.sort((a, b) => {
      const ta = new Date(String(a?.createdAt || 0)).getTime();
      const tb = new Date(String(b?.createdAt || 0)).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    const res = NextResponse.json({ success: true, alertId, alerts: updatedAlerts }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}

