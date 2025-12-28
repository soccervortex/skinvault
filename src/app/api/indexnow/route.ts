import { NextRequest, NextResponse } from 'next/server';
import { submitToIndexNow } from '@/app/utils/indexnow';

/**
 * POST /api/indexnow
 * Submit URLs to IndexNow for Bing and other search engines
 * 
 * Body: { urls: string[] } - Array of URLs to submit
 * 
 * Example:
 * POST /api/indexnow
 * { "urls": ["https://skinvaults.online/", "https://skinvaults.online/inventory"] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Use the utility function for consistency
    const result = await submitToIndexNow(urls);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Failed to submit URLs to IndexNow',
          urls: result.urls,
          submitted: result.submitted,
          skipped: result.skipped,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${result.submitted} URL(s) to IndexNow`,
      urls: result.urls,
      submitted: result.submitted,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('IndexNow submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/indexnow
 * Submit all sitemap URLs to IndexNow
 */
export async function GET(request: NextRequest) {
  try {
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
    
    // Get URLs from sitemap
    const sitemapUrls = [
      BASE_URL,
      `${BASE_URL}/inventory`,
      `${BASE_URL}/wishlist`,
      `${BASE_URL}/pro`,
      `${BASE_URL}/compare`,
      `${BASE_URL}/shop`,
      `${BASE_URL}/contact`,
      `${BASE_URL}/faq`,
    ];

    // Use the utility function for consistency
    const result = await submitToIndexNow(sitemapUrls);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Failed to submit URLs to IndexNow',
          urls: result.urls,
          submitted: result.submitted,
          skipped: result.skipped,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${result.submitted} URL(s) from sitemap to IndexNow`,
      urls: result.urls,
      submitted: result.submitted,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('IndexNow submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

