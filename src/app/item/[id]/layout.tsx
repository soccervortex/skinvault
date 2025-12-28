import { Metadata } from 'next';
import Script from 'next/script';
import { generateSEOMetadata, pageSEO } from '../../lib/seo';
import { SITE_CONFIG } from '@/lib/seo-config';

// Fetch item info to get the actual name instead of technical ID
async function getItemInfo(itemId: string) {
  try {
    // First check custom items
    try {
      const { getDatabase } = await import('@/app/utils/mongodb-client');
      const db = await getDatabase();
      const customItem = await db.collection('custom_items').findOne({
        $or: [
          { id: itemId },
          { marketHashName: itemId },
          { name: itemId },
        ]
      });
      
      if (customItem) {
        return {
          name: customItem.name,
          image: customItem.image || null,
          rarity: customItem.rarity || null,
          weapon: customItem.weapon || null,
          marketHashName: customItem.marketHashName || customItem.name,
        };
      }
    } catch (customError) {
      // Continue to API check if custom items fail
    }

    // Then check API
    const { API_FILES, BASE_URL } = await import('@/data/api-endpoints');
    
    for (const file of API_FILES) {
      try {
        const response = await fetch(`${BASE_URL}/${file}`, { 
          next: { revalidate: 3600 } // Cache for 1 hour
        });
        if (!response.ok) continue;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        
        const item = items.find((i: any) => 
          i.id === itemId || 
          i.market_hash_name === itemId || 
          i.name === itemId
        );
        
        if (item) {
          return {
            name: item.market_hash_name || item.name || itemId,
            image: item.image || item.image_inventory || item.image_large || null,
            rarity: item.rarity?.name || null,
            weapon: item.weapon?.name || null,
            marketHashName: item.market_hash_name || item.name || itemId,
          };
        }
      } catch (error) {
        continue;
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
      // Parse prices - Steam returns strings like "€1,234.56"
      const parsePrice = (priceStr: string): number | null => {
        if (!priceStr) return null;
        // Remove currency symbols and spaces, replace comma with dot
        const cleaned = priceStr.replace(/[€$£¥,\s]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
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
  
  // Fetch price data for schema
  const priceData = await getPriceData(itemInfo.marketHashName);
  
  // Build AggregateOffer with price data
  const aggregateOffer: any = {
    "@type": "AggregateOffer",
    "availability": "https://schema.org/InStock",
    "priceCurrency": "EUR",
    "url": `${SITE_CONFIG.url}/item/${encodeURIComponent(decodedId)}`
  };
  
  if (priceData?.lowPrice) {
    aggregateOffer.lowPrice = priceData.lowPrice.toString();
  }
  
  if (priceData?.highPrice) {
    aggregateOffer.highPrice = priceData.highPrice.toString();
  }
  
  if (priceData?.offerCount !== undefined) {
    aggregateOffer.offerCount = priceData.offerCount;
  }
  
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
    "offers": aggregateOffer,
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

