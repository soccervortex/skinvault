import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { upsertCartTrackingMessage } from '@/app/utils/discord-webhook';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const steamId = String(body?.steamId || '').trim();
    const cartId = String(body?.cartId || '').trim();
    const statusRaw = String(body?.status || 'updated').trim();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!/^\d{17}$/.test(steamId)) {
      return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    }

    if (!cartId) {
      return NextResponse.json({ error: 'Missing cartId' }, { status: 400 });
    }

    const fromCookie = getSteamIdFromRequest(request);
    if (!fromCookie || String(fromCookie) !== steamId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const currency = String(body?.currency || 'eur').trim() || 'eur';

    const PRO_PLANS: Record<string, number> = { '1month': 999, '3months': 2499, '6months': 4499 };
    const CREDIT_PACKS: Record<string, number> = { starter: 199, value: 499, mega: 999, giant: 1999, whale: 4999, titan: 7499, legend: 9999 };
    const SPIN_PACKS: Record<string, number> = { starter: 199, value: 499, mega: 999, giant: 1999, whale: 4999, titan: 7499, legend: 9999 };
    const CONSUMABLES: Record<string, number> = { price_tracker_slot: 299, wishlist_slot: 199, discord_access: 499, price_scan_boost: 249, cache_boost: 199 };

    let totalMinor = 0;
    for (const it of items) {
      const kind = String((it as any)?.kind || '').trim();
      if (kind === 'pro') {
        const plan = String((it as any)?.plan || '').trim();
        totalMinor += PRO_PLANS[plan] || 0;
        continue;
      }
      if (kind === 'credits') {
        const pack = String((it as any)?.pack || '').trim();
        const qty = Math.max(1, Math.min(99, Math.floor(Number((it as any)?.quantity || 1))));
        totalMinor += (CREDIT_PACKS[pack] || 0) * qty;
        continue;
      }
      if (kind === 'spins') {
        const pack = String((it as any)?.pack || '').trim();
        const qty = Math.max(1, Math.min(99, Math.floor(Number((it as any)?.quantity || 1))));
        totalMinor += (SPIN_PACKS[pack] || 0) * qty;
        continue;
      }
      if (kind === 'consumable') {
        const t = String((it as any)?.consumableType || '').trim();
        const qty = Math.max(1, Math.min(100, Math.floor(Number((it as any)?.quantity || 1))));
        totalMinor += (CONSUMABLES[t] || 0) * qty;
        continue;
      }
    }
    const amount = totalMinor > 0 ? totalMinor / 100 : undefined;
    const sessionId = String(body?.sessionId || '').trim() || undefined;
    const grantedSummary = typeof body?.grantedSummary === 'string' ? body.grantedSummary : undefined;
    const reason = typeof body?.reason === 'string' ? body.reason : undefined;

    const normalizedStatus = ((): any => {
      const s = statusRaw.toLowerCase();
      if (s === 'paid') return 'paid';
      if (s === 'failed') return 'failed';
      if (s === 'expired') return 'expired';
      if (s === 'checkout_started') return 'checkout_started';
      if (s === 'active') return 'active';
      return 'updated';
    })();

    await upsertCartTrackingMessage({
      steamId,
      cartId,
      items,
      status: normalizedStatus,
      amount,
      currency,
      sessionId,
      grantedSummary,
      reason,
    } as any);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to track cart' }, { status: 500 });
  }
}
