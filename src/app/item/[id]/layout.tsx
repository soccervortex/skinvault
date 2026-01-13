import { Metadata } from 'next';
import Script from 'next/script';
import { generateSEOMetadata, pageSEO } from '../../lib/seo';
import { SITE_CONFIG } from '@/lib/seo-config';

// Fetch item info to get the actual name instead of technical ID
// OPTIMIZED: Uses fast API endpoint instead of slow sequential file checking
async function getItemInfo(itemId: string) {
  try {
    // Use the optimized API endpoint which fetches in parallel
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.skinvaults.online';

    const wearStripped = String(itemId || '')
      .replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, '')
      .trim();

    const suffixStripped = (() => {
      const s = String(itemId || '').trim();
      const m = s.match(/^([a-z_]+-[a-z0-9]+)_\d{1,3}$/i);
      return m ? String(m[1]) : s;
    })();

    const candidates = Array.from(
      new Set(
        [
          String(itemId || '').trim(),
          suffixStripped,
          wearStripped,
        ].filter(Boolean) as string[]
      )
    );

    for (const c of candidates) {
      const apiUrl = `${baseUrl}/api/item/info?id=${encodeURIComponent(c)}&fuzzy=false`;
      const response = await fetch(apiUrl, {
        next: { revalidate: 3600 },
      });

      if (!response.ok) continue;
      const item = await response.json();

      if (item && (item.name || item.market_hash_name)) {
        return {
          name: item.name || item.market_hash_name || itemId,
          image: item.image || null,
          rarity: item.rarity?.name || item.rarity || null,
          weapon: item.weapon?.name || item.weapon || null,
          marketHashName: item.market_hash_name || item.name || itemId,
        };
      }
    }

    const apiUrl = `${baseUrl}/api/item/info?id=${encodeURIComponent(String(itemId || '').trim())}&fuzzy=true`;
    const response = await fetch(apiUrl, {
      next: { revalidate: 3600 },
    });

    if (response.ok) {
      const item = await response.json();
      if (item && (item.name || item.market_hash_name)) {
        return {
          name: item.name || item.market_hash_name || itemId,
          image: item.image || null,
          rarity: item.rarity?.name || item.rarity || null,
          weapon: item.weapon?.name || item.weapon || null,
          marketHashName: item.market_hash_name || item.name || itemId,
        };
      }
    }
  } catch (error) {
    console.error('Failed to fetch item info:', error);
  }
  
  // Fallback to decoded ID
  return {
    name: decodeURIComponent(itemId),
    image: null,
    rarity: null,
    weapon: null,
    marketHashName: decodeURIComponent(itemId),
  };
}

// Fetch price data from Steam API
async function getPriceData(marketHashName: string) {
  try {
    const hash = encodeURIComponent(marketHashName);
    const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=3&market_hash_name=${hash}`;
    
    const response = await fetch(steamUrl, { 
      next: { revalidate: 300 }, // Cache for 5 minutes
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.success) {
      // Parse prices - Steam returns strings like "€1,234.56" or "€ 3,48"
      const parsePrice = (priceStr: string): number | null => {
        if (!priceStr) return null;
        
        // Remove currency symbols and whitespace
        let clean = priceStr.replace(/[€$£¥]/g, '').trim();
        
        // Handle European format: "70.991,00" -> 70991.00 (wrong) should be 70.991
        // Handle US format: "70.99" -> 70.99
        if (clean.includes(',') && clean.includes('.')) {
          // European format: remove dots, replace comma with dot
          clean = clean.replace(/\./g, '').replace(',', '.');
        } else if (clean.includes(',')) {
          // Could be European "70,99" or US "70,991"
          // If comma is the last separator, it's likely European decimal
          const parts = clean.split(',');
          if (parts.length === 2 && parts[1].length <= 2) {
            // Likely "70,99" format
            clean = clean.replace(',', '.');
          } else {
            // Likely "70,991" format (US thousand separator)
            clean = clean.replace(/,/g, '');
          }
        }
        
        const num = parseFloat(clean);
        return isNaN(num) ? null : num;
      };

      const lowestPrice = parsePrice(data.lowest_price);
      const medianPrice = parsePrice(data.median_price);
      
      // Estimate high price as 1.5x median (typical market spread)
      const highPrice = medianPrice ? Math.round(medianPrice * 1.5 * 100) / 100 : null;
      
      // Estimate offer count from volume (if available)
      let offerCount: number | undefined = undefined;
      if (data.volume) {
        // Volume is usually a string like "1,234" or "Low"
        const volumeStr = data.volume.toString().replace(/,/g, '');
        const volumeNum = parseInt(volumeStr);
        if (!isNaN(volumeNum)) {
          offerCount = volumeNum;
        }
      }

      return {
        lowPrice: lowestPrice || medianPrice || undefined,
        highPrice: highPrice || undefined,
        offerCount: offerCount,
        medianPrice: medianPrice || undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch price data:', error);
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const itemInfo = await getItemInfo(decodedId);
  const itemName = itemInfo.name;
  
  // Use the actual ID from URL params for canonical URL, not the item name
  const actualPath = `/item/${id}`;
  
  // Create description with proper truncation (max 160 chars for SEO)
  const baseDescription = `Check the current price and market history for ${itemName} on SkinVaults. View real-time CS2 skin prices, price trends, and detailed analytics.`;
  const maxDescriptionLength = 160;
  const description = baseDescription.length > maxDescriptionLength
    ? `${baseDescription.substring(0, maxDescriptionLength - 3)}...`
    : baseDescription;
  
  return generateSEOMetadata({
    ...pageSEO.item(itemName),
    path: actualPath, // Override path to use actual ID instead of encoded name
    description, // Use truncated description
    image: itemInfo.image || undefined,
  });
}

export default async function ItemLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const itemInfo = await getItemInfo(decodedId);
  
  // Product structured data for better Google search results
  const productSchema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": itemInfo.name,
    "description": `CS2 skin: ${itemInfo.name}. Check current price, market history, and trading analytics on SkinVaults.`,
    "category": itemInfo.weapon || "CS2 Skin",
    "brand": {
      "@type": "Brand",
      "name": "Counter-Strike 2"
    },
  };
  
  // Add image if available
  if (itemInfo.image) {
    productSchema.image = itemInfo.image;
  }
  
  // Add aggregateRating (optional but recommended)
  // Using a default rating based on rarity/quality
  const rarityRatings: { [key: string]: number } = {
    'Covert': 5.0,
    'Extraordinary': 5.0,
    'Classified': 4.5,
    'Restricted': 4.0,
    'Mil-Spec Grade': 3.5,
    'Mil-Spec': 3.5,
    'Industrial Grade': 3.0,
    'Industrial': 3.0,
    'Consumer Grade': 2.5,
    'Consumer': 2.5,
    'Base Grade': 2.0,
    'Base': 2.0,
  };
  
  const defaultRating = rarityRatings[itemInfo.rarity || ''] || 3.5;
  productSchema.aggregateRating = {
    "@type": "AggregateRating",
    "ratingValue": defaultRating.toString(),
    "reviewCount": "1",
    "bestRating": "5",
    "worstRating": "1"
  };
  
  // Add review (optional but recommended)
  productSchema.review = {
    "@type": "Review",
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": defaultRating.toString(),
      "bestRating": "5",
      "worstRating": "1"
    },
    "author": {
      "@type": "Organization",
      "name": "SkinVaults"
    },
    "reviewBody": `Professional CS2 skin analytics and price tracking for ${itemInfo.name}. Real-time market data and trading insights.`
  };
  
  // BreadcrumbList schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": SITE_CONFIG.url
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Market",
        "item": `${SITE_CONFIG.url}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": itemInfo.name,
        "item": `${SITE_CONFIG.url}/item/${encodeURIComponent(decodedId)}`
      }
    ]
  };

  return (
    <>
      <Script
        id="product-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}

