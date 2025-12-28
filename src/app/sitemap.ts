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
  // Fetch all items from the CS2 API
  let allItems = await getAllItems();
  
  // Fallback to static list if API fails
  if (allItems.length === 0) {
    console.warn('Failed to fetch items from API, using fallback list');
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

  return [...staticRoutes, ...skinRoutes];
}
