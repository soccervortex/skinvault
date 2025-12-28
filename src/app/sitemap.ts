import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = 'https://skinvaults.online';

  // 1. Static Routes
  const staticRoutes = ['', '/contact', '/faq', '/premium', '/shop'].map(route => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  // 2. ADVANCED: In the future, you can fetch all skins from your DB here!
  // const skins = await fetchSkins();
  // const skinRoutes = skins.map(skin => ({ url: `${BASE_URL}/skin/${skin.id}`, ... }));

  return [...staticRoutes];
}
