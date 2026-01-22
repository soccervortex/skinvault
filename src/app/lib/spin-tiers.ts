export type SpinTier = {
  reward: number;
  weight: number;
  label: string;
  color: string;
};

export const SPIN_TIERS: SpinTier[] = [
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
];

export function getSpinOddsPct(weight: number): string {
  const total = SPIN_TIERS.reduce((sum, t) => sum + Number(t.weight || 0), 0);
  if (!Number.isFinite(total) || total <= 0) return '0%';
  const pct = (Number(weight || 0) / total) * 100;
  const decimals = pct >= 10 ? 0 : pct >= 1 ? 1 : 2;
  return `${pct.toFixed(decimals)}%`;
}

export function getWeightedSpinReward(rng: () => number = Math.random): number {
  const totalWeight = SPIN_TIERS.reduce((sum, item) => sum + item.weight, 0);
  let random = rng() * totalWeight;

  for (const item of SPIN_TIERS) {
    if (random < item.weight) {
      return item.reward;
    }
    random -= item.weight;
  }
  return SPIN_TIERS[0].reward;
}
