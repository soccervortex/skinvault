import { NextRequest, NextResponse } from 'next/server';

const INDEXNOW_API_KEY = '99982adb45e64fb7b2e24712db654185';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
const KEY_LOCATION = `${BASE_URL}/99982adb45e64fb7b2e24712db654185.txt`;

/**
 * GET /api/indexnow/verify
 * Verify IndexNow configuration and key file accessibility
 * 
 * This endpoint helps verify that:
 * 1. The key file is accessible
 * 2. The key matches what's configured
 * 3. IndexNow API is reachable
 */
export async function GET(request: NextRequest) {
  try {
    const checks = {
      keyFile: {
        accessible: false,
        url: KEY_LOCATION,
        content: null as string | null,
        error: null as string | null,
      },
      keyMatch: {
        matches: false,
        configured: INDEXNOW_API_KEY,
        fileContent: null as string | null,
      },
      apiReachable: {
        reachable: false,
        error: null as string | null,
      },
    };

    // Check 1: Verify key file is accessible
    try {
      const keyFileResponse = await fetch(KEY_LOCATION, {
        method: 'GET',
        headers: {
          'User-Agent': 'IndexNow-Verification/1.0',
        },
      });

      if (keyFileResponse.ok) {
        checks.keyFile.accessible = true;
        checks.keyFile.content = await keyFileResponse.text();
        checks.keyFile.content = checks.keyFile.content.trim();
      } else {
        checks.keyFile.error = `HTTP ${keyFileResponse.status}: ${keyFileResponse.statusText}`;
      }
    } catch (error) {
      checks.keyFile.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check 2: Verify key matches
    if (checks.keyFile.content) {
      checks.keyMatch.fileContent = checks.keyFile.content;
      checks.keyMatch.matches = checks.keyFile.content === INDEXNOW_API_KEY;
    }

    // Check 3: Verify IndexNow API is reachable (just a HEAD request)
    try {
      const apiResponse = await fetch('https://api.indexnow.org/IndexNow', {
        method: 'HEAD',
        headers: {
          'User-Agent': 'IndexNow-Verification/1.0',
        },
      });
      checks.apiReachable.reachable = apiResponse.status < 500; // Any 2xx, 3xx, or 4xx means API is reachable
    } catch (error) {
      checks.apiReachable.error = error instanceof Error ? error.message : 'Unknown error';
    }

    const allChecksPass = 
      checks.keyFile.accessible && 
      checks.keyMatch.matches && 
      checks.apiReachable.reachable;

    return NextResponse.json({
      success: allChecksPass,
      message: allChecksPass 
        ? 'All IndexNow checks passed!' 
        : 'Some IndexNow checks failed. See details below.',
      checks,
      configuration: {
        key: INDEXNOW_API_KEY,
        keyLocation: KEY_LOCATION,
        baseUrl: BASE_URL,
      },
      recommendations: !allChecksPass ? [
        !checks.keyFile.accessible && 'Key file is not accessible. Ensure it exists at the root of your public folder.',
        !checks.keyMatch.matches && 'Key file content does not match configured key. Update the key file.',
        !checks.apiReachable.reachable && 'IndexNow API is not reachable. Check your network connection.',
      ].filter(Boolean) : [],
    });
  } catch (error) {
    console.error('IndexNow verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

