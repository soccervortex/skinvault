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

const BASE_MILESTONES: Milestone[] = [
  { id: 'ref_1', referralsRequired: 1, reward: { type: 'credits', amount: 100 } },
  { id: 'ref_2', referralsRequired: 2, reward: { type: 'wishlist_slot' } },
  { id: 'ref_3', referralsRequired: 3, reward: { type: 'discord_access' } },
  { id: 'ref_4', referralsRequired: 4, reward: { type: 'wishlist_slot' } },
  { id: 'ref_5', referralsRequired: 5, reward: { type: 'credits', amount: 600 } },
  { id: 'ref_6', referralsRequired: 6, reward: { type: 'wishlist_slot' } },
];

function parseRefMilestoneId(id: string): number | null {
  const m = String(id || '').trim().match(/^ref_(\d+)$/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return n;
}

function buildMilestones(referralCount: number, claimed: Set<string>): Milestone[] {
  let maxClaimedN = 0;
  for (const id of claimed.values()) {
    const n = parseRefMilestoneId(id);
    if (n && n > maxClaimedN) maxClaimedN = n;
  }

  const safeReferralCount = Math.max(0, Math.floor(Number(referralCount || 0)));
  const maxN = Math.min(200, Math.max(10, safeReferralCount + 5, maxClaimedN));

  const out: Milestone[] = [...BASE_MILESTONES];
  for (let n = 7; n <= maxN; n += 1) {
    out.push({ id: `ref_${n}`, referralsRequired: n, reward: { type: 'credits', amount: 100 } });
  }
  return out;
}

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

    const source = buildMilestones(referralCount, claimed);

    const milestones = source.map((m) => {
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
