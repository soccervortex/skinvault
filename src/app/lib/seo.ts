import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
const SITE_NAME = 'SkinVaults';
const DEFAULT_DESCRIPTION = 'Track CS2 skin prices, manage your Steam inventory, set price alerts, and compare skins. Real-time analytics for CS2 traders and collectors.';

export interface SEOConfig {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  keywords?: string[];
}

const DEFAULT_OG_IMAGE = '/icons/Open Graph Image.jpg';

export function generateSEOMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    path = '',
    image = DEFAULT_OG_IMAGE,
    type = 'website',
    noindex = false,
    keywords = [
      'CS2 skins',
      'CS2 skin tracker',
      'CS2 inventory',
      'CS2 price tracker',
      'Steam inventory',
      'CS2 skin analytics',
      'CS2 skin prices',
      'CS2 trading',
      'CS2 skin comparison',
      'CS2 wishlist',
      'Counter-Strike 2 skins',
      'Counter-Strike 2',
      'Counter-Strike',
      'CSGO 2',
      'CSGO',
      'CSGO 2 skins',
      'CSGO skins',
      'CS2 skin value',
      'CS2 market prices',
      'CS2 price alerts',
      'Skinvaults',
      'SkinVaults',
    ],
  } = config;

  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - CS2 Skin Analytics & Inventory Management`;
  const url = `${BASE_URL}${path}`;
  const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`;

  // Map 'product' type to 'website' for Next.js compatibility
  const ogType = type === 'product' ? 'website' : type;

  return {
    title: fullTitle,
    description,
    keywords: keywords.join(', '),
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    robots: noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    openGraph: {
      type: ogType,
      url,
      title: fullTitle,
      description,
      siteName: SITE_NAME,
      locale: 'en_US',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
        {
          url: `${BASE_URL}/icons/web-app-manifest-512x512.png`,
          width: 512,
          height: 512,
          alt: `${SITE_NAME} Logo`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
      creator: '@skinvault', // Update with your Twitter handle if you have one
    },
    alternates: {
      canonical: url,
    },
    other: {
      'googlebot': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      'bingbot': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      'slurp': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1', // Yahoo
    },
  };
}

// Pre-defined SEO configs for common pages
export const pageSEO = {
  home: {
    title: 'CS2 Skin Analytics & Inventory Management',
    description: DEFAULT_DESCRIPTION,
    path: '/',
    keywords: [
      'CS2 skins',
      'CS2 skin tracker',
      'CS2 inventory tracker',
      'CS2 price tracker',
      'Steam inventory',
      'CS2 skin analytics',
      'CS2 skin prices',
      'CS2 trading platform',
      'CS2 skins',
      'CS2 skin tracker',
      'CS2 inventory',
      'CS2 price tracker',
      'Steam inventory',
      'CS2 skin analytics',
      'CS2 skin prices',
      'CS2 trading',
      'CS2 skin comparison',
      'CS2 wishlist',
      'Counter-Strike 2 skins',
      'Counter-Strike 2',
      'Counter-Strike',
      'CSGO 2',
      'CSGO',
      'CSGO 2 skins',
      'CSGO skins',
      'CS2 skin value',
      'CS2 market prices',
      'CS2 price alerts',
      'Skinvaults',
      'SkinVaults',
    ],
  },
  inventory: {
    title: 'My Inventory - Track Your CS2 Skin Collection',
    description: 'View and manage your CS2 skin inventory. Track collection value, price changes, and get detailed analytics on your skin portfolio.',
    path: '/inventory',
    keywords: [
      'CS2 inventory',
      'CS2 skin collection',
      'Steam inventory tracker',
      'CS2 inventory value',
      'CS2 skin portfolio',
      'CS2 collection manager',
      'CS2 skins',
      'CS2 skin tracker',
      'CS2 inventory',
      'CS2 price tracker',
      'Steam inventory',
      'CS2 skin analytics',
      'CS2 skin prices',
      'CS2 trading',
      'CS2 skin comparison',
      'CS2 wishlist',
      'Counter-Strike 2 skins',
      'Counter-Strike 2',
      'Counter-Strike',
      'CSGO 2',
      'CSGO',
      'CSGO 2 skins',
      'CSGO skins',
      'CS2 skin value',
      'CS2 market prices',
      'CS2 price alerts',
      'Skinvaults',
      'SkinVaults',
    ],
  },
  wishlist: {
    title: 'My Wishlist - Save Your Favorite CS2 Skins',
    description: 'Create and manage your CS2 skin wishlist. Save favorite skins, track prices, and get notified when prices drop.',
    path: '/wishlist',
    keywords: [
      'CS2 wishlist',
      'CS2 skin wishlist',
      'save CS2 skins',
      'CS2 price alerts',
      'CS2 skin favorites',
      'CS2 skins',
      'CS2 skin tracker',
      'CS2 inventory',
      'CS2 price tracker',
      'Steam inventory',
      'CS2 skin analytics',
      'CS2 skin prices',
      'CS2 trading',
      'CS2 skin comparison',
      'CS2 wishlist',
      'Counter-Strike 2 skins',
      'Counter-Strike 2',
      'Counter-Strike',
      'CSGO 2',
      'CSGO',
      'CSGO 2 skins',
      'CSGO skins',
      'CS2 skin value',
      'CS2 market prices',
      'CS2 price alerts',
      'Skinvaults',
      'SkinVaults',
    ],
  },
  compare: {
    title: 'Compare CS2 Skins - Side-by-Side Skin Comparison',
    description: 'Compare CS2 skins side-by-side. Compare prices, rarity, wear conditions, and market trends to make better trading decisions.',
    path: '/compare',
    keywords: [
      'CS2 skin comparison',
      'compare CS2 skins',
      'CS2 skin prices',
      'CS2 trading tool',
      'CS2 skin analyzer',
      'CS2 skins',
      'CS2 skin tracker',
      'CS2 inventory',
      'CS2 price tracker',
      'Steam inventory',
      'CS2 skin analytics',
      'CS2 skin prices',
      'CS2 trading',
      'CS2 skin comparison',
      'CS2 wishlist',
      'Counter-Strike 2 skins',
      'Counter-Strike 2',
      'Counter-Strike',
      'CSGO 2',
      'CSGO',
      'CSGO 2 skins',
      'CSGO skins',
      'CS2 skin value',
      'CS2 market prices',
      'CS2 price alerts',
      'Skinvaults',
      'SkinVaults',
    ],
  },
  pro: {
    title: 'Pro Subscription - Unlock Advanced CS2 Analytics',
    description: 'Upgrade to SkinVaults Pro for advanced analytics, faster scanning, unlimited wishlist, price alerts, and Discord integration.',
    path: '/pro',
    keywords: [
      'CS2 skin analytics pro',
      'CS2 premium features',
      'CS2 trading tools',
      'CS2 price alerts',
      'CS2 pro subscription',
      'CS2 skins',
      'CS2 skin tracker',
      'CS2 inventory',
      'CS2 price tracker',
      'Steam inventory',
      'CS2 skin analytics',
      'CS2 skin prices',
      'CS2 trading',
      'CS2 skin comparison',
      'CS2 wishlist',
      'Counter-Strike 2 skins',
      'Counter-Strike 2',
      'Counter-Strike',
      'CSGO 2',
      'CSGO',
      'CSGO 2 skins',
      'CSGO skins',
      'CS2 skin value',
      'CS2 market prices',
      'CS2 price alerts',
      'Skinvaults',
      'SkinVaults',
    ],
  },
  item: (itemName: string) => {
    // Truncate title if too long
    // Bing recommends max 70 chars total, but we need to account for " | SkinVaults" suffix (13 chars)
    // So max title from here should be 57 chars (70 - 13)
    const suffix = ' - CS2 Skin Price'; // 18 chars
    const siteSuffix = ' | SkinVaults'; // 13 chars (added by generateSEOMetadata)
    const maxTotalLength = 70; // Bing's limit
    const maxTitleLength = maxTotalLength - siteSuffix.length; // 57 chars max for this part
    const maxItemNameLength = maxTitleLength - suffix.length; // 39 chars for item name (57 - 18)
    
    let baseTitle = itemName;
    if (itemName.length > maxItemNameLength) {
      baseTitle = `${itemName.substring(0, maxItemNameLength - 3)}...`;
    }
    const title = `${baseTitle}${suffix}`;
    
    // Truncate description if too long (max 160 chars for SEO)
    // Bing recommends 120-160 chars
    const baseDescription = `View prices, price history, and market trends for ${itemName}. Compare wear conditions and make informed CS2 trading decisions.`;
    const maxDescriptionLength = 160;
    const description = baseDescription.length > maxDescriptionLength
      ? `${baseDescription.substring(0, maxDescriptionLength - 3)}...`
      : baseDescription;
    
    return {
      title,
      description,
      path: `/item/${encodeURIComponent(itemName)}`,
      type: 'product' as const,
    keywords: [
      itemName,
      `${itemName} price`,
      `${itemName} CS2`,
      'CS2 skin price',
      'CS2 skin details',
      'CS2 skins',
      'CS2 skin tracker',
      'CS2 inventory',
      'CS2 price tracker',
      'Steam inventory',
      'CS2 skin analytics',
      'CS2 skin prices',
      'CS2 trading',
      'CS2 skin comparison',
      'CS2 wishlist',
      'Counter-Strike 2 skins',
      'Counter-Strike 2',
      'Counter-Strike',
      'CSGO 2',
      'CSGO',
      'CSGO 2 skins',
      'CSGO skins',
      'CS2 skin value',
      'CS2 market prices',
      'CS2 price alerts',
      'Skinvaults',
      'SkinVaults',
    ],
    };
  },
};

