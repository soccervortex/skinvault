import { NextResponse } from 'next/server';
import { submitToIndexNow } from '@/app/utils/indexnow';
import { dbGet, dbSet } from '@/app/utils/database';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';

/**
 * Vercel Cron Job: Submit homepage and key pages to IndexNow
 * Runs daily to ensure Bing and other search engines are notified of updates
 * 
 * Cron schedule in vercel.json:
 * - "0 2 * * *" = 2:00 AM UTC (3:00 AM CET / 4:00 AM CEST) - Daily submission
 */
export async function GET(request: Request) {
  try {
    // Verify this is a cron request (Vercel sends a special header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[IndexNow Cron] Starting URL submission to IndexNow...');

    // Get URLs to submit (homepage + key pages)
    const urlsToSubmit = [
      BASE_URL, // Homepage
      `${BASE_URL}/shop`,
      `${BASE_URL}/inventory`,
      `${BASE_URL}/wishlist`,
      `${BASE_URL}/pro`,
      `${BASE_URL}/compare`,
      `${BASE_URL}/contact`,
      `${BASE_URL}/faq`,
    ];

    // Submit to IndexNow
    const result = await submitToIndexNow(urlsToSubmit);

    // Store last submission time
    await dbSet('indexnow_last_submission', {
      timestamp: new Date().toISOString(),
      submitted: result.submitted,
      skipped: result.skipped,
      success: result.success,
    });

    if (result.success) {
      console.log(`[IndexNow Cron] Successfully submitted ${result.submitted} URL(s) to IndexNow`);
      return NextResponse.json({
        success: true,
        message: `Submitted ${result.submitted} URL(s) to IndexNow`,
        submitted: result.submitted,
        skipped: result.skipped,
        urls: result.urls,
      });
    } else {
      console.error(`[IndexNow Cron] Failed to submit URLs: ${result.error}`);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          submitted: result.submitted,
          skipped: result.skipped,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[IndexNow Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

