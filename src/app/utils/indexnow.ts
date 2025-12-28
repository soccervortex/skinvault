/**
 * IndexNow Utility Functions
 * 
 * Submit URLs to IndexNow API for real-time search engine indexing.
 * IndexNow is supported by Bing, Yandex, and other search engines.
 * 
 * @see https://www.indexnow.org/documentation
 */

const INDEXNOW_API_KEY = '99982adb45e64fb7b2e24712db654185';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
const KEY_LOCATION = `${BASE_URL}/99982adb45e64fb7b2e24712db654185.txt`;

export interface IndexNowResult {
  success: boolean;
  submitted: number;
  skipped: number;
  urls: string[];
  error?: string;
}

/**
 * Submit URLs to IndexNow API
 * 
 * @param urls - Array of full URLs to submit (must belong to the same domain)
 * @returns Promise with submission result
 * 
 * @example
 * ```ts
 * const result = await submitToIndexNow([
 *   'https://skinvaults.online/item/ak47-redline',
 *   'https://skinvaults.online/item/m4a4-asimov'
 * ]);
 * ```
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  if (!urls || urls.length === 0) {
    return {
      success: false,
      submitted: 0,
      skipped: 0,
      urls: [],
      error: 'URLs array is required and must not be empty',
    };
  }

  // Validate URLs belong to our domain
  const validUrls = urls.filter((url) => {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(BASE_URL);
      return urlObj.hostname === baseUrlObj.hostname;
    } catch {
      return false;
    }
  });

  if (validUrls.length === 0) {
    return {
      success: false,
      submitted: 0,
      skipped: urls.length,
      urls: [],
      error: 'All URLs must belong to the same host as the base URL',
    };
  }

  // Prepare IndexNow request
  const indexNowPayload = {
    host: new URL(BASE_URL).hostname,
    key: INDEXNOW_API_KEY,
    keyLocation: KEY_LOCATION,
    urlList: validUrls,
  };

  try {
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
      
      return {
        success: false,
        submitted: 0,
        skipped: validUrls.length,
        urls: validUrls,
        error: `IndexNow API returned ${response.status}: ${errorText}`,
      };
    }

    return {
      success: true,
      submitted: validUrls.length,
      skipped: urls.length - validUrls.length,
      urls: validUrls,
    };
  } catch (error) {
    console.error('IndexNow submission error:', error);
    return {
      success: false,
      submitted: 0,
      skipped: validUrls.length,
      urls: validUrls,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Submit a single URL to IndexNow
 * 
 * @param url - Full URL to submit
 * @returns Promise with submission result
 * 
 * @example
 * ```ts
 * await submitUrlToIndexNow('https://skinvaults.online/item/ak47-redline');
 * ```
 */
export async function submitUrlToIndexNow(url: string): Promise<IndexNowResult> {
  return submitToIndexNow([url]);
}

/**
 * Submit item page URL to IndexNow
 * 
 * @param itemId - Item ID or market hash name
 * @returns Promise with submission result
 * 
 * @example
 * ```ts
 * await submitItemToIndexNow('ak47-redline');
 * ```
 */
export async function submitItemToIndexNow(itemId: string): Promise<IndexNowResult> {
  const url = `${BASE_URL}/item/${encodeURIComponent(itemId)}`;
  return submitUrlToIndexNow(url);
}

/**
 * Submit multiple item page URLs to IndexNow
 * 
 * @param itemIds - Array of item IDs or market hash names
 * @returns Promise with submission result
 * 
 * @example
 * ```ts
 * await submitItemsToIndexNow(['ak47-redline', 'm4a4-asimov']);
 * ```
 */
export async function submitItemsToIndexNow(itemIds: string[]): Promise<IndexNowResult> {
  const urls = itemIds.map((id) => `${BASE_URL}/item/${encodeURIComponent(id)}`);
  return submitToIndexNow(urls);
}

/**
 * Submit URL via internal API route (useful for client-side calls)
 * This calls the /api/indexnow endpoint which handles the submission
 * 
 * @param urls - Array of URLs to submit
 * @returns Promise with submission result
 */
export async function submitToIndexNowViaAPI(urls: string[]): Promise<IndexNowResult> {
  try {
    const response = await fetch('/api/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        submitted: 0,
        skipped: urls.length,
        urls: [],
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: data.success || false,
      submitted: data.submitted || 0,
      skipped: data.skipped || 0,
      urls: data.urls || [],
    };
  } catch (error) {
    console.error('IndexNow API call error:', error);
    return {
      success: false,
      submitted: 0,
      skipped: urls.length,
      urls: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

