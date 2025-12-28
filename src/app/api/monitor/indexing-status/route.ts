import { NextRequest, NextResponse } from 'next/server';
import { getAllItems, weaponsList } from '@/data/weapons';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';

/**
 * GET /api/monitor/indexing-status
 * 
 * Provides information to help monitor indexing status in Google Search Console
 * 
 * This doesn't actually check Google's API (requires OAuth setup),
 * but provides URLs and guidance for manual checking.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sampleSize = parseInt(searchParams.get('sample') || '100', 10);

    // Get all items
    let allItems = await getAllItems();
    if (allItems.length === 0) {
      allItems = weaponsList;
    }

    const totalItems = allItems.length;
    
    // Get sample URLs
    const sampleUrls = allItems
      .slice(0, sampleSize)
      .map((item) => {
        const itemId = item.id || item.marketHashName || item.slug;
        return `${BASE_URL}/item/${encodeURIComponent(itemId)}`;
      });

    // Calculate statistics
    const staticPages = [
      BASE_URL,
      `${BASE_URL}/shop`,
      `${BASE_URL}/contact`,
      `${BASE_URL}/faq`,
    ];

    return NextResponse.json({
      summary: {
        totalPages: totalItems + staticPages.length,
        itemPages: totalItems,
        staticPages: staticPages.length,
      },
      sampleUrls,
      monitoring: {
        google: {
          method: 'Google Search Console',
          steps: [
            '1. Go to https://search.google.com/search-console',
            '2. Select your property (skinvaults.online)',
            '3. Go to "Coverage" report',
            '4. Check "Valid" vs "Excluded" pages',
            '5. Use "URL Inspection" tool for specific URLs',
          ],
          bulkCheck: [
            '1. Go to "URL Inspection" tool',
            '2. Use "Bulk URL Inspection" (if available)',
            '3. Or use Google Search Console API (requires setup)',
          ],
          api: {
            note: 'Google Indexing API requires OAuth 2.0 setup',
            documentation: 'https://developers.google.com/search/apis/indexing-api/v3/using-api',
            endpoint: '/api/google-index',
          },
        },
        bing: {
          method: 'Bing Webmaster Tools',
          steps: [
            '1. Go to https://www.bing.com/webmasters',
            '2. Select your site',
            '3. Go to "IndexNow" section',
            '4. Check submitted URLs',
            '5. Use "URL Inspection" for specific URLs',
          ],
          note: 'IndexNow automatically notifies Bing when URLs are submitted',
        },
      },
      recommendations: [
        'Submit sitemap to both Google and Bing (one-time)',
        'Use IndexNow for Bing (already configured)',
        'Monitor Coverage report in Google Search Console weekly',
        'Check for crawl errors regularly',
        'For Google: Consider setting up Indexing API for bulk submission',
      ],
    });
  } catch (error) {
    console.error('[Indexing Status] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

