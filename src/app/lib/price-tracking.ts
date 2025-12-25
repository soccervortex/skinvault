/**
 * Price History Tracking System
 * Tracks historical prices and calculates price changes for trending items
 */

import { dbGet, dbSet } from '@/app/utils/database';
import { getItemPrice } from './inngest-functions';

export interface PriceHistoryEntry {
  marketHashName: string;
  price: number; // Price in EUR (numeric)
  priceString: string; // Formatted price string (€X.XX)
  timestamp: string; // ISO timestamp
  volume?: string; // Volume indicator (Low/Medium/High)
}

export interface PriceChange {
  marketHashName: string;
  currentPrice: number;
  previousPrice: number;
  changePercent: number;
  changeAmount: number;
  isIncrease: boolean;
  volume?: string;
  timestamp: string;
}

const PRICE_HISTORY_KEY = 'price_history';
const PRICE_HISTORY_MAX_AGE_DAYS = 30; // Keep 30 days of history

/**
 * Store price in history
 */
export async function storePriceHistory(
  marketHashName: string,
  priceData: { price: string; currency: string } | null,
  volume?: string
): Promise<void> {
  try {
    if (!priceData || !priceData.price) {
      return;
    }

    // Extract numeric price from string (€12.34 -> 12.34)
    const priceMatch = priceData.price.match(/[\d,]+\.?\d*/);
    if (!priceMatch) {
      return;
    }

    const price = parseFloat(priceMatch[0].replace(',', '.'));
    if (isNaN(price) || price <= 0) {
      return;
    }

    const history = (await dbGet<Record<string, PriceHistoryEntry[]>>(PRICE_HISTORY_KEY)) || {};
    const itemHistory = history[marketHashName] || [];

    // Add new entry
    const newEntry: PriceHistoryEntry = {
      marketHashName,
      price,
      priceString: priceData.price,
      timestamp: new Date().toISOString(),
      volume,
    };

    // Add to history (keep last 100 entries per item)
    const updatedHistory = [...itemHistory, newEntry].slice(-100);
    history[marketHashName] = updatedHistory;

    // Clean up old entries (older than 30 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - PRICE_HISTORY_MAX_AGE_DAYS);

    for (const [key, entries] of Object.entries(history)) {
      history[key] = entries.filter(
        (entry) => new Date(entry.timestamp) >= cutoffDate
      );
    }

    await dbSet(PRICE_HISTORY_KEY, history);
  } catch (error) {
    console.error('Failed to store price history:', error);
  }
}

/**
 * Get price change for an item (24h, 7d, 30d)
 */
export async function getPriceChange(
  marketHashName: string,
  period: '24h' | '7d' | '30d' = '24h'
): Promise<PriceChange | null> {
  try {
    const history = (await dbGet<Record<string, PriceHistoryEntry[]>>(PRICE_HISTORY_KEY)) || {};
    const itemHistory = history[marketHashName] || [];

    if (itemHistory.length < 2) {
      return null;
    }

    // Get current price (most recent)
    const current = itemHistory[itemHistory.length - 1];
    if (!current) {
      return null;
    }

    // Calculate period in hours
    const periodHours = period === '24h' ? 24 : period === '7d' ? 168 : 720;
    const cutoffTime = new Date(Date.now() - periodHours * 60 * 60 * 1000);

    // Find price at the start of the period
    let previous: PriceHistoryEntry | null = null;
    for (let i = itemHistory.length - 2; i >= 0; i--) {
      const entry = itemHistory[i];
      if (new Date(entry.timestamp) <= cutoffTime) {
        previous = entry;
        break;
      }
    }

    // If no entry found in period, use oldest available
    if (!previous && itemHistory.length > 0) {
      previous = itemHistory[0];
    }

    if (!previous) {
      return null;
    }

    const changeAmount = current.price - previous.price;
    const changePercent = previous.price > 0 
      ? (changeAmount / previous.price) * 100 
      : 0;

    return {
      marketHashName,
      currentPrice: current.price,
      previousPrice: previous.price,
      changePercent,
      changeAmount,
      isIncrease: changeAmount > 0,
      volume: current.volume,
      timestamp: current.timestamp,
    };
  } catch (error) {
    console.error('Failed to get price change:', error);
    return null;
  }
}

/**
 * Get trending items (significant price changes)
 */
export async function getTrendingItems(
  minChangePercent: number = 15,
  period: '24h' | '7d' = '24h',
  limit: number = 10
): Promise<PriceChange[]> {
  try {
    const history = (await dbGet<Record<string, PriceHistoryEntry[]>>(PRICE_HISTORY_KEY)) || {};
    const trending: PriceChange[] = [];

    // Check all items in history
    for (const marketHashName of Object.keys(history)) {
      const change = await getPriceChange(marketHashName, period);
      
      if (change && Math.abs(change.changePercent) >= minChangePercent) {
        trending.push(change);
      }
    }

    // Sort by absolute change percentage (descending)
    trending.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    return trending.slice(0, limit);
  } catch (error) {
    console.error('Failed to get trending items:', error);
    return [];
  }
}

/**
 * Get top movers (gainers and losers)
 */
export async function getTopMovers(
  period: '24h' | '7d' = '24h',
  limit: number = 5
): Promise<{ gainers: PriceChange[]; losers: PriceChange[] }> {
  try {
    const trending = await getTrendingItems(5, period, limit * 2); // Get more to filter

    const gainers = trending
      .filter((item) => item.isIncrease)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit);

    const losers = trending
      .filter((item) => !item.isIncrease)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, limit);

    return { gainers, losers };
  } catch (error) {
    console.error('Failed to get top movers:', error);
    return { gainers: [], losers: [] };
  }
}

/**
 * Update price history for an item (fetch current price and store)
 */
export async function updatePriceHistory(marketHashName: string): Promise<void> {
  try {
    const priceData = await getItemPrice(marketHashName);
    if (priceData) {
      await storePriceHistory(marketHashName, priceData);
    }
  } catch (error) {
    console.error('Failed to update price history:', error);
  }
}

/**
 * Batch update price history for multiple items
 */
export async function batchUpdatePriceHistory(marketHashNames: string[]): Promise<void> {
  try {
    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < marketHashNames.length; i += batchSize) {
      const batch = marketHashNames.slice(i, i + batchSize);
      await Promise.all(batch.map((name) => updatePriceHistory(name)));
      
      // Small delay between batches
      if (i + batchSize < marketHashNames.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('Failed to batch update price history:', error);
  }
}

