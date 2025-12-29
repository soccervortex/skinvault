import { MetadataRoute } from 'next';
import { getAllItems, weaponsList } from '@/data/weapons';

// 1. Define where your site lives
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';

/**
 * ELI3: This function is a "Web Crawler" for your own site.
 * It builds a big list of links so Google doesn't have to guess where your skins are.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  
  // --- SECTION A: Static Pages (Hand-written) ---
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/shop`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  // --- SECTION B: Dynamic Skin Pages (The "Advanced" Part) ---
  // Fetch all items from the CS2 API with timeout protection
  let allItems: typeof weaponsList = [];
  
  try {
    // Set a timeout for the entire getAllItems() call to prevent hanging
    const itemsPromise = getAllItems();
    const timeoutPromise = new Promise<typeof weaponsList>((resolve) => 
      setTimeout(() => {
        console.warn('[Sitemap] getAllItems timeout after 30 seconds, using fallback');
        resolve(weaponsList);
      }, 30000)
    );
    
    allItems = await Promise.race([itemsPromise, timeoutPromise]);
    
    // Log success for monitoring
    if (allItems.length > 0 && allItems.length > weaponsList.length) {
      console.log(`[Sitemap] Successfully fetched ${allItems.length} items from API`);
    } else if (allItems.length === weaponsList.length) {
      console.warn('[Sitemap] Only fallback items found, API may have failed');
    } else {
      console.warn(`[Sitemap] Only ${allItems.length} items found, expected more`);
    }
  } catch (error) {
    console.error('[Sitemap] Error fetching items:', error instanceof Error ? error.message : 'Unknown error');
    console.warn('[Sitemap] Using fallback list due to error');
    allItems = weaponsList;
  }

  // Create a link for every item (includes both API items and custom items)
  // getAllItems() already merges custom items, so we don't need to fetch them separately
  const skinRoutes: MetadataRoute.Sitemap = allItems.map((item) => {
    // Use item.id if available, otherwise use marketHashName, otherwise use slug as fallback
    const itemId = item.id || item.marketHashName || item.slug;
    return {
      url: `${BASE_URL}/item/${encodeURIComponent(itemId)}`,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 0.7,
    };
  });

  const totalRoutes = staticRoutes.length + skinRoutes.length;
  console.log(`[Sitemap] Generated sitemap with ${totalRoutes} URLs (${staticRoutes.length} static + ${skinRoutes.length} dynamic)`);

  return [...staticRoutes, ...skinRoutes];
}
