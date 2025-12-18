import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Get base URL from environment variable or use default
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://skinvault.app');

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/inventory', '/wishlist', '/pro', '/compare', '/item/'],
        disallow: ['/admin', '/api/', '/payment/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
