import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, getMongoClient, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

type Milestone = {
  id: string;
  referralsRequired: number;
  reward:
    | { type: 'credits'; amount: number }
    | { type: 'discord_access' }
    | { type: 'wishlist_slot' }
    | { type: 'price_tracker_slot' }
    | { type: 'price_scan_boost' }
    | { type: 'cache_boost' };
};

const MILESTONES: Milestone[] = [
  { id: 'ref_1', referralsRequired: 1, reward: { type: 'credits', amount: 100 } },
  { id: 'ref_2', referralsRequired: 2, reward: { type: 'wishlist_slot' } },
  { id: 'ref_3', referralsRequired: 3, reward: { type: 'discord_access' } },
  { id: 'ref_4', referralsRequired: 4, reward: { type: 'wishlist_slot' } },
  { id: 'ref_5', referralsRequired: 5, reward: { type: 'credits', amount: 600 } },
  { id: 'ref_6', referralsRequired: 6, reward: { type: 'wishlist_slot' } },
  { id: 'ref_7', referralsRequired: 7, reward: { type: 'price_scan_boost' } },
  { id: 'ref_8', referralsRequired: 8, reward: { type: 'wishlist_slot' } },
  { id: 'ref_9', referralsRequired: 9, reward: { type: 'price_tracker_slot' } },
  { id: 'ref_10', referralsRequired: 10, reward: { type: 'credits', amount: 1500 } },
  { id: 'ref_12', referralsRequired: 12, reward: { type: 'wishlist_slot' } },
  { id: 'ref_15', referralsRequired: 15, reward: { type: 'cache_boost' } },
  { id: 'ref_18', referralsRequired: 18, reward: { type: 'price_tracker_slot' } },
  { id: 'ref_20', referralsRequired: 20, reward: { type: 'credits', amount: 3000 } },
  { id: 'ref_22', referralsRequired: 22, reward: { type: 'wishlist_slot' } },
  { id: 'ref_25', referralsRequired: 25, reward: { type: 'credits', amount: 5000 } },
  { id: 'ref_30', referralsRequired: 30, reward: { type: 'wishlist_slot' } },
  { id: 'ref_35', referralsRequired: 35, reward: { type: 'price_tracker_slot' } },
  { id: 'ref_40', referralsRequired: 40, reward: { type: 'credits', amount: 8000 } },
  { id: 'ref_50', referralsRequired: 50, reward: { type: 'credits', amount: 15000 } },
];

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
              $setOnInsert: { _id: steamId, steamId, updatedAt: now },
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

      return NextResponse.json(result || { ok: true }, { status: 200 });
    } finally {
      await session.endSession();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to claim milestone' }, { status: 500 });
  }
}
