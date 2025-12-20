// Theme Gift Rewards System - Supports all holiday themes

import { ThemeType } from './theme-storage';

export type RewardType = 
  | 'promo_code'
  | 'wishlist_boost'
  | 'price_tracker_free'
  | 'speed_boost'
  | 'wishlist_extra_slots'
  | 'pro_extension';

export interface Reward {
  type: RewardType;
  name: string;
  description: string;
  icon: string;
  duration?: number; // Duration in days if temporary
  value?: any; // Specific value (e.g., promo code string, slot count, months for Pro extension)
}

// Rewards for non-Pro users
const REWARDS_FREE: Reward[] = [
  {
    type: 'promo_code',
    name: 'Holiday Korting!',
    description: '20% korting op alle abonnementen',
    icon: '🎁',
    value: 'HOLIDAY2025',
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
const REWARDS_PRO: Reward[] = [
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

// Theme-specific reward customizations
const THEME_CONFIGS: Record<ThemeType, {
  promoCode: string;
  freeRewards: Reward[];
  proRewards: Reward[];
}> = {
  christmas: {
    promoCode: 'CHRISTMAS2025',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code' 
      ? { ...r, name: 'Kerst Korting!', value: 'CHRISTMAS2025', icon: '🎄' }
      : r
    ),
    proRewards: REWARDS_PRO.map(r => ({
      ...r,
      icon: r.value === 1 ? '🎄' : r.value === 0.25 ? '🎅' : r.value === 0.1 ? '❄️' : '🌟'
    })),
  },
  halloween: {
    promoCode: 'HALLOWEEN2025',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'Halloween Korting!', value: 'HALLOWEEN2025', icon: '🎃' }
      : r.type === 'speed_boost'
      ? { ...r, icon: '👻' }
      : r.type === 'wishlist_boost'
      ? { ...r, icon: '🦇' }
      : r
    ),
    proRewards: REWARDS_PRO.map(r => ({
      ...r,
      icon: r.value === 1 ? '🎃' : r.value === 0.25 ? '👻' : r.value === 0.1 ? '🦇' : '🕷️'
    })),
  },
  easter: {
    promoCode: 'EASTER2024',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'Pasen Korting!', value: 'EASTER2024', icon: '🐰' }
      : r.type === 'speed_boost'
      ? { ...r, icon: '🥚' }
      : r.type === 'wishlist_boost'
      ? { ...r, icon: '🌸' }
      : r
    ),
    proRewards: REWARDS_PRO.map(r => ({
      ...r,
      icon: r.value === 1 ? '🐰' : r.value === 0.25 ? '🥚' : r.value === 0.1 ? '🌸' : '🌷'
    })),
  },
  sinterklaas: {
    promoCode: 'SINTERKLAAS2024',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'Sinterklaas Korting!', value: 'SINTERKLAAS2024', icon: '🎅' }
      : r.type === 'speed_boost'
      ? { ...r, icon: '🦌' }
      : r.type === 'wishlist_boost'
      ? { ...r, icon: '🍪' }
      : r
    ),
    proRewards: REWARDS_PRO.map(r => ({
      ...r,
      icon: r.value === 1 ? '🎅' : r.value === 0.25 ? '🦌' : r.value === 0.1 ? '🍪' : '🎁'
    })),
  },
  newyear: {
    promoCode: 'NEWYEAR2025',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'Nieuwjaar Korting!', value: 'NEWYEAR2025', icon: '🎆' }
      : r.type === 'speed_boost'
      ? { ...r, icon: '✨' }
      : r.type === 'wishlist_boost'
      ? { ...r, icon: '🥳' }
      : r
    ),
    proRewards: REWARDS_PRO.map(r => ({
      ...r,
      icon: r.value === 1 ? '🎆' : r.value === 0.25 ? '✨' : r.value === 0.1 ? '🥳' : '🎊'
    })),
  },
  oldyear: {
    promoCode: 'OLDYEAR2024',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'Oudjaar Korting!', value: 'OLDYEAR2024', icon: '🕐' }
      : r.type === 'speed_boost'
      ? { ...r, icon: '⏰' }
      : r.type === 'wishlist_boost'
      ? { ...r, icon: '🎉' }
      : r
    ),
    proRewards: REWARDS_PRO.map(r => ({
      ...r,
      icon: r.value === 1 ? '🕐' : r.value === 0.25 ? '⏰' : r.value === 0.1 ? '🎉' : '🎈'
    })),
  },
};

export function getRandomReward(theme: ThemeType, isPro: boolean = false): Reward {
  const config = THEME_CONFIGS[theme];
  const rewards = isPro ? config.proRewards : config.freeRewards;
  
  if (isPro) {
    // Pro users get Pro extensions with weighted random
    // 1 month: 50%, 1 week: 25%, 3 days: 20%, 6 months: 5% (rare)
    const rand = Math.random();
    const proRewards = rewards as Reward[];
    if (rand < 0.5) return proRewards[0]; // 1 month
    if (rand < 0.75) return proRewards[1]; // 1 week
    if (rand < 0.95) return proRewards[2]; // 3 days
    return proRewards[3]; // 6 months (rare)
  } else {
    // Non-Pro users get regular rewards
    // Weighted random - promo code is more common (40%), others 15% each
    const rand = Math.random();
    if (rand < 0.4) return rewards[0]; // promo_code
    if (rand < 0.55) return rewards[1]; // wishlist_boost
    if (rand < 0.70) return rewards[2]; // price_tracker_free
    if (rand < 0.85) return rewards[3]; // speed_boost
    return rewards[4]; // wishlist_extra_slots
  }
}

const REWARD_STORAGE_KEY = 'sv_theme_rewards_2024';

export interface StoredReward {
  reward: Reward;
  theme: ThemeType;
  claimedAt: number;
  expiresAt?: number;
  used?: boolean;
}

export function saveReward(reward: Reward, theme: ThemeType): void {
  if (typeof window === 'undefined') return;
  
  try {
    const existing = localStorage.getItem(REWARD_STORAGE_KEY);
    const rewards: StoredReward[] = existing ? JSON.parse(existing) : [];
    
    const stored: StoredReward = {
      reward,
      theme,
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

export function hasClaimedGift(theme: ThemeType): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`sv_${theme}_gift_claimed_2024`) === 'true';
}

export function markGiftClaimed(theme: ThemeType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`sv_${theme}_gift_claimed_2024`, 'true');
}

