/**
 * Feature Announcement System
 * Allows admins to schedule feature announcements for X posts
 */

import { dbGet, dbSet } from '@/app/utils/database';

export interface FeatureAnnouncement {
  id: string;
  title: string;
  description: string;
  link?: string;
  scheduledDate?: string; // ISO date string - if set, post on this date
  posted: boolean;
  postId?: string;
  createdAt: string;
}

const FEATURE_ANNOUNCEMENTS_KEY = 'feature_announcements';

/**
 * Get all feature announcements
 */
export async function getAllFeatureAnnouncements(): Promise<FeatureAnnouncement[]> {
  try {
    const announcements = await dbGet<FeatureAnnouncement[]>(FEATURE_ANNOUNCEMENTS_KEY);
    return announcements || [];
  } catch (error) {
    console.error('Failed to get feature announcements:', error);
    return [];
  }
}

/**
 * Get unposted feature announcements
 */
export async function getUnpostedFeatureAnnouncements(): Promise<FeatureAnnouncement[]> {
  try {
    const announcements = await getAllFeatureAnnouncements();
    const now = new Date();
    
    return announcements.filter(announcement => {
      if (announcement.posted) return false;
      
      // If scheduled date is set, check if it's time to post
      if (announcement.scheduledDate) {
        const scheduledDate = new Date(announcement.scheduledDate);
        // Post if scheduled date is today or in the past
        return scheduledDate <= now;
      }
      
      // If no scheduled date, it's ready to post
      return true;
    });
  } catch (error) {
    console.error('Failed to get unposted feature announcements:', error);
    return [];
  }
}

/**
 * Create a new feature announcement
 */
export async function createFeatureAnnouncement(
  title: string,
  description: string,
  link?: string,
  scheduledDate?: string
): Promise<FeatureAnnouncement> {
  try {
    const announcements = await getAllFeatureAnnouncements();
    
    const newAnnouncement: FeatureAnnouncement = {
      id: `feat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      link,
      scheduledDate,
      posted: false,
      createdAt: new Date().toISOString(),
    };
    
    const updated = [...announcements, newAnnouncement];
    await dbSet(FEATURE_ANNOUNCEMENTS_KEY, updated);
    
    return newAnnouncement;
  } catch (error) {
    console.error('Failed to create feature announcement:', error);
    throw error;
  }
}

/**
 * Mark feature announcement as posted
 */
export async function markFeatureAnnouncementPosted(id: string, postId: string): Promise<void> {
  try {
    const announcements = await getAllFeatureAnnouncements();
    const updated = announcements.map(announcement => {
      if (announcement.id === id) {
        return { ...announcement, posted: true, postId };
      }
      return announcement;
    });
    await dbSet(FEATURE_ANNOUNCEMENTS_KEY, updated);
  } catch (error) {
    console.error('Failed to mark feature announcement as posted:', error);
  }
}

/**
 * Delete a feature announcement
 */
export async function deleteFeatureAnnouncement(id: string): Promise<void> {
  try {
    const announcements = await getAllFeatureAnnouncements();
    const updated = announcements.filter(announcement => announcement.id !== id);
    await dbSet(FEATURE_ANNOUNCEMENTS_KEY, updated);
  } catch (error) {
    console.error('Failed to delete feature announcement:', error);
    throw error;
  }
}

