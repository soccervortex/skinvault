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
 * Fetch all CS2 items from the API and generate slugs
 * This includes skins, stickers, agents, and crates
 */
export async function getAllItems(): Promise<Weapon[]> {
  try {
    const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
    const datasets = [
      { url: `${BASE_URL}/skins_not_grouped.json`, type: 'skin' },
      { url: `${BASE_URL}/stickers.json`, type: 'sticker' },
      { url: `${BASE_URL}/agents.json`, type: 'agent' },
      { url: `${BASE_URL}/crates.json`, type: 'crate' },
    ];

    const allItems: Weapon[] = [];

    for (const dataset of datasets) {
      try {
        const response = await fetch(dataset.url, { 
          next: { revalidate: 3600 } // Cache for 1 hour
        });
        
        if (!response.ok) continue;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        
        items.forEach((item: any) => {
          const marketHashName = item.market_hash_name || item.name || '';
          const itemId = item.id || null;
          if (marketHashName) {
            allItems.push({
              name: marketHashName,
              slug: generateSlug(marketHashName),
              id: itemId,
              marketHashName: marketHashName,
              metaDescription: `Check the current price and market history for ${marketHashName} on SkinVaults. The most accurate CS2 skin valuation tool.`,
            });
          }
        });
      } catch (error) {
        console.error(`Failed to fetch ${dataset.type} dataset:`, error);
      }
    }

    // Remove duplicates based on slug
    const uniqueItems = Array.from(
      new Map(allItems.map(item => [item.slug, item])).values()
    );

    return uniqueItems;
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

