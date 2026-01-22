import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, getMongoClient, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { createUserNotification } from '@/app/utils/user-notifications';
import { getAffiliateMilestones } from '@/app/lib/affiliate-milestones';

type Milestone = {
  id: string;
  referralsRequired: number;
  reward:
    | { type: 'credits'; amount: number }
    | { type: 'spins'; amount: number }
    | { type: 'discord_access' }
    | { type: 'wishlist_slot' }
    | { type: 'price_tracker_slot' }
    | { type: 'price_scan_boost' }
    | { type: 'cache_boost' };
};

const MILESTONES: Milestone[] = getAffiliateMilestones() as any;

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const milestoneId = String(body?.milestoneId || '').trim();
    const milestone = MILESTONES.find((m) => m.id === milestoneId) || null;
    if (!milestone) return NextResponse.json({ error: 'Invalid milestoneId' }, { status: 400 });

    const db = await getDatabase();
    const referralsCol = db.collection('affiliate_referrals');
    const referralCount = await referralsCol.countDocuments({ referrerSteamId: steamId } as any);

    if (referralCount < milestone.referralsRequired) {
      return NextResponse.json({ error: 'Not eligible' }, { status: 400 });
    }

    const claimId = `${steamId}_${milestoneId}`;
    const now = new Date();

    const client = await getMongoClient();
    const session = client.startSession();

    try {
      let result: any = null;

      await session.withTransaction(async () => {
        const claimsCol = db.collection('affiliate_milestone_claims');
        const creditsCol = db.collection('user_credits');
        const ledgerCol = db.collection('credits_ledger');
        const rewardsCol = db.collection('user_rewards');
        const bonusSpinsCol = db.collection('bonus_spins');

        const existingClaim = await claimsCol.findOne({ _id: claimId } as any, { session } as any);
        if (existingClaim) {
          result = { ok: true, alreadyClaimed: true };
          return;
        }

        await claimsCol.insertOne(
          {
            _id: claimId,
            steamId,
            milestoneId,
            referralsRequired: milestone.referralsRequired,
            reward: milestone.reward,
            referralCountAtClaim: referralCount,
            createdAt: now,
          } as any,
          { session } as any
        );

        if (milestone.reward.type === 'credits') {
          const updated = await creditsCol.findOneAndUpdate(
            { _id: steamId } as any,
            {
              $setOnInsert: { _id: steamId, steamId },
              $inc: { balance: milestone.reward.amount },
              $set: { updatedAt: now },
            } as any,
            { upsert: true, returnDocument: 'after', session } as any
          );

          const doc = (updated as any)?.value ?? updated ?? null;
          const balance = Number(doc?.balance || 0);

          await ledgerCol.insertOne(
            {
              steamId,
              delta: milestone.reward.amount,
              type: 'affiliate_milestone',
              createdAt: now,
              meta: {
                milestoneId,
                referralsRequired: milestone.referralsRequired,
                referralCountAtClaim: referralCount,
              },
            } as any,
            { session } as any
          );

          result = {
            ok: true,
            alreadyClaimed: false,
            reward: milestone.reward,
            granted: milestone.reward.amount,
            balance,
          };
          return;
        }

        if (milestone.reward.type === 'spins') {
          const spinsToAdd = Math.max(0, Math.floor(Number(milestone.reward.amount || 0)));
          await bonusSpinsCol.updateOne(
            { _id: steamId } as any,
            {
              $setOnInsert: { _id: steamId, steamId, createdAt: now } as any,
              $inc: { count: spinsToAdd } as any,
              $set: { updatedAt: now } as any,
            } as any,
            { upsert: true, session } as any
          );

          result = { ok: true, alreadyClaimed: false, reward: milestone.reward, granted: spinsToAdd };
          return;
        }

        // discord_access: store in user_rewards key-value document
        const rewardsKey = 'user_rewards';
        const rewardsDoc = await rewardsCol.findOne({ _id: rewardsKey } as any, { session } as any);
        const value = (rewardsDoc as any)?.value && typeof (rewardsDoc as any).value === 'object' ? (rewardsDoc as any).value : {};
        const existingRewards: any[] = Array.isArray((value as any)[steamId]) ? (value as any)[steamId] : [];
        const dedupeTypes = new Set(['discord_access', 'price_scan_boost', 'cache_boost']);
        const shouldDedupe = dedupeTypes.has(milestone.reward.type);
        const hasAlready = shouldDedupe
          ? existingRewards.some((r: any) => r?.type === milestone.reward.type)
          : false;
        if (!hasAlready) {
          existingRewards.push({ type: milestone.reward.type, createdAt: now, source: 'affiliate_milestone', milestoneId });
          (value as any)[steamId] = existingRewards;
        }

        await rewardsCol.updateOne(
          { _id: rewardsKey } as any,
          { $set: { _id: rewardsKey, value, updatedAt: now } } as any,
          { upsert: true, session } as any
        );

        result = { ok: true, alreadyClaimed: false, reward: milestone.reward, granted: 0 };
      });

      try {
        if (result && result.ok && !result.alreadyClaimed) {
          const reward = (result as any)?.reward || milestone.reward;
          const rewardType = String(reward?.type || '').trim();
          const message = (() => {
            if (rewardType === 'credits') {
              const amt = Number(reward?.amount || 0);
              return `You claimed an affiliate milestone reward: ${amt} credits.`;
            }
            if (rewardType === 'spins') {
              const amt = Number(reward?.amount || 0);
              return `You claimed an affiliate milestone reward: ${amt} spins.`;
            }
            if (rewardType === 'discord_access') return 'You claimed an affiliate milestone reward: Discord access.';
            if (rewardType === 'wishlist_slot') return 'You claimed an affiliate milestone reward: +1 wishlist slot.';
            if (rewardType === 'price_tracker_slot') return 'You claimed an affiliate milestone reward: +1 price tracker slot.';
            if (rewardType === 'price_scan_boost') return 'You claimed an affiliate milestone reward: price scan boost.';
            if (rewardType === 'cache_boost') return 'You claimed an affiliate milestone reward: cache boost.';
            return 'You claimed an affiliate milestone reward.';
          })();

          await createUserNotification(
            db,
            steamId,
            'affiliate_milestone_claimed',
            'Affiliate Reward Claimed',
            message,
            { milestoneId, referralsRequired: milestone.referralsRequired, referralCountAtClaim: referralCount, reward }
          );
        }
      } catch {
      }

      return NextResponse.json(result || { ok: true }, { status: 200 });
    } finally {
      await session.endSession();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to claim milestone' }, { status: 500 });
  }
}
