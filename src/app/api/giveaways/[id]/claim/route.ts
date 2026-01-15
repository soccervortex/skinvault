import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { createUserNotification } from '@/app/utils/user-notifications';

function isValidTradeUrl(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.hostname !== 'steamcommunity.com') return false;
    if (u.pathname !== '/tradeoffer/new/') return false;
    const partner = u.searchParams.get('partner');
    const token = u.searchParams.get('token');
    if (!partner || !/^\d+$/.test(partner)) return false;
    if (!token || !/^[A-Za-z0-9_-]{6,64}$/.test(token)) return false;
    return true;
  } catch {
    return false;
  }
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let giveawayId: ObjectId;
    try {
      giveawayId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const db = await getDatabase();
    const winnersCol = db.collection('giveaway_winners');
    const giveawaysCol = db.collection('giveaways');
    const settingsCol = db.collection('user_settings');
    const claimsCol = db.collection('giveaway_claims');
    const stockCol = db.collection('giveaway_prize_stock');

    const now = new Date();
    const assetAppId = Math.max(1, Math.floor(Number(process.env.STEAM_APP_ID || 730)));
    const assetContextId = String(process.env.STEAM_CONTEXT_ID || '2').trim() || '2';

    const settings: any = await settingsCol.findOne({ _id: steamId } as any, { projection: { tradeUrl: 1 } });
    const tradeUrl = String(settings?.tradeUrl || '').trim();
    if (!isValidTradeUrl(tradeUrl)) {
      return NextResponse.json(
        {
          error:
            'Invalid trade URL. Set your Steam trade URL first: https://steamcommunity.com/tradeoffer/new/?partner=...&token=...',
        },
        { status: 400 }
      );
    }

    const wdoc: any = await winnersCol.findOne({ _id: id } as any);
    const winners: any[] = Array.isArray(wdoc?.winners) ? wdoc.winners : [];

    const mine = winners.find((w) => String(w?.steamId || '') === steamId);
    if (!mine) return NextResponse.json({ error: 'Not a winner' }, { status: 403 });

    const status = String(mine?.claimStatus || '');
    if (status === 'claimed') return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
    if (status === 'forfeited') return NextResponse.json({ error: 'Prize forfeited' }, { status: 400 });
    if (status === 'pending_trade') {
      const existingClaim: any = await claimsCol.findOne({ giveawayId, steamId } as any);
      const existingTradeStatus = existingClaim ? String(existingClaim?.tradeStatus || '') : '';
      if (existingTradeStatus === 'PENDING') {
        await claimsCol.updateOne(
          { _id: existingClaim._id } as any,
          { $unset: { botLockedAt: '', botLockId: '' }, $set: { lastError: null, updatedAt: now } } as any
        );
      }
      return NextResponse.json({ ok: true, queued: true }, { status: 200 });
    }

    const deadlineMs = mine?.claimDeadlineAt ? new Date(mine.claimDeadlineAt).getTime() : NaN;
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
      return NextResponse.json({ error: 'Claim window expired' }, { status: 400 });
    }

    const giveaway: any = await giveawaysCol.findOne({ _id: giveawayId } as any, {
      projection: { _id: 1, title: 1, prize: 1, prizeItem: 1 },
    });

    const prizeItem = giveaway?.prizeItem
      ? {
          id: String(giveaway.prizeItem?.id || '').trim(),
          name: String(giveaway.prizeItem?.name || '').trim(),
          market_hash_name: String(giveaway.prizeItem?.market_hash_name || giveaway.prizeItem?.marketHashName || '').trim(),
          image: giveaway.prizeItem?.image ? String(giveaway.prizeItem.image) : null,
        }
      : null;

    const itemId = String(prizeItem?.market_hash_name || prizeItem?.id || giveaway?.prize || '').trim();

    const existingClaim: any = await claimsCol.findOne({ giveawayId, steamId } as any);
    const existingTradeStatus = existingClaim ? String(existingClaim?.tradeStatus || '') : '';
    if (existingTradeStatus === 'SUCCESS') {
      return NextResponse.json({ error: 'Already fulfilled' }, { status: 400 });
    }

    if (existingTradeStatus === 'PENDING' || existingTradeStatus === 'SENT') {
      if (existingTradeStatus === 'PENDING') {
        await claimsCol.updateOne(
          { _id: existingClaim._id } as any,
          { $unset: { botLockedAt: '', botLockId: '' }, $set: { updatedAt: now } } as any
        );
      }

      await winnersCol.updateOne(
        { _id: id } as any,
        {
          $set: {
            'winners.$[w].claimStatus': 'pending_trade',
            'winners.$[w].claimedAt': mine?.claimedAt ? mine.claimedAt : now,
            updatedAt: now,
          },
        } as any,
        { arrayFilters: [{ 'w.steamId': steamId } as any] }
      );

      return NextResponse.json({ ok: true, queued: true }, { status: 200 });
    }

    // Reserve a deterministic prize asset if stock exists for this giveaway.
    // If there is no stock configured yet, we fall back to itemId matching in the bot.
    // IMPORTANT: don't double-reserve if this claim already has a reserved stock item.
    let reservedStock: any = null;
    const existingStockId = existingClaim?.prizeStockId || null;
    if (existingStockId) {
      reservedStock = await stockCol.findOne({ _id: existingStockId } as any);
      if (!reservedStock) {
        return NextResponse.json({ error: 'Reserved prize stock not found. Please try claiming again.' }, { status: 409 });
      }

      // If it was released earlier (status AVAILABLE), re-reserve it for this user.
      const st = String(reservedStock?.status || '').toUpperCase();
      const reservedBy = String(reservedStock?.reservedBySteamId || '').trim();
      const belongsToGiveaway = String(reservedStock?.giveawayId || '') === String(giveawayId);
      if (!belongsToGiveaway) {
        return NextResponse.json({ error: 'Prize stock mismatch. Please try claiming again.' }, { status: 409 });
      }

      if (st === 'AVAILABLE') {
        const lock = await stockCol.findOneAndUpdate(
          { _id: existingStockId, status: 'AVAILABLE' } as any,
          {
            $set: {
              status: 'RESERVED',
              reservedBySteamId: steamId,
              reservedAt: now,
              updatedAt: now,
            },
          } as any,
          { returnDocument: 'after' }
        );
        reservedStock = (lock as any)?.value || null;
        if (!reservedStock) {
          return NextResponse.json({ error: 'Prize stock already taken. Please try claiming again.' }, { status: 409 });
        }
      } else if (st === 'RESERVED' && reservedBy && reservedBy !== steamId) {
        return NextResponse.json({ error: 'Prize stock already reserved by another user' }, { status: 409 });
      } else if (st === 'DELIVERED') {
        return NextResponse.json({ error: 'Prize already delivered' }, { status: 400 });
      }
    } else {
      const stockExists = (await stockCol.findOne({ giveawayId } as any, { projection: { _id: 1 } })) != null;
      if (stockExists) {
        const lock = await stockCol.findOneAndUpdate(
          { giveawayId, status: 'AVAILABLE' } as any,
          {
            $set: {
              status: 'RESERVED',
              reservedBySteamId: steamId,
              reservedAt: now,
              updatedAt: now,
            },
          } as any,
          { sort: { createdAt: 1 }, returnDocument: 'after' }
        );
        reservedStock = (lock as any)?.value || null;

        if (!reservedStock) {
          return NextResponse.json({ error: 'No prize stock available for this giveaway' }, { status: 409 });
        }
      }
    }

    if (existingClaim) {
      await claimsCol.updateOne(
        { _id: existingClaim._id } as any,
        {
          $set: {
            giveawayId,
            steamId,
            itemId,
            prize: String(giveaway?.prize || '').trim(),
            prizeItem,
            tradeUrl,
            assetAppId,
            assetContextId,
            prizeStockId: reservedStock?._id || existingClaim?.prizeStockId || null,
            assetId: reservedStock?.assetId || existingClaim?.assetId || null,
            classId: reservedStock?.classId || existingClaim?.classId || null,
            instanceId: reservedStock?.instanceId || existingClaim?.instanceId || null,
            assetAppIdExact: reservedStock?.appId || existingClaim?.assetAppIdExact || null,
            assetContextIdExact: reservedStock?.contextId || existingClaim?.assetContextIdExact || null,
            tradeStatus: 'PENDING',
            steamTradeOfferId: null,
            lastError: null,
            updatedAt: now,
          },
          $unset: {
            botLockedAt: '',
            botLockId: '',
          },
        } as any
      );
    } else {
      await claimsCol.insertOne({
        giveawayId,
        steamId,
        itemId,
        prize: String(giveaway?.prize || '').trim(),
        prizeItem,
        tradeUrl,
        assetAppId,
        assetContextId,
        prizeStockId: reservedStock?._id || null,
        assetId: reservedStock?.assetId || null,
        classId: reservedStock?.classId || null,
        instanceId: reservedStock?.instanceId || null,
        assetAppIdExact: reservedStock?.appId || null,
        assetContextIdExact: reservedStock?.contextId || null,
        tradeStatus: 'PENDING',
        steamTradeOfferId: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      } as any);
    }

    const res = await winnersCol.updateOne(
      { _id: id } as any,
      {
        $set: {
          'winners.$[w].claimStatus': 'pending_trade',
          'winners.$[w].claimedAt': now,
          updatedAt: now,
        },
      } as any,
      { arrayFilters: [{ 'w.steamId': steamId } as any] }
    );

    if (!res.matchedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await createUserNotification(
      db,
      steamId,
      'giveaway_claimed',
      'Prize Claimed',
      'You successfully claimed your giveaway prize. The staff will contact you or send the trade soon.',
      { giveawayId: id }
    );

    return NextResponse.json({ ok: true, queued: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to claim' }, { status: 500 });
  }
}
