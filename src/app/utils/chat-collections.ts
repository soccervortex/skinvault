/**
 * Utility functions for managing date-based chat collections
 * This improves performance by splitting messages into daily collections
 */

/**
 * Get collection name for a specific date
 * Format: chats_YYYY-MM-DD
 */
export function getChatCollectionName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `chats_${year}-${month}-${day}`;
}

/**
 * Alias for getChatCollectionName
 */
export function getCollectionName(date: Date): string {
  return getChatCollectionName(date);
}

/**
 * Get collection name for today
 */
export function getTodayCollectionName(): string {
  return getChatCollectionName(new Date());
}

/**
 * Get collection names for the last N days
 */
export function getCollectionNamesForDays(days: number): string[] {
  const collections: string[] = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    collections.push(getChatCollectionName(date));
  }
  
  return collections;
}

/**
 * Get collection names for date range
 */
export function getCollectionNamesForRange(startDate: Date, endDate: Date): string[] {
  const collections: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    collections.push(getChatCollectionName(current));
    current.setDate(current.getDate() + 1);
  }
  
  return collections;
}

/**
 * Get DM collection name for a specific date
 * Format: dms_YYYY-MM-DD
 */
export function getDMCollectionName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `dms_${year}-${month}-${day}`;
}

/**
 * Get DM collection name for today
 */
export function getTodayDMCollectionName(): string {
  return getDMCollectionName(new Date());
}

/**
 * Get DM collection names for the last N days
 */
export function getDMCollectionNamesForDays(days: number): string[] {
  const collections: string[] = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    collections.push(getDMCollectionName(date));
  }
  
  return collections;
}

