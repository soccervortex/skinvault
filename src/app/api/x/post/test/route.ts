import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { dbGet } from '@/app/utils/database';
import crypto from 'crypto';

// POST: Create test post (weapon with image)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminSteamId } = body;

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if X posting is enabled
    const enabled = (await dbGet<boolean>('x_posting_enabled')) || false;
    if (!enabled) {
      return NextResponse.json({ error: 'X posting is not enabled' }, { status: 400 });
    }

    // Get an item from all datasets (weapons, skins, stickers, agents, crates)
    const item = await getItemFromAllDatasets();
    
    if (!item) {
      return NextResponse.json(
        { error: 'Failed to fetch item from dataset' },
        { status: 500 }
      );
    }

    // Get real price from Steam API
    let price = 'Check price';
    if (item.marketHashName) {
      try {
        const hash = encodeURIComponent(item.marketHashName);
        const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=3&market_hash_name=${hash}&t=${Date.now()}`;
        const priceResponse = await fetch(steamUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          if (priceData.success && priceData.lowest_price) {
            const priceNum = priceData.lowest_price.replace(/[^\d,.]/g, '').replace(',', '.');
            price = `€${priceNum}`;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch price:', e);
      }
    }

    // Create item page URL
    const itemPageUrl = `https://www.skinvaults.online/item/${encodeURIComponent(item.id || item.marketHashName || item.name)}`;
    
    // Create post with image
    const postResult = await createXPost({
      name: item.name,
      imageUrl: item.imageUrl,
      price: price,
      itemPageUrl: itemPageUrl,
      type: item.type,
    });

    if (postResult.success) {
      // Update last post timestamp
      const { dbSet } = await import('@/app/utils/database');
      await dbSet('x_posting_last_post', new Date().toISOString());
      
      return NextResponse.json({
        success: true,
        message: 'Test post created successfully',
        postId: postResult.postId,
        itemName: item.name,
        itemType: item.type,
        hasImage: !!item.imageUrl,
      });
    } else {
      return NextResponse.json(
        { error: postResult.error || 'Failed to create post' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Failed to create test post:', error);
    return NextResponse.json(
      { error: 'Failed to create test post' },
      { status: 500 }
    );
  }
}

/**
 * Get an item from ALL CS2 datasets (weapons, skins, stickers, agents, crates)
 * Same logic as automated posting - can pick anything from the game
 */
async function getItemFromAllDatasets(): Promise<{ 
  id: string; 
  name: string; 
  marketHashName: string; 
  imageUrl: string; 
  type: string;
} | null> {
  try {
    const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
    const datasets = [
      { url: `${BASE_URL}/skins_not_grouped.json`, type: 'skin' },
      { url: `${BASE_URL}/stickers.json`, type: 'sticker' },
      { url: `${BASE_URL}/agents.json`, type: 'agent' },
      { url: `${BASE_URL}/crates.json`, type: 'crate' },
    ];

    // Fetch all datasets
    const allItems: any[] = [];
    for (const dataset of datasets) {
      try {
        const response = await fetch(dataset.url, { 
          next: { revalidate: 3600 }, // Cache for 1 hour
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        
        // Add type to each item
        items.forEach((item: any) => {
          allItems.push({
            ...item,
            type: dataset.type,
            id: item.id || item.market_hash_name || item.name,
            name: item.market_hash_name || item.name || 'Unknown',
            marketHashName: item.market_hash_name || item.name || '',
            imageUrl: item.image || item.icon_url || item.image_url || '',
          });
        });
      } catch (error) {
        console.error(`Failed to fetch ${dataset.type} dataset:`, error);
      }
    }

    if (allItems.length === 0) {
      console.error('No items found in any dataset');
      return null;
    }

    // Pick a random item from all available items
    // You could also implement smart selection here (e.g., prioritize rare items)
    const randomItem = allItems[Math.floor(Math.random() * allItems.length)];

    return {
      id: randomItem.id || randomItem.market_hash_name || randomItem.name,
      name: randomItem.market_hash_name || randomItem.name || 'Unknown',
      marketHashName: randomItem.market_hash_name || randomItem.name || '',
      imageUrl: randomItem.image || randomItem.icon_url || randomItem.image_url || '',
      type: randomItem.type || 'skin',
    };
  } catch (error) {
    console.error('Failed to fetch item datasets:', error);
    return null;
  }
}

// OAuth 1.0a signature generation
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // Create parameter string
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  return signature;
}

// Generate OAuth 1.0a authorization header
function generateOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_version: '1.0',
  };

  // Generate signature (only OAuth parameters, not body)
  const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);
  oauthParams.oauth_signature = signature;

  // Build authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return authHeader;
}

async function createXPost(item: { 
  name: string; 
  imageUrl: string; 
  price: string; 
  itemPageUrl: string;
  type?: string;
}) {
  try {
    // X API v2 requires OAuth 1.0a User Context for automated posting
    // Note: OAuth 2.0 Client ID/Secret are for different flows (user authorization)
    // For automated bots, we use OAuth 1.0a with API Key/Secret + Access Token/Secret
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET || process.env.X_APISECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    console.log('[X Post] Checking credentials...', {
      hasApiKey: !!X_API_KEY,
      hasApiSecret: !!X_API_SECRET,
      hasAccessToken: !!X_ACCESS_TOKEN,
      hasAccessTokenSecret: !!X_ACCESS_TOKEN_SECRET,
    });

    // Check if we have all required OAuth 1.0a credentials
    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
      const missing = [];
      if (!X_API_KEY) missing.push('X_API_KEY');
      if (!X_API_SECRET) missing.push('X_API_SECRET');
      if (!X_ACCESS_TOKEN) missing.push('X_ACCESS_TOKEN');
      if (!X_ACCESS_TOKEN_SECRET) missing.push('X_ACCESS_TOKEN_SECRET');
      
      const errorMsg = `Missing required OAuth 1.0a credentials: ${missing.join(', ')}. Please set all four: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET in environment variables.`;
      console.error('[X Post]', errorMsg);
      return { success: false, error: errorMsg };
    }

    // Create post text with item page link (280 char limit for X)
    const itemTypeEmoji = item.type === 'sticker' ? '🏷️' : item.type === 'agent' ? '👤' : item.type === 'crate' ? '📦' : '🎮';
    const postText = `${itemTypeEmoji} ${item.name}\n\n💰 Price: ${item.price}\n\n🔗 View details: ${item.itemPageUrl}\n\nTrack your CS2 inventory:\nskinvaults.online\n\n#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;

    console.log('[X Post] Attempting to post with OAuth 1.0a:', postText.substring(0, 50) + '...');
    console.log('[X Post] Item type:', item.type, 'Image URL:', item.imageUrl ? 'Yes' : 'No');

    // Upload image first if available
    let mediaId: string | null = null;
    if (item.imageUrl) {
      try {
        console.log('[X Post] Uploading image from:', item.imageUrl);
        mediaId = await uploadImageToX(item.imageUrl, X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET);
        if (!mediaId) {
          console.warn('[X Post] Failed to upload image, posting without image');
        } else {
          console.log('[X Post] Image uploaded successfully, media_id:', mediaId);
        }
      } catch (error) {
        console.warn('[X Post] Image upload error:', error);
        // Continue without image
      }
    } else {
      console.log('[X Post] No image URL available for this item');
    }

    const url = 'https://api.x.com/2/tweets';
    const body: any = {
      text: postText.substring(0, 280), // Ensure within limit
    };

    // Add media if uploaded successfully
    if (mediaId) {
      body.media = { media_ids: [mediaId] };
    }

    // Generate OAuth 1.0a authorization header
    const authHeader = generateOAuthHeader(
      'POST',
      url,
      X_API_KEY,
      X_API_SECRET,
      X_ACCESS_TOKEN,
      X_ACCESS_TOKEN_SECRET
    );

    const postResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await postResponse.text();
    console.log('[X Post] Response status:', postResponse.status);
    console.log('[X Post] Response body:', responseText);

    if (!postResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { detail: responseText || 'Unknown error' };
      }
      console.error('[X Post] API error response:', errorData);
      const errorMsg = errorData.detail || errorData.title || errorData.message || `HTTP ${postResponse.status}: Failed to post to X`;
      return { success: false, error: errorMsg };
    }

    const data = JSON.parse(responseText);
    console.log('[X Post] Success! Post ID:', data.data?.id);
    return { success: true, postId: data.data?.id };
  } catch (error: any) {
    console.error('[X Post] Exception:', error);
    return { success: false, error: error.message || 'Failed to create X post' };
  }
}

/**
 * Upload image to X API and return media_id
 * Uses X API v1.1 media/upload endpoint with OAuth 1.0a
 */
async function uploadImageToX(
  imageUrl: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<string | null> {
  try {
    console.log('[X Image Upload] Downloading image from:', imageUrl);
    
    // Download image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.error('[X Image Upload] Failed to download image:', imageResponse.status);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = Buffer.from(imageBuffer);
    
    // Determine content type
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    console.log('[X Image Upload] Image downloaded, size:', imageBytes.length, 'bytes, type:', contentType);

    // X API v1.1 media upload endpoint
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    
    // Generate multipart boundary
    const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;
    
    // Create multipart form data with binary image
    const CRLF = '\r\n';
    const formParts: Buffer[] = [];
    
    // Add media field header
    formParts.push(Buffer.from(`--${boundary}${CRLF}`));
    formParts.push(Buffer.from(`Content-Disposition: form-data; name="media"; filename="image.${contentType.split('/')[1] || 'png'}"${CRLF}`));
    formParts.push(Buffer.from(`Content-Type: ${contentType}${CRLF}`));
    formParts.push(Buffer.from(CRLF));
    
    // Add binary image data
    formParts.push(imageBytes);
    
    // Add closing boundary
    formParts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));
    
    const multipartBuffer = Buffer.concat(formParts);

    // Generate OAuth 1.0a signature
    // For multipart requests, we only sign the OAuth parameters, not the body
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: apiKey,
      oauth_token: accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_version: '1.0',
    };

    // Generate signature (only OAuth parameters, not multipart body)
    const sortedParams = Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
      .join('&');

    const signatureBaseString = [
      'POST',
      encodeURIComponent(uploadUrl),
      encodeURIComponent(sortedParams),
    ].join('&');

    const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
    const signature = crypto.createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    oauthParams.oauth_signature = signature;

    // Build authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    // Upload media
    console.log('[X Image Upload] Uploading to X API...');
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBuffer,
    });

    const responseText = await uploadResponse.text();
    console.log('[X Image Upload] Upload response status:', uploadResponse.status);

    if (!uploadResponse.ok) {
      console.error('[X Image Upload] Upload failed:', responseText);
      return null;
    }

    let uploadData;
    try {
      uploadData = JSON.parse(responseText);
    } catch {
      console.error('[X Image Upload] Failed to parse response:', responseText);
      return null;
    }

    const mediaId = uploadData.media_id_string || uploadData.media_id;
    if (mediaId) {
      console.log('[X Image Upload] Success! Media ID:', mediaId);
      return mediaId.toString();
    }

    console.error('[X Image Upload] No media_id in response:', uploadData);
    return null;
  } catch (error: any) {
    console.error('[X Image Upload] Error:', error);
    return null;
  }
}

