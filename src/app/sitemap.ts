import { MetadataRoute } from 'next';
import { getAllItems, weaponsList } from '@/data/weapons';

/**
 * CACHING: This tells Next.js to cache the sitemap for 24 hours (86400 seconds).
 * This is crucial when dealing with 14,000+ items to prevent slow builds 
 * and server timeouts during Google/Bing crawling.
 */
export const revalidate = 86400;

// Update this to your production domain
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  
  // --- SECTION A: Static Routes ---
  const staticRoutes: MetadataRoute.Sitemap = [
    { 
      url: `${BASE_URL}`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 1 
    },
    { 
      url: `${BASE_URL}/shop`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/pro`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/chat`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/inventory`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/inventory`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/wishlist`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/terms`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/privacy`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/reviews`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/report-item`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/contact`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
    { 
      url: `${BASE_URL}/faq`, 
      lastModified: new Date(), 
      changeFrequency: 'daily', 
      priority: 0.9 
    },
  ];

  // --- SECTION B: Dynamic Item Routes ---
  let allItems: typeof weaponsList = [];
  
  try {
    // Attempt to fetch all items with a 30-second timeout safety net
    const itemsPromise = getAllItems();
    const timeoutPromise = new Promise<typeof weaponsList>((resolve) => 
      setTimeout(() => {
        console.warn('[Sitemap] Fetch timeout: Using fallback weaponsList');
        resolve(weaponsList);
      }, 30000)
    );
    
    allItems = await Promise.race([itemsPromise, timeoutPromise]);
    
    console.log(`[Sitemap] Successfully generating routes for ${allItems.length} items.`);
  } catch (error) {
    console.error('[Sitemap] Critical error fetching items:', error);
    // Fallback to local data if the API/Database is down
    allItems = weaponsList;
  }

  // Create sitemap entries for every item
  const itemRoutes: MetadataRoute.Sitemap = allItems.map((item) => {
    // IMPORTANT: itemId must match exactly the ID used in your Indexer script
    const itemId = item.id || item.marketHashName || item.slug;
    
    return {
      url: `${BASE_URL}/item/${encodeURIComponent(itemId)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    };
  });

  // Combine static and dynamic routes
  return [...staticRoutes, ...itemRoutes];
}