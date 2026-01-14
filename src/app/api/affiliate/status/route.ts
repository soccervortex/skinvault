import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
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

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();

    const referralsCol = db.collection('affiliate_referrals');
    const claimsCol = db.collection('affiliate_milestone_claims');

    const referralCount = await referralsCol.countDocuments({ referrerSteamId: steamId } as any);

    const claims = await claimsCol
      .find({ steamId } as any, { projection: { _id: 1, milestoneId: 1 } })
      .toArray();

    const claimed = new Set<string>();
    for (const c of claims as any[]) {
      const id = String(c?.milestoneId || c?._id || '').trim();
      if (id) claimed.add(id);
    }

    const milestones = MILESTONES.map((m) => {
      const isClaimed = claimed.has(m.id);
      const isEligible = referralCount >= m.referralsRequired;
      return {
        ...m,
        claimed: isClaimed,
        claimable: isEligible && !isClaimed,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        steamId,
        referralCount,
        milestones,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load affiliate status' }, { status: 500 });
  }
}
