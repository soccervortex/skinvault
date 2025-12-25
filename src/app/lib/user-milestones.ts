/**
 * User Milestone Tracking System
 * Tracks user count, inventory milestones, and achievements
 */

import { dbGet, dbSet } from '@/app/utils/database';

export interface UserMilestone {
  type: 'user_count' | 'inventory_count' | 'portfolio_value' | 'rating';
  value: number;
  timestamp: string;
  posted: boolean;
  postId?: string;
}

const MILESTONES_KEY = 'user_milestones';
const USER_COUNT_KEY = 'total_user_count';
const LAST_MILESTONE_CHECK_KEY = 'last_milestone_check';

// Significant milestones to track
const USER_COUNT_MILESTONES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
const INVENTORY_MILESTONES = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000];
const PORTFOLIO_VALUE_MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]; // In EUR

/**
 * Get total user count (from first logins)
 */
export async function getTotalUserCount(): Promise<number> {
  try {
    // Try to get from dedicated key first
    const count = await dbGet<number>(USER_COUNT_KEY);
    if (count !== null && count !== undefined) {
      return count;
    }

    // Fallback: count unique first logins
    const { getFirstLoginDate, getAllProUsers } = await import('@/app/utils/pro-storage');
    const proUsers = await getAllProUsers();
    
    // Count unique users (from pro users and first logins)
    // This is an approximation - in production you'd want a dedicated user count
    const uniqueUsers = new Set(Object.keys(proUsers));
    
    // Store for future use
    await dbSet(USER_COUNT_KEY, uniqueUsers.size);
    
    return uniqueUsers.size;
  } catch (error) {
    console.error('Failed to get user count:', error);
    return 0;
  }
}

/**
 * Update user count (call when new user registers/logs in)
 */
export async function updateUserCount(): Promise<number> {
  try {
    const currentCount = await getTotalUserCount();
    const newCount = currentCount + 1;
    await dbSet(USER_COUNT_KEY, newCount);
    return newCount;
  } catch (error) {
    console.error('Failed to update user count:', error);
    return 0;
  }
}

/**
 * Check if a milestone was reached
 */
export async function checkUserCountMilestone(): Promise<UserMilestone | null> {
  try {
    const currentCount = await getTotalUserCount();
    const milestones = (await dbGet<UserMilestone[]>(MILESTONES_KEY)) || [];
    
    // Find if we've reached a new milestone
    for (const milestoneValue of USER_COUNT_MILESTONES) {
      if (currentCount >= milestoneValue) {
        // Check if we've already posted about this milestone
        const alreadyPosted = milestones.some(
          m => m.type === 'user_count' && m.value === milestoneValue && m.posted
        );
        
        if (!alreadyPosted) {
          const milestone: UserMilestone = {
            type: 'user_count',
            value: milestoneValue,
            timestamp: new Date().toISOString(),
            posted: false,
          };
          
          // Add to milestones list
          const updatedMilestones = [...milestones, milestone];
          await dbSet(MILESTONES_KEY, updatedMilestones);
          
          return milestone;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to check user count milestone:', error);
    return null;
  }
}

/**
 * Get all unposted milestones
 */
export async function getUnpostedMilestones(): Promise<UserMilestone[]> {
  try {
    const milestones = (await dbGet<UserMilestone[]>(MILESTONES_KEY)) || [];
    return milestones.filter(m => !m.posted);
  } catch (error) {
    console.error('Failed to get unposted milestones:', error);
    return [];
  }
}

/**
 * Mark milestone as posted
 */
export async function markMilestonePosted(milestone: UserMilestone, postId: string): Promise<void> {
  try {
    const milestones = (await dbGet<UserMilestone[]>(MILESTONES_KEY)) || [];
    const updated = milestones.map(m => {
      if (m.type === milestone.type && m.value === milestone.value && m.timestamp === milestone.timestamp) {
        return { ...m, posted: true, postId };
      }
      return m;
    });
    await dbSet(MILESTONES_KEY, updated);
  } catch (error) {
    console.error('Failed to mark milestone as posted:', error);
  }
}

/**
 * Get aggregate stats for milestone posts
 */
export async function getAggregateStats(): Promise<{
  totalUsers: number;
  totalInventories: number;
  totalPortfolioValue: number;
  averageRating: number;
}> {
  try {
    const totalUsers = await getTotalUserCount();
    
    // These would need to be implemented based on your data structure
    // For now, return placeholders
    return {
      totalUsers,
      totalInventories: 0, // TODO: Implement inventory count tracking
      totalPortfolioValue: 0, // TODO: Implement portfolio value tracking
      averageRating: 0, // TODO: Get from reviews
    };
  } catch (error) {
    console.error('Failed to get aggregate stats:', error);
    return {
      totalUsers: 0,
      totalInventories: 0,
      totalPortfolioValue: 0,
      averageRating: 0,
    };
  }
}

