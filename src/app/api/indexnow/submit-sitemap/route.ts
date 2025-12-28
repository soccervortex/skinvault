import { NextRequest, NextResponse } from 'next/server';
import { submitToIndexNow } from '@/app/utils/indexnow';
import { getAllItems, weaponsList } from '@/data/weapons';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';

/**
 * POST /api/indexnow/submit-sitemap
 * Submit all URLs from sitemap to IndexNow
 * 
 * This endpoint reads the sitemap and submits all URLs to IndexNow.
 * Useful for initial submission or bulk updates.
 * 
 * Note: IndexNow has rate limits, so submitting thousands of URLs
 * might need to be done in batches.
 * 
 * Body (optional): { 
 *   limit: number, // Max URLs to submit (default: 1000)
 *   batchSize: number // URLs per batch (default: 100)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { limit = 1000, batchSize = 100 } = body;

    console.log('[IndexNow Sitemap] Starting sitemap URL submission...');

    // Get all URLs from sitemap (same logic as sitemap.ts)
    const staticRoutes = [
      BASE_URL,
      `${BASE_URL}/shop`,
      `${BASE_URL}/contact`,
      `${BASE_URL}/faq`,
    ];

    // Get all items
    let allItems = await getAllItems();
    if (allItems.length === 0) {
      console.warn('[IndexNow Sitemap] Failed to fetch items from API, using fallback list');
      allItems = weaponsList;
    }

    // Create item URLs
    const itemUrls = allItems
      .slice(0, limit - staticRoutes.length) // Respect limit
      .map((item) => {
        const itemId = item.id || item.marketHashName || item.slug;
        return `${BASE_URL}/item/${encodeURIComponent(itemId)}`;
      });

    const allUrls = [...staticRoutes, ...itemUrls];
    const totalUrls = allUrls.length;

    console.log(`[IndexNow Sitemap] Found ${totalUrls} URLs to submit (limit: ${limit})`);

    // Submit in batches to avoid rate limits
    const batches: string[][] = [];
    for (let i = 0; i < allUrls.length; i += batchSize) {
      batches.push(allUrls.slice(i, i + batchSize));
    }

    console.log(`[IndexNow Sitemap] Submitting in ${batches.length} batch(es) of ${batchSize} URLs each`);

    const results = [];
    let totalSubmitted = 0;
    let totalSkipped = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[IndexNow Sitemap] Submitting batch ${i + 1}/${batches.length} (${batch.length} URLs)...`);

      const result = await submitToIndexNow(batch);
      results.push({
        batch: i + 1,
        submitted: result.submitted,
        skipped: result.skipped,
        success: result.success,
        error: result.error,
      });

      totalSubmitted += result.submitted;
      totalSkipped += result.skipped;

      // Small delay between batches to avoid rate limits
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    return NextResponse.json({
      success: true,
      message: `Submitted ${totalSubmitted} URL(s) from sitemap to IndexNow`,
      summary: {
        totalUrls,
        totalSubmitted,
        totalSkipped,
        batches: batches.length,
        batchSize,
      },
      batches: results,
    });
  } catch (error) {
    console.error('[IndexNow Sitemap] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/indexnow/submit-sitemap
 * Get information about sitemap URLs without submitting
 */
export async function GET(request: NextRequest) {
  try {
    // Get all URLs from sitemap (same logic as sitemap.ts)
    const staticRoutes = [
      BASE_URL,
      `${BASE_URL}/shop`,
      `${BASE_URL}/contact`,
      `${BASE_URL}/faq`,
    ];

    // Get all items
    let allItems = await getAllItems();
    if (allItems.length === 0) {
      allItems = weaponsList;
    }

    // Create item URLs
    const itemUrls = allItems.map((item) => {
      const itemId = item.id || item.marketHashName || item.slug;
      return `${BASE_URL}/item/${encodeURIComponent(itemId)}`;
    });

    const allUrls = [...staticRoutes, ...itemUrls];

    return NextResponse.json({
      totalUrls: allUrls.length,
      staticPages: staticRoutes.length,
      itemPages: itemUrls.length,
      sampleUrls: allUrls.slice(0, 10), // First 10 as sample
      note: 'Use POST to submit all URLs to IndexNow',
    });
  } catch (error) {
    console.error('[IndexNow Sitemap] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

