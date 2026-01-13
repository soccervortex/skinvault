import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
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
