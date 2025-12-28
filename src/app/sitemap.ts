import { MetadataRoute } from 'next';

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
  let skinRoutes: MetadataRoute.Sitemap = [];
  
  try {
    // We call your internal API to get a list of all skin names/IDs
    // NOTE: Change '/api/skins/list' to your actual endpoint that returns your items
    const response = await fetch(`${BASE_URL}/api/skins/all`, { 
      next: { revalidate: 3600 } // Update this list every hour
    });

    if (response.ok) {
      const skins = await response.json();
      
      // We create a link for every skin in your database
      skinRoutes = skins.map((skin: { slug: string; updatedAt: string }) => ({
        url: `${BASE_URL}/skin/${skin.slug}`,
        lastModified: new Date(skin.updatedAt || Date.now()),
        changeFrequency: 'weekly',
        priority: 0.7,
      }));
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch dynamic skins", error);
    // If the API fails, we still return the static routes so the sitemap doesn't break
  }

  return [...staticRoutes, ...skinRoutes];
}
