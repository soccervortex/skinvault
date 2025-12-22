// Theme Gift Rewards System - Supports all holiday themes

import { ThemeType } from './theme-storage';

export type RewardType = 
  | 'promo_code'
  | 'wishlist_boost'
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
    name: 'Holiday Discount!',
    description: '20% off all subscriptions',
    icon: '🎁',
    value: 'HOLIDAY2025',
  },
  {
    type: 'wishlist_boost',
    name: 'Wishlist Boost',
    description: '+10 extra wishlist slots for 7 days',
    icon: '⭐',
    duration: 7,
    value: 10,
  },
  {
    type: 'speed_boost',
    name: 'Speed Boost',
    description: 'Pro scanning speed for 24 hours',
    icon: '⚡',
    duration: 1,
  },
  {
    type: 'wishlist_extra_slots',
    name: 'Extra Slots',
    description: '+5 permanent wishlist slots',
    icon: '💎',
    value: 5,
  },
];

// Rewards for Pro users (Pro extensions only, no speed boost)
const REWARDS_PRO: Reward[] = [
  {
    type: 'pro_extension',
    name: '1 Month Free!',
    description: 'Your Pro subscription extended by 1 month',
    icon: '👑',
    value: 1, // 1 month
  },
  {
    type: 'pro_extension',
    name: '1 Week Free!',
    description: 'Your Pro subscription extended by 1 week',
    icon: '🎄',
    value: 0.25, // 0.25 months = 1 week
  },
  {
    type: 'pro_extension',
    name: '3 Days Free!',
    description: 'Your Pro subscription extended by 3 days',
    icon: '🎅',
    value: 0.1, // ~0.1 months = 3 days
  },
  {
    type: 'pro_extension',
    name: '6 Months Free!',
    description: 'Your Pro subscription extended by 6 months! (Rare)',
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
      ? { ...r, name: 'Christmas Discount!', value: 'CHRISTMAS2025', icon: '🎄' }
      : r
    ),
    proRewards: REWARDS_PRO.map(r => ({
      ...r,
      icon: r.value === 1 ? '🎄' : r.value === 0.25 ? '🎅' : r.value === 0.1 ? '❄️' : '🌟'
    })),
  },
  halloween: {
    promoCode: 'HALLOWEEN2026',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'Halloween Discount!', value: 'HALLOWEEN2026', icon: '🎃' }
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
    promoCode: 'EASTER2026',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'Easter Discount!', value: 'EASTER2026', icon: '🐰' }
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
    promoCode: 'SINTERKLAAS2026',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'Sinterklaas Discount!', value: 'SINTERKLAAS2026', icon: '🎅' }
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
    promoCode: 'NEWYEAR2026',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'New Year Discount!', value: 'NEWYEAR2026', icon: '🎆' }
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
    promoCode: 'OLDYEAR2025',
    freeRewards: REWARDS_FREE.map(r => r.type === 'promo_code'
      ? { ...r, name: 'Old Year Discount!', value: 'OLDYEAR2025', icon: '🕐' }
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
    // Non-Pro users get regular rewards with small chance for Pro extension
    const rand = Math.random();
    
    // 5% chance for Pro trial (1 week) - rare reward for free users
    if (rand < 0.05) {
      return {
        type: 'pro_extension',
        name: '1 Week Free Pro!',
        description: 'Get Pro subscription for 1 week',
        icon: config.proRewards[1].icon,
        value: 0.25, // 0.25 months = 1 week
      };
    }
    
    // Regular rewards with adjusted weights (remaining 95%)
    const adjustedRand = (rand - 0.05) / 0.95; // Rescale remaining probability
    
    if (adjustedRand < 0.421) return rewards[0]; // promo_code (40% of 95% ≈ 38%)
    if (adjustedRand < 0.579) return rewards[1]; // wishlist_boost (15.8% of 95% ≈ 15%)
    if (adjustedRand < 0.789) return rewards[2]; // speed_boost (21% of 95% ≈ 20%)
    return rewards[3]; // wishlist_extra_slots (21% of 95% ≈ 20%)
  }
}

// REWARD_STORAGE_KEY is deprecated - use theme-specific keys instead
// Kept for backwards compatibility but not used in new code
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
    // Test if localStorage is accessible
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    
    // Use theme-specific key for consistency with getStoredRewards fallback
    const year = theme === 'christmas' || theme === 'oldyear' ? '2025' : '2026';
    const storageKey = `sv_${theme}_rewards_${year}`;
    
    const existing = window.localStorage.getItem(storageKey);
    const rewards: StoredReward[] = existing ? JSON.parse(existing) : [];
    
    // Permanent rewards (wishlist_extra_slots) should never expire
    const isPermanent = reward.type === 'wishlist_extra_slots';
    
    const stored: StoredReward = {
      reward,
      theme,
      claimedAt: Date.now(),
      expiresAt: isPermanent ? undefined : (reward.duration ? Date.now() + (reward.duration * 24 * 60 * 60 * 1000) : undefined),
      used: false,
    };
    
    rewards.push(stored);
    window.localStorage.setItem(storageKey, JSON.stringify(rewards));
  } catch (e) {
    // Ignore localStorage errors (browser privacy settings, sandboxed iframe, etc.)
    // Don't log to avoid console noise in production
  }
}

export function getStoredRewards(theme?: ThemeType): StoredReward[] {
  if (typeof window === 'undefined') return [];
  
  try {
    // Test if localStorage is accessible
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    
    // If theme is specified, only get rewards for that theme
    if (theme) {
      const year = theme === 'christmas' || theme === 'oldyear' ? '2025' : '2026';
      const storageKey = `sv_${theme}_rewards_${year}`;
      const existing = window.localStorage.getItem(storageKey);
      if (!existing) return [];
      
      const rewards: StoredReward[] = JSON.parse(existing);
      const now = Date.now();
      // Permanent rewards (wishlist_extra_slots) should never be filtered out
      return rewards.filter(r => {
        const isPermanent = r.reward?.type === 'wishlist_extra_slots';
        return isPermanent || !r.expiresAt || r.expiresAt > now;
      });
    }
    
    // Get rewards from all themes
    const themes: ThemeType[] = ['christmas', 'halloween', 'easter', 'sinterklaas', 'newyear', 'oldyear'];
    const allRewards: StoredReward[] = [];
    
    themes.forEach(t => {
      try {
        const year = t === 'christmas' || t === 'oldyear' ? '2025' : '2026';
        const storageKey = `sv_${t}_rewards_${year}`;
        const existing = window.localStorage.getItem(storageKey);
        if (existing) {
          try {
            const rewards: StoredReward[] = JSON.parse(existing);
            const now = Date.now();
            // Permanent rewards should never be filtered out
            rewards.forEach(r => {
              const isPermanent = r.reward?.type === 'wishlist_extra_slots';
              if (isPermanent || !r.expiresAt || r.expiresAt > now) {
                allRewards.push(r);
              }
            });
          } catch {
            // Skip invalid JSON
          }
        }
      } catch {
        // Skip this theme if localStorage access fails
      }
    });
    
    return allRewards;
  } catch (e) {
    // Ignore localStorage errors (browser privacy settings, sandboxed iframe, etc.)
    return [];
  }
}

export function hasClaimedGift(theme: ThemeType): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Test if localStorage is accessible
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    
    const year = theme === 'christmas' || theme === 'oldyear' ? '2025' : '2026';
    return window.localStorage.getItem(`sv_${theme}_gift_claimed_${year}`) === 'true';
  } catch {
    // Ignore localStorage errors
    return false;
  }
}

export function markGiftClaimed(theme: ThemeType): void {
  if (typeof window === 'undefined') return;
  try {
    // Test if localStorage is accessible
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    
    const year = theme === 'christmas' || theme === 'oldyear' ? '2025' : '2026';
    window.localStorage.setItem(`sv_${theme}_gift_claimed_${year}`, 'true');
  } catch {
    // Ignore localStorage errors
  }
}

