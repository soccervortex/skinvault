import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Get base URL from environment variable or use default
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/payment/', '/chat', '/cgi-bin/'],
      },
    ],
    sitemap: 'https://skinvaults.online/sitemap.xml',
  };
}
