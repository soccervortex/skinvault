import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, getMongoClient, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

type Milestone = {
  id: string;
  referralsRequired: number;
  rewardCredits: number;
};

const MILESTONES: Milestone[] = [
  { id: 'ref_1', referralsRequired: 1, rewardCredits: 100 },
  { id: 'ref_5', referralsRequired: 5, rewardCredits: 600 },
  { id: 'ref_10', referralsRequired: 10, rewardCredits: 1500 },
  { id: 'ref_25', referralsRequired: 25, rewardCredits: 5000 },
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

        const existing = await claimsCol.findOne({ _id: claimId } as any, { session } as any);
        if (existing) {
          result = { ok: true, alreadyClaimed: true };
          return;
        }

        await claimsCol.insertOne(
          {
            _id: claimId,
            steamId,
            milestoneId,
            referralsRequired: milestone.referralsRequired,
            rewardCredits: milestone.rewardCredits,
            referralCountAtClaim: referralCount,
            createdAt: now,
          } as any,
          { session } as any
        );

        const updated = await creditsCol.findOneAndUpdate(
          { _id: steamId } as any,
          {
            $setOnInsert: { _id: steamId, steamId, balance: 0, updatedAt: now },
            $inc: { balance: milestone.rewardCredits },
            $set: { updatedAt: now },
          } as any,
          { upsert: true, returnDocument: 'after', session } as any
        );

        const doc = (updated as any)?.value ?? updated ?? null;
        const balance = Number(doc?.balance || 0);

        await ledgerCol.insertOne(
          {
            steamId,
            delta: milestone.rewardCredits,
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

        result = { ok: true, alreadyClaimed: false, balance, granted: milestone.rewardCredits };
      });

      return NextResponse.json(result || { ok: true }, { status: 200 });
    } finally {
      await session.endSession();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to claim milestone' }, { status: 500 });
  }
}
