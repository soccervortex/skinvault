import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
const GOOGLE_INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

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
    const body = await request.json();
    const { urls } = body;

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

    // Note: Google Indexing API requires OAuth 2.0 authentication
    // This endpoint provides the structure, but you need to:
    // 1. Set up Google Cloud Project
    // 2. Enable Indexing API
    // 3. Create Service Account
    // 4. Add service account email to Google Search Console
    // 5. Get OAuth token
    
    return NextResponse.json({
      success: true,
      message: 'Google Indexing API requires OAuth setup. Use Google Search Console for manual submission.',
      urls: validUrls,
      instructions: {
        manual: 'Go to https://search.google.com/search-console and use "URL Inspection" tool to request indexing',
        api: 'Set up Google Cloud Project and OAuth 2.0 credentials to use this API endpoint',
      },
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
        note: 'To use the API endpoint, set up Google Cloud Project with Indexing API enabled',
        documentation: 'https://developers.google.com/search/apis/indexing-api/v3/using-api',
      },
    },
  });
}

