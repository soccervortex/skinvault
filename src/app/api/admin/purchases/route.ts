import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { notifyConsumablePurchaseStrict, notifyCreditsPurchaseStrict, notifyProPurchaseStrict, notifySpinsPurchaseStrict } from '@/app/utils/discord-webhook';
import { isOwnerRequest } from '@/app/utils/admin-auth';

async function updatePurchaseDiscordStatus(sessionId: string, patch: Record<string, any>) {
  const purchasesKey = 'purchase_history';
  const purchases = (await dbGet<Array<any>>(purchasesKey, false)) || [];
  let updated = false;
  const next = purchases.map((p) => {
    if (!p || updated) return p;
    if (String(p.sessionId || '').trim() !== String(sessionId || '').trim()) return p;
    updated = true;
    return { ...p, ...patch };
  });
  if (updated) {
    await dbSet(purchasesKey, next.slice(-1000));
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const targetSteamId = url.searchParams.get('steamId'); // Target user's Steam ID to filter by
    const includeHidden = url.searchParams.get('includeHidden') === '1';
    const discordFilter = String(url.searchParams.get('discord') || '').trim();

    try {
      const purchasesKey = 'purchase_history';
      let purchases = await dbGet<Array<any>>(purchasesKey, false) || [];

      if (!includeHidden) {
        purchases = purchases.filter((p) => p && p.hidden !== true);
      }
      
      // Filter by target Steam ID if provided
      if (targetSteamId) {
        purchases = purchases.filter(p => p.steamId === targetSteamId);
      }

      if (discordFilter === 'unsent') {
        purchases = purchases.filter((p) => p && p.fulfilled !== false && p.discordNotified !== true);
      } else if (discordFilter === 'sent') {
        purchases = purchases.filter((p) => p && p.fulfilled !== false && p.discordNotified === true);
      } else if (discordFilter === 'errored') {
        purchases = purchases.filter((p) => p && p.fulfilled !== false && p.discordNotifyError !== null);
      }
      
      // Sort by timestamp (newest first)
      const sortedPurchases = purchases.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const res = NextResponse.json({ purchases: sortedPurchases });
      res.headers.set('cache-control', 'no-store');
      return res;
    } catch (error) {
      console.error('Failed to get purchases:', error);
      return NextResponse.json({ error: 'Failed to get purchases' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to get purchases:', error);
    return NextResponse.json({ error: 'Failed to get purchases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const sessionId = String(body?.sessionId || '').trim();

    if (!sessionId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const purchasesKey = 'purchase_history';
    const purchases = (await dbGet<Array<any>>(purchasesKey)) || [];

    if (action === 'retry_discord') {
      const purchase = purchases.find((p) => String(p?.sessionId || '').trim() === sessionId);
      if (!purchase) {
        return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
      }

      const steamId = String(purchase?.steamId || '').trim();
      const type = String(purchase?.type || '').trim();
      const amount = Number(purchase?.amount || 0);
      const currency = String(purchase?.currency || 'eur');

      if (!steamId || !type) {
        return NextResponse.json({ error: 'Invalid purchase record' }, { status: 400 });
      }

      const nextAttempts = Math.max(0, Math.floor(Number(purchase?.discordNotifyAttempts || 0))) + 1;
      try {
        await updatePurchaseDiscordStatus(sessionId, {
          discordNotifyAttempts: nextAttempts,
          discordNotifyLastAttemptAt: new Date().toISOString(),
        });

        if (type === 'pro') {
          const months = Math.max(0, Math.floor(Number(purchase?.months || 0)));
          const proUntil = String(purchase?.proUntil || '');
          await notifyProPurchaseStrict(steamId, months, amount, currency, proUntil, sessionId);
        } else if (type === 'credits') {
          const credits = Math.max(0, Math.floor(Number(purchase?.credits || 0)));
          const pack = String(purchase?.pack || '');
          await notifyCreditsPurchaseStrict(steamId, credits, pack, amount, currency, sessionId);
        } else if (type === 'spins') {
          const spins = Math.max(0, Math.floor(Number((purchase as any)?.spins || 0)));
          const pack = String(purchase?.pack || '');
          await notifySpinsPurchaseStrict(steamId, spins, pack, amount, currency, sessionId);
        } else {
          const consumableType = String(purchase?.consumableType || '');
          const quantity = Math.max(1, Math.floor(Number(purchase?.quantity || 1)));
          await notifyConsumablePurchaseStrict(steamId, consumableType, quantity, amount, currency, sessionId);
        }

        await updatePurchaseDiscordStatus(sessionId, {
          discordNotified: true,
          discordNotifiedAt: new Date().toISOString(),
          discordNotifyError: null,
        });

        return NextResponse.json({ success: true });
      } catch (error: any) {
        await updatePurchaseDiscordStatus(sessionId, {
          discordNotifyError: error?.message || 'Failed to send Discord purchase notification',
        });
        return NextResponse.json({ error: error?.message || 'Failed to retry Discord notification' }, { status: 500 });
      }
    }

    if (action !== 'hide') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    let updated = false;
    const next = purchases.map((p) => {
      if (!p || updated) return p;
      if (String(p.sessionId || '').trim() !== sessionId) return p;
      updated = true;
      return {
        ...p,
        hidden: true,
        hiddenAt: new Date().toISOString(),
      };
    });

    if (!updated) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    await dbSet(purchasesKey, next);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update purchase:', error);
    return NextResponse.json({ error: 'Failed to update purchase' }, { status: 500 });
  }
}

