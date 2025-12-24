import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Get base URL from environment variable or use default
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://skinvaults.online');

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/inventory', '/wishlist', '/pro', '/compare', '/item/', '/shop', '/contact', '/faq', '/privacy', '/terms'],
        disallow: ['/admin', '/api/', '/payment/', '/chat'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}








