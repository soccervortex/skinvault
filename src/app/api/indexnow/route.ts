import { NextRequest, NextResponse } from 'next/server';

const INDEXNOW_API_KEY = '99982adb45e64fb7b2e24712db654185';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
const KEY_LOCATION = `${BASE_URL}/99982adb45e64fb7b2e24712db654185.txt`;

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

    // Prepare IndexNow request
    const indexNowPayload = {
      host: new URL(BASE_URL).hostname,
      key: INDEXNOW_API_KEY,
      keyLocation: KEY_LOCATION,
      urlList: validUrls,
    };

    // Submit to IndexNow
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(indexNowPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('IndexNow API error:', response.status, errorText);
      
      return NextResponse.json(
        { 
          error: 'Failed to submit URLs to IndexNow',
          status: response.status,
          details: errorText,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${validUrls.length} URL(s) to IndexNow`,
      urls: validUrls,
      submitted: validUrls.length,
      skipped: urls.length - validUrls.length,
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
    // Get URLs from sitemap
    const sitemapUrls = [
      BASE_URL,
      `${BASE_URL}/inventory`,
      `${BASE_URL}/wishlist`,
      `${BASE_URL}/pro`,
      `${BASE_URL}/compare`,
    ];

    // Prepare IndexNow request
    const indexNowPayload = {
      host: new URL(BASE_URL).hostname,
      key: INDEXNOW_API_KEY,
      keyLocation: KEY_LOCATION,
      urlList: sitemapUrls,
    };

    // Submit to IndexNow
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(indexNowPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('IndexNow API error:', response.status, errorText);
      
      return NextResponse.json(
        { 
          error: 'Failed to submit URLs to IndexNow',
          status: response.status,
          details: errorText,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${sitemapUrls.length} URL(s) from sitemap to IndexNow`,
      urls: sitemapUrls,
    });
  } catch (error) {
    console.error('IndexNow submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

