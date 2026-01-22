export type SpinRewardTier = {
  reward: number;
  weight: number;
  label: string;
  color: string;
};

export const SPIN_REWARD_TIERS: readonly SpinRewardTier[] = [
  { reward: 10, weight: 30, label: 'Consumer Grade', color: '#b0c3d9' },
  { reward: 25, weight: 25, label: 'Industrial Grade', color: '#5e98d9' },
  { reward: 50, weight: 22.5, label: 'Mil-Spec', color: '#4b69ff' },
  { reward: 100, weight: 15, label: 'Restricted', color: '#8847ff' },
  { reward: 500, weight: 10, label: 'Classified', color: '#d32ce6' },
  { reward: 1000, weight: 5, label: 'Covert', color: '#eb4b4b' },
  { reward: 2000, weight: 2, label: 'Extraordinary', color: '#eb4b4b' },
  { reward: 5000, weight: 1, label: 'Extraordinary', color: '#eb4b4b' },
  { reward: 10000, weight: 0.47, label: 'Contraband', color: '#ffd700' },
  { reward: 30000, weight: 0.23, label: 'Contraband', color: '#ffd700' },
  { reward: 50000, weight: 0.1, label: 'Contraband', color: '#ffd700' },
  { reward: 75000, weight: 0.06, label: 'Contraband', color: '#ffd700' },
] as const;

function formatPercent(p: number): string {
  if (!Number.isFinite(p) || p < 0) return '0%';
  if (p < 1) return `${p.toFixed(2)}%`;
  if (Math.abs(p - Math.round(p)) < 1e-9) return `${Math.round(p)}%`;
  if (Math.abs(p * 10 - Math.round(p * 10)) < 1e-9) return `${p.toFixed(1)}%`;
  return `${p.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

export function getSpinTierByReward(reward: number): SpinRewardTier {
  const r = Number(reward);
  if (!Number.isFinite(r)) return SPIN_REWARD_TIERS[0];
  return SPIN_REWARD_TIERS.find((t) => t.reward === r) || SPIN_REWARD_TIERS[0];
}

export function pickWeightedSpinReward(
  rng: () => number = Math.random
): number {
  const totalWeight = SPIN_REWARD_TIERS.reduce((sum, item) => sum + item.weight, 0);
  let random = rng() * totalWeight;
  for (const item of SPIN_REWARD_TIERS) {
    if (random < item.weight) {
      return item.reward;
    }
    random -= item.weight;
  }
  return SPIN_REWARD_TIERS[0].reward;
}

export type SpinTierWithOdds = SpinRewardTier & { odds: string };

export function getSpinTiersWithOdds(): SpinTierWithOdds[] {
  const totalWeight = SPIN_REWARD_TIERS.reduce((sum, item) => sum + item.weight, 0);
  return SPIN_REWARD_TIERS.map((t) => {
    const pct = totalWeight > 0 ? (t.weight / totalWeight) * 100 : 0;
    return { ...t, odds: formatPercent(pct) };
  });
}
