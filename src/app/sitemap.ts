import { MetadataRoute } from 'next';
import { getAllItems, weaponsList } from '@/data/weapons';

/**
 * CACHING: Cache for 24 hours to handle the heavy load of 14,000+ items.
 */
export const revalidate = 86400;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  
  // --- SECTION A: Static Routes ---
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/shop`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/pro`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/chat`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/inventory`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/wishlist`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/reviews`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/report-item`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  ];

  // --- SECTION B: Dynamic Item Routes ---
  let allItems: typeof weaponsList = [];
  
  try {
    const itemsPromise = getAllItems();
    const timeoutPromise = new Promise<typeof weaponsList>((resolve) => 
      setTimeout(() => {
        console.warn('[Sitemap] Fetch timeout: Using fallback');
        resolve(weaponsList);
      }, 30000)
    );
    
    allItems = await Promise.race([itemsPromise, timeoutPromise]);
  } catch (error) {
    console.error('[Sitemap] Critical error:', error);
    allItems = weaponsList;
  }

  const itemRoutes: MetadataRoute.Sitemap = allItems.map((item) => {
    const itemId = item.id || item.marketHashName || item.slug;
    const itemName = item.name || item.marketHashName || 'CS2 Skin';
    
    // Determine the image URL. Ensure this points to your actual image source.
    const imageUrl = item.image || item.icon_url || '';

    return {
      url: `${BASE_URL}/item/${encodeURIComponent(itemId)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
      // Add image metadata here
      images: imageUrl ? [imageUrl] : [],
    };
  });

  return [...staticRoutes, ...itemRoutes];
}