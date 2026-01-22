export type AffiliateReward =
  | { type: 'credits'; amount: number }
  | { type: 'spins'; amount: number }
  | { type: 'discord_access' }
  | { type: 'wishlist_slot' }
  | { type: 'price_tracker_slot' }
  | { type: 'price_scan_boost' }
  | { type: 'cache_boost' };

export type AffiliateMilestone = {
  id: string;
  referralsRequired: number;
  reward: AffiliateReward;
};

function buildLegacyRewardMap(): Record<number, AffiliateReward> {
  return {
    1: { type: 'credits', amount: 100 },
    2: { type: 'wishlist_slot' },
    3: { type: 'discord_access' },
    4: { type: 'wishlist_slot' },
    5: { type: 'credits', amount: 600 },
    6: { type: 'wishlist_slot' },
    10: { type: 'credits', amount: 1500 },
    20: { type: 'credits', amount: 3000 },
    25: { type: 'credits', amount: 5000 },
    40: { type: 'credits', amount: 8000 },
    50: { type: 'credits', amount: 15000 },
  };
}

function defaultRewardForReferrals(n: number): AffiliateReward {
  if (n >= 7 && n % 25 === 0) return { type: 'spins', amount: 3 };
  if (n >= 7 && n % 10 === 0) return { type: 'spins', amount: 2 };
  if (n >= 7 && n % 3 === 0) return { type: 'spins', amount: 1 };
  if (n >= 7) return { type: 'credits', amount: 100 };
  return { type: 'credits', amount: 0 };
}

export function getAffiliateMilestones(): AffiliateMilestone[] {
  const legacy = buildLegacyRewardMap();

  const out: AffiliateMilestone[] = [];
  for (let i = 1; i <= 100; i++) {
    const reward = legacy[i] ?? defaultRewardForReferrals(i);

    if (i === 60) {
      out.push({ id: `ref_${i}`, referralsRequired: i, reward: { type: 'credits', amount: 20000 } });
      continue;
    }
    if (i === 70) {
      out.push({ id: `ref_${i}`, referralsRequired: i, reward: { type: 'credits', amount: 30000 } });
      continue;
    }
    if (i === 80) {
      out.push({ id: `ref_${i}`, referralsRequired: i, reward: { type: 'credits', amount: 40000 } });
      continue;
    }
    if (i === 90) {
      out.push({ id: `ref_${i}`, referralsRequired: i, reward: { type: 'credits', amount: 50000 } });
      continue;
    }
    if (i === 100) {
      out.push({ id: `ref_${i}`, referralsRequired: i, reward: { type: 'credits', amount: 75000 } });
      continue;
    }

    out.push({ id: `ref_${i}`, referralsRequired: i, reward });
  }

  return out;
}
