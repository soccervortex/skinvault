import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Get base URL from environment variable or use default
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://skinvaults.online');

  const commonDisallows = ['/admin', '/api/', '/payment/', '/chat', '/cgi-bin/', '/_next/static/', '/_next/image', '/_next/private/'];

  return {
    rules: [
      // 1. Rules for specific search engine bots from your original file
      {
        userAgent: [
          'Googlebot', 'googlebot-image', 'googlebot-mobile', 
          'bingbot', 'MSNBot', // Bing uses both bingbot (modern) and MSNBot (legacy)
          'Slurp', 'Gigabot', 'Robozilla', 'Nutch', 'ia_archiver', 
          'baiduspider', 'naverbot', 'yeti', 'yahoo-mmcrawler', 'psbot', 'yahoo-blogs/v3.9'
        ],
        disallow: commonDisallows,
      },
      // 2. Rules for AI/LLM crawlers (Explicitly Allow)
      {
        userAgent: [
          'GPTBot', 'ChatGPT-User', 'CCBot', 'anthropic-ai', 
          'ClaudeBot', 'PerplexityBot', 'Google-Extended', 
          'Applebot-Extended', 'FacebookBot'
        ],
        allow: '/',
      },
      // 3. General rules for all other bots (*)
      {
        userAgent: '*',
        allow: [
          '/', '/inventory', '/wishlist', '/pro', '/compare', 
          '/item/', '/shop', '/contact', '/faq', '/privacy', '/terms', '/reviews'
        ],
        disallow: commonDisallows,
        crawlDelay: 1,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}