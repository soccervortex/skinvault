import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, getMongoClient, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';

const ADMIN_HEADER = 'x-admin-key';

type TransferOptions = {
  referrals?: boolean;
  claims?: boolean;
  creditsBalance?: boolean;
  creditsLedger?: boolean;
  bonusSpins?: boolean;
  userRewards?: boolean;
};

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;
    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requesterSteamId = getSteamIdFromRequest(request);
    if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwner(requesterSteamId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const fromSteamId = sanitizeSteamId(body?.fromSteamId);
    const toSteamId = sanitizeSteamId(body?.toSteamId);
    const options = (body?.options && typeof body.options === 'object' ? body.options : {}) as TransferOptions;

    if (!fromSteamId || !toSteamId) {
      return NextResponse.json({ error: 'Invalid fromSteamId or toSteamId' }, { status: 400 });
    }
    if (fromSteamId === toSteamId) {
      return NextResponse.json({ error: 'fromSteamId and toSteamId must be different' }, { status: 400 });
    }

    const transfer: Required<TransferOptions> = {
      referrals: options.referrals !== false,
      claims: options.claims !== false,
      creditsBalance: options.creditsBalance === true,
      creditsLedger: options.creditsLedger === true,
      bonusSpins: options.bonusSpins === true,
      userRewards: options.userRewards === true,
    };

    const db = await getDatabase();
    const client = await getMongoClient();
    const session = client.startSession();

    try {
      const result: any = {
        ok: true,
        fromSteamId,
        toSteamId,
        transfer,
        moved: {
          referrals: 0,
          claims: 0,
          claimsDroppedAsDuplicates: 0,
          creditsMoved: 0,
          ledgerUpdated: 0,
          bonusSpinsMoved: 0,
          userRewardsMoved: false,
        },
      };

      await session.withTransaction(async () => {
        if (transfer.referrals) {
          const referralsCol = db.collection('affiliate_referrals');
          const upd = await referralsCol.updateMany(
            { referrerSteamId: fromSteamId } as any,
            { $set: { referrerSteamId: toSteamId } } as any,
            { session } as any
          );
          result.moved.referrals = Number((upd as any)?.modifiedCount || 0);
        }

        if (transfer.claims) {
          const claimsCol = db.collection('affiliate_milestone_claims');
          const sourceClaims = await claimsCol.find({ steamId: fromSteamId } as any, { session } as any).toArray();

          const docsToInsert: any[] = [];
          for (const c of sourceClaims as any[]) {
            const milestoneId = String(c?.milestoneId || '').trim();
            if (!milestoneId) continue;
            docsToInsert.push({
              ...c,
              _id: `${toSteamId}_${milestoneId}`,
              steamId: toSteamId,
            });
          }

          if (docsToInsert.length > 0) {
            try {
              await claimsCol.insertMany(docsToInsert, { ordered: false, session } as any);
              result.moved.claims = docsToInsert.length;
            } catch (e: any) {
              const writeErrors = Array.isArray(e?.writeErrors) ? e.writeErrors : [];
              const dup = writeErrors.filter((we: any) => we?.code === 11000).length;
              result.moved.claimsDroppedAsDuplicates = dup;
              result.moved.claims = Math.max(0, docsToInsert.length - dup);
            }
          }

          await claimsCol.deleteMany({ steamId: fromSteamId } as any, { session } as any);
        }

        if (transfer.creditsBalance) {
          const creditsCol = db.collection('user_credits');
          const now = new Date();
          const fromDoc = await creditsCol.findOne({ _id: fromSteamId } as any, { session } as any);
          const bal = Number((fromDoc as any)?.balance || 0);
          const amount = Number.isFinite(bal) ? Math.max(0, Math.floor(bal)) : 0;

          if (amount > 0) {
            await creditsCol.updateOne(
              { _id: toSteamId } as any,
              {
                $setOnInsert: { _id: toSteamId, steamId: toSteamId } as any,
                $inc: { balance: amount } as any,
                $set: { updatedAt: now } as any,
              } as any,
              { upsert: true, session } as any
            );

            await creditsCol.updateOne(
              { _id: fromSteamId } as any,
              { $set: { balance: 0, updatedAt: now } } as any,
              { session } as any
            );

            result.moved.creditsMoved = amount;
          }
        }

        if (transfer.creditsLedger) {
          const ledgerCol = db.collection('credits_ledger');
          const upd = await ledgerCol.updateMany(
            { steamId: fromSteamId } as any,
            { $set: { steamId: toSteamId } } as any,
            { session } as any
          );
          result.moved.ledgerUpdated = Number((upd as any)?.modifiedCount || 0);
        }

        if (transfer.bonusSpins) {
          const bonusCol = db.collection('bonus_spins');
          const now = new Date();
          const fromDoc = await bonusCol.findOne({ _id: fromSteamId } as any, { session } as any);
          const raw = (fromDoc as any)?.count;
          const n = typeof raw === 'number'
            ? raw
            : raw && typeof raw === 'object' && typeof (raw as any).toString === 'function'
              ? Number((raw as any).toString())
              : Number(raw);
          const amount = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

          if (amount > 0) {
            await bonusCol.updateOne(
              { _id: toSteamId } as any,
              {
                $setOnInsert: { _id: toSteamId, steamId: toSteamId, createdAt: now } as any,
                $inc: { count: amount } as any,
                $set: { updatedAt: now } as any,
              } as any,
              { upsert: true, session } as any
            );

            await bonusCol.updateOne(
              { _id: fromSteamId } as any,
              { $set: { count: 0, updatedAt: now } } as any,
              { session } as any
            );

            result.moved.bonusSpinsMoved = amount;
          }
        }

        if (transfer.userRewards) {
          const rewardsCol = db.collection('user_rewards');
          const rewardsKey = 'user_rewards';
          const doc = await rewardsCol.findOne({ _id: rewardsKey } as any, { session } as any);
          const value = doc?.value && typeof doc.value === 'object' ? doc.value : {};

          const fromRewards = Array.isArray((value as any)[fromSteamId]) ? (value as any)[fromSteamId] : [];
          const toRewards = Array.isArray((value as any)[toSteamId]) ? (value as any)[toSteamId] : [];

          if (fromRewards.length > 0) {
            (value as any)[toSteamId] = [...toRewards, ...fromRewards];
            delete (value as any)[fromSteamId];

            await rewardsCol.updateOne(
              { _id: rewardsKey } as any,
              { $set: { _id: rewardsKey, value, updatedAt: new Date() } } as any,
              { upsert: true, session } as any
            );

            result.moved.userRewardsMoved = true;
          }
        }
      });

      return NextResponse.json(result, { status: 200 });
    } finally {
      await session.endSession();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to transfer affiliate data' }, { status: 500 });
  }
}
