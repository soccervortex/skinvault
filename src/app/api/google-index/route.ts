import { NextRequest, NextResponse } from 'next/server';
import { submitUrlsToGoogleIndexing } from '@/app/utils/google-indexing';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.skinvaults.online';

function isAuthorized(request: NextRequest): boolean {
  const secret = String(process.env.GOOGLE_INDEXING_SECRET || '').trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

/**
 * POST /api/google-index
 * Request Google to re-index URLs via Google Search Console API
 * 
 * Note: This requires Google Search Console API credentials to be set up.
 * For manual submission, use Google Search Console web interface.
 * 
 * Body: { urls: string[] } - Array of URLs to submit
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { urls, type } = body as { urls?: string[]; type?: 'URL_UPDATED' | 'URL_DELETED' };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate URLs belong to our domain
    const validUrls = urls.filter((url: string) => {
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(BASE_URL);
        return urlObj.hostname === baseUrlObj.hostname;
      } catch {
        return false;
      }
    });

    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: 'All URLs must belong to the same host as the base URL' },
        { status: 400 }
      );
    }

    const result = await submitUrlsToGoogleIndexing({ urls: validUrls, type: type || 'URL_UPDATED' });

    return NextResponse.json({
      success: result.enabled && result.failed === 0,
      enabled: result.enabled,
      submitted: result.submitted,
      failed: result.failed,
      results: result.results,
      note: result.enabled
        ? undefined
        : 'Google indexing is disabled. Set GOOGLE_INDEXING_ENABLED=true and required service account env vars.',
    });
  } catch (error) {
    console.error('Google indexing error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/google-index
 * Get instructions for submitting URLs to Google
 */
export async function GET() {
  return NextResponse.json({
    message: 'Google Search Console URL Submission',
    instructions: {
      manual: {
        url: 'https://search.google.com/search-console',
        steps: [
          '1. Go to Google Search Console',
          '2. Select your property (skinvaults.online)',
          '3. Use "URL Inspection" tool',
          '4. Enter URL and click "Request Indexing"',
        ],
      },
      sitemap: {
        url: `${BASE_URL}/sitemap.xml`,
        note: 'Submit your sitemap in Google Search Console under "Sitemaps" section',
      },
      api: {
        note: 'This endpoint supports Google Indexing API via a service account (JWT). Set env vars and call POST with Authorization Bearer secret.',
        documentation: 'https://developers.google.com/search/apis/indexing-api/v3/using-api',
      },
    },
  });
}

