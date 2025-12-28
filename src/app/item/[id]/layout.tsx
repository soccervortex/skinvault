import { Metadata } from 'next';
import Script from 'next/script';
import { generateSEOMetadata, pageSEO } from '../../lib/seo';
import { SITE_CONFIG } from '@/lib/seo-config';

// Fetch item info to get the actual name instead of technical ID
async function getItemInfo(itemId: string) {
  try {
    const API_FILES = ['skins_not_grouped.json', 'crates.json', 'stickers.json', 'agents.json'];
    const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
    
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
  };
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const itemInfo = await getItemInfo(decodedId);
  const itemName = itemInfo.name;
  
  return generateSEOMetadata({
    ...pageSEO.item(itemName),
    description: `Check the current price and market history for ${itemName} on SkinVaults. View real-time CS2 skin prices, price trends, and detailed analytics. The most accurate CS2 skin valuation tool.`,
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
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": itemInfo.name,
    "description": `CS2 skin: ${itemInfo.name}. Check current price, market history, and trading analytics on SkinVaults.`,
    "category": itemInfo.weapon || "CS2 Skin",
    "brand": {
      "@type": "Brand",
      "name": "Counter-Strike 2"
    },
    "offers": {
      "@type": "AggregateOffer",
      "availability": "https://schema.org/InStock",
      "priceCurrency": "EUR",
      "url": `${SITE_CONFIG.url}/item/${encodeURIComponent(decodedId)}`
    },
    ...(itemInfo.image && {
      "image": itemInfo.image
    })
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

