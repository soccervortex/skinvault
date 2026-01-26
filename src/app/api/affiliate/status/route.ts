import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
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

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) {
    const res = NextResponse.json(
      { ok: true, steamId: null, referralCount: 0, milestones: [] },
      { status: 200 }
    );
    res.headers.set('cache-control', 'no-store');
    return res;
  }

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
