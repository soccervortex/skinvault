// Christmas Gift Rewards System

export type RewardType = 
  | 'promo_code'
  | 'wishlist_boost'
  | 'price_tracker_free'
  | 'speed_boost'
  | 'wishlist_extra_slots'
  | 'pro_extension'; // For Pro users: extends their Pro subscription

export interface Reward {
  type: RewardType;
  name: string;
  description: string;
  icon: string;
  duration?: number; // Duration in days if temporary
  value?: any; // Specific value (e.g., promo code string, slot count, months for Pro extension)
}

// Rewards for non-Pro users
export const REWARDS_FREE: Reward[] = [
  {
    type: 'promo_code',
    name: 'Kerst Korting!',
    description: '20% korting op alle abonnementen',
    icon: '🎁',
    value: 'CHRISTMAS2025',
  },
  {
    type: 'wishlist_boost',
    name: 'Wishlist Boost',
    description: '+10 extra wishlist slots voor 7 dagen',
    icon: '⭐',
    duration: 7,
    value: 10,
  },
  {
    type: 'price_tracker_free',
    name: 'Gratis Price Tracker',
    description: '1 gratis price tracker toevoegen',
    icon: '🔔',
    value: 1,
  },
  {
    type: 'speed_boost',
    name: 'Speed Boost',
    description: 'Pro scanning snelheid voor 24 uur',
    icon: '⚡',
    duration: 1,
  },
  {
    type: 'wishlist_extra_slots',
    name: 'Extra Slots',
    description: '+5 permanente wishlist slots',
    icon: '💎',
    value: 5,
  },
];

// Rewards for Pro users (Pro extensions only, no speed boost)
export const REWARDS_PRO: Reward[] = [
  {
    type: 'pro_extension',
    name: '1 Maand Gratis!',
    description: 'Je Pro abonnement wordt met 1 maand verlengd',
    icon: '👑',
    value: 1, // 1 month
  },
  {
    type: 'pro_extension',
    name: '1 Week Gratis!',
    description: 'Je Pro abonnement wordt met 1 week verlengd',
    icon: '🎄',
    value: 0.25, // 0.25 months = 1 week
  },
  {
    type: 'pro_extension',
    name: '3 Dagen Gratis!',
    description: 'Je Pro abonnement wordt met 3 dagen verlengd',
    icon: '🎅',
    value: 0.1, // ~0.1 months = 3 days
  },
  {
    type: 'pro_extension',
    name: '6 Maanden Gratis!',
    description: 'Je Pro abonnement wordt met 6 maanden verlengd! (Zeldzaam)',
    icon: '🌟',
    value: 6, // 6 months (rare)
  },
];

export function getRandomReward(isPro: boolean = false): Reward {
  if (isPro) {
    // Pro users get Pro extensions with weighted random
    // 1 month: 50%, 1 week: 25%, 3 days: 20%, 6 months: 5% (rare)
    const rand = Math.random();
    if (rand < 0.5) return REWARDS_PRO[0]; // 1 month
    if (rand < 0.75) return REWARDS_PRO[1]; // 1 week
    if (rand < 0.95) return REWARDS_PRO[2]; // 3 days
    return REWARDS_PRO[3]; // 6 months (rare)
  } else {
    // Non-Pro users get regular rewards
    // Weighted random - promo code is more common (40%), others 15% each
    const rand = Math.random();
    if (rand < 0.4) return REWARDS_FREE[0]; // promo_code
    if (rand < 0.55) return REWARDS_FREE[1]; // wishlist_boost
    if (rand < 0.70) return REWARDS_FREE[2]; // price_tracker_free
    if (rand < 0.85) return REWARDS_FREE[3]; // speed_boost
    return REWARDS_FREE[4]; // wishlist_extra_slots
  }
}

// Keep for backward compatibility
export const REWARDS = REWARDS_FREE;

const REWARD_STORAGE_KEY = 'sv_christmas_rewards_2024';

export interface StoredReward {
  reward: Reward;
  claimedAt: number;
  expiresAt?: number;
  used?: boolean;
}

export function saveReward(reward: Reward): void {
  if (typeof window === 'undefined') return;
  
  try {
    const existing = localStorage.getItem(REWARD_STORAGE_KEY);
    const rewards: StoredReward[] = existing ? JSON.parse(existing) : [];
    
    const stored: StoredReward = {
      reward,
      claimedAt: Date.now(),
      expiresAt: reward.duration ? Date.now() + (reward.duration * 24 * 60 * 60 * 1000) : undefined,
      used: false,
    };
    
    rewards.push(stored);
    localStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify(rewards));
  } catch (e) {
    console.error('Failed to save reward:', e);
  }
}

export function getStoredRewards(): StoredReward[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const existing = localStorage.getItem(REWARD_STORAGE_KEY);
    if (!existing) return [];
    
    const rewards: StoredReward[] = JSON.parse(existing);
    // Filter out expired rewards
    const now = Date.now();
    return rewards.filter(r => !r.expiresAt || r.expiresAt > now);
  } catch (e) {
    return [];
  }
}

export function hasClaimedGift(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('sv_christmas_gift_claimed_2024') === 'true';
}

export function markGiftClaimed(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sv_christmas_gift_claimed_2024', 'true');
}

