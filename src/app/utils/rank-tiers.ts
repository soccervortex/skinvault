export const RANKS = [
  { name: 'Iron', min: 0, color: '#a1a1aa' }, // zinc-400
  { name: 'Bronze', min: 100, color: '#cd7f32' },
  { name: 'Silver', min: 500, color: '#c0c0c0' },
  { name: 'Gold', min: 1000, color: '#ffd700' },
  { name: 'Platinum', min: 5000, color: '#e5e4e2' },
  { name: 'Diamond', min: 10000, color: '#b9f2ff' },
  { name: 'Master', min: 25000, color: '#9370db' },
  { name: 'Grandmaster', min: 50000, color: '#ff4500' },
  { name: 'Legend', min: 100000, color: '#f44336' },
];

export type Rank = typeof RANKS[0];

export function getRankForValue(value: number): Rank {
  let currentRank: Rank = RANKS[0];
  for (const rank of RANKS) {
    if (value >= rank.min) {
      currentRank = rank;
    } else {
      break;
    }
  }
  return currentRank;
}
