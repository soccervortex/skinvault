import { API_FILES, BASE_URL, isItemExcluded } from './api-endpoints';

export interface Weapon {
  name: string;
  slug: string;
  id?: string;
  marketHashName?: string;
  metaDescription?: string;
}

/**
 * Generate a URL-friendly slug from a market hash name or item name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Fetch with timeout helper
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch all CS2 items from the API and generate slugs
 * This includes ALL available item types from the CS2 API
 */
export async function getAllItems(): Promise<Weapon[]> {
  try {
    const datasets = API_FILES.map(file => ({
      url: `${BASE_URL}/${file}`,
      type: file.replace('.json', '').replace(/_/g, '_'),
    }));

    const allItems: Weapon[] = [];

    // Fetch all datasets in parallel for better performance
    const fetchPromises = datasets.map(async (dataset) => {
      try {
        const response = await fetchWithTimeout(dataset.url, 15000); // 15 second timeout
        
        if (!response.ok) {
          console.warn(`Failed to fetch ${dataset.type}: ${response.status} ${response.statusText}`);
          return [];
        }
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        const processedItems: Weapon[] = [];
        
        items.forEach((item: any) => {
          const marketHashName = item.market_hash_name || item.name || '';
          const itemId = item.id || null;
          // Skip excluded items
          if (isItemExcluded(itemId)) {
            return;
          }
          if (marketHashName) {
            processedItems.push({
              name: marketHashName,
              slug: generateSlug(marketHashName),
              id: itemId,
              marketHashName: marketHashName,
              metaDescription: `Check the current price and market history for ${marketHashName} on SkinVaults. The most accurate CS2 skin valuation tool.`,
            });
          }
        });
        
        return processedItems;
      } catch (error) {
        console.error(`Failed to fetch ${dataset.type} dataset:`, error instanceof Error ? error.message : 'Unknown error');
        return [];
      }
    });

    // Wait for all fetches to complete (using allSettled to not fail if some fail)
    const results = await Promise.allSettled(fetchPromises);
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      } else {
        console.error(`Promise rejected for ${datasets[index].type}:`, result.reason);
      }
    });

    // Fetch custom items and add them
    try {
      const { getDatabase } = await import('@/app/utils/mongodb-client');
      const db = await getDatabase();
      const customItems = await db.collection('custom_items').find({}).toArray();
      
      customItems.forEach((item: any) => {
        const marketHashName = item.marketHashName || item.name || '';
        if (marketHashName) {
          allItems.push({
            name: item.name,
            slug: generateSlug(item.name),
            id: item.id,
            marketHashName: marketHashName,
            metaDescription: `Check the current price and market history for ${item.name} on SkinVaults. The most accurate CS2 skin valuation tool.`,
          });
        }
      });
    } catch (error) {
      // Ignore custom items errors
    }

    // Remove duplicates based on ID (prefer API items over custom items)
    const itemMap = new Map<string, Weapon>();
    
    // Add all items (API items first, then custom items)
    // This ensures API items take priority, but unique custom items are still included
    allItems.forEach(item => {
      const key = item.id || item.marketHashName || item.slug;
      if (key) {
        // Only add if key doesn't exist (API items are added first, so they take priority)
        // Custom items with unique IDs will still be added
        if (!itemMap.has(key)) {
          itemMap.set(key, item);
        }
      }
    });

    return Array.from(itemMap.values());
  } catch (error) {
    console.error('Failed to fetch all items:', error);
    return [];
  }
}

// Fallback list for static generation (used when API is unavailable)
export const weaponsList: Weapon[] = [
  { 
    name: "AK-47 | Slate", 
    slug: "ak47-slate",
    metaDescription: "Check the current price and market history for AK-47 | Slate on SkinVaults. The most accurate CS2 skin valuation tool."
  },
  { 
    name: "AWP | Dragon Lore", 
    slug: "awp-dragon-lore",
    metaDescription: "Check the current price and market history for AWP | Dragon Lore on SkinVaults. The most accurate CS2 skin valuation tool."
  },
  { 
    name: "M4A4 | Howl", 
    slug: "m4a4-howl",
    metaDescription: "Check the current price and market history for M4A4 | Howl on SkinVaults. The most accurate CS2 skin valuation tool."
  },
  { 
    name: "Glock-18 | Fade", 
    slug: "glock18-fade",
    metaDescription: "Check the current price and market history for Glock-18 | Fade on SkinVaults. The most accurate CS2 skin valuation tool."
  },
  { 
    name: "Karambit | Fade", 
    slug: "karambit-fade",
    metaDescription: "Check the current price and market history for Karambit | Fade on SkinVaults. The most accurate CS2 skin valuation tool."
  },
];

