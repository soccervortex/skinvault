import { NextRequest, NextResponse } from 'next/server';
import { submitItemsToIndexNow } from '@/app/utils/indexnow';
import { getAllItems, weaponsList } from '@/data/weapons';

/**
 * POST /api/indexnow/submit-all-items
 * Submit all item pages to IndexNow (for Bing, Yandex, etc.)
 * 
 * This submits all item pages from your sitemap to IndexNow.
 * IndexNow works for Bing, Yandex, Seznam.cz, Naver - but NOT Google.
 * 
 * Body (optional): { 
 *   limit: number, // Max items to submit (default: 1000 per request)
 *   offset: number // Start from this index (for pagination)
 * }
 * 
 * Note: IndexNow has rate limits. For 39k items, you'll need to:
 * 1. Submit in batches (use offset/limit)
 * 2. Wait between batches
 * 3. Run multiple times if needed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { limit = 1000, offset = 0 } = body;

    console.log(`[IndexNow Items] Starting item submission (offset: ${offset}, limit: ${limit})...`);

    // Get all items
    let allItems = await getAllItems();
    if (allItems.length === 0) {
      console.warn('[IndexNow Items] Failed to fetch items from API, using fallback list');
      allItems = weaponsList;
    }

    const totalItems = allItems.length;
    const itemsToSubmit = allItems.slice(offset, offset + limit);
    const itemIds = itemsToSubmit.map((item) => item.id || item.marketHashName || item.slug);

    console.log(`[IndexNow Items] Submitting ${itemsToSubmit.length} items (${offset + 1}-${offset + itemsToSubmit.length} of ${totalItems})...`);

    // Submit to IndexNow
    const result = await submitItemsToIndexNow(itemIds);

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Submitted ${result.submitted} item(s) to IndexNow`
        : `Failed: ${result.error}`,
      submitted: result.submitted,
      skipped: result.skipped,
      totalItems,
      currentBatch: {
        offset,
        limit,
        submitted: itemsToSubmit.length,
      },
      nextBatch: offset + limit < totalItems ? {
        offset: offset + limit,
        limit,
        estimatedItems: Math.min(limit, totalItems - (offset + limit)),
      } : null,
      note: 'IndexNow works for Bing, Yandex, Seznam.cz, Naver. For Google, use Google Search Console or Indexing API.',
    });
  } catch (error) {
    console.error('[IndexNow Items] Error:', error);
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
 * GET /api/indexnow/submit-all-items
 * Get information about item pages without submitting
 */
export async function GET(request: NextRequest) {
  try {
    // Get all items
    let allItems = await getAllItems();
    if (allItems.length === 0) {
      allItems = weaponsList;
    }

    const totalItems = allItems.length;
    const sampleItems = allItems.slice(0, 10).map((item) => ({
      id: item.id || item.marketHashName || item.slug,
      name: item.name || item.marketHashName,
      url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online'}/item/${encodeURIComponent(item.id || item.marketHashName || item.slug)}`,
    }));

    return NextResponse.json({
      totalItems,
      note: 'Use POST to submit all item pages to IndexNow',
      sampleItems,
      recommendation: {
        batchSize: 1000,
        estimatedBatches: Math.ceil(totalItems / 1000),
        note: 'Submit in batches to avoid rate limits. IndexNow works for Bing/Yandex, not Google.',
      },
    });
  } catch (error) {
    console.error('[IndexNow Items] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

