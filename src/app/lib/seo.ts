import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
const SITE_NAME = 'SkinVault';
const DEFAULT_DESCRIPTION = 'SkinVault is the ultimate CS2 skin analytics and inventory management platform. Track your Steam inventory value in real-time, monitor skin prices with advanced analytics, set custom price alerts, compare skins side-by-side, and manage your wishlist. Get instant market prices, price history charts, and make informed trading decisions. Perfect for CS2 traders, collectors, and investors who want to maximize their skin portfolio value.';

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
      'CS2 skin value',
      'CS2 market prices',
      'CS2 price alerts',
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
    ],
  },
  inventory: {
    title: 'My Inventory - Track Your CS2 Skin Collection',
    description: 'View and manage your complete CS2 skin inventory. Track your collection value in real-time, see price changes, organize your skins, and get detailed analytics on your CS2 skin portfolio. Perfect for traders and collectors.',
    path: '/inventory',
    keywords: [
      'CS2 inventory',
      'CS2 skin collection',
      'Steam inventory tracker',
      'CS2 inventory value',
      'CS2 skin portfolio',
      'CS2 collection manager',
    ],
  },
  wishlist: {
    title: 'My Wishlist - Save Your Favorite CS2 Skins',
    description: 'Create and manage your CS2 skin wishlist. Save your favorite skins, track their prices, and get notified when prices drop. Never miss a deal on the CS2 skins you want.',
    path: '/wishlist',
    keywords: [
      'CS2 wishlist',
      'CS2 skin wishlist',
      'save CS2 skins',
      'CS2 price alerts',
      'CS2 skin favorites',
    ],
  },
  compare: {
    title: 'Compare CS2 Skins - Side-by-Side Skin Comparison',
    description: 'Compare CS2 skins side-by-side to make the best trading decisions. Compare prices, rarity, wear conditions, and market trends for any CS2 skin. Find the perfect skin for your collection.',
    path: '/compare',
    keywords: [
      'CS2 skin comparison',
      'compare CS2 skins',
      'CS2 skin prices',
      'CS2 trading tool',
      'CS2 skin analyzer',
    ],
  },
  pro: {
    title: 'Pro Subscription - Unlock Advanced CS2 Analytics',
    description: 'Upgrade to SkinVault Pro for advanced CS2 skin analytics, faster price scanning, unlimited wishlist items, price alerts, Discord integration, and exclusive features. Get the most out of your CS2 skin trading.',
    path: '/pro',
    keywords: [
      'CS2 skin analytics pro',
      'CS2 premium features',
      'CS2 trading tools',
      'CS2 price alerts',
      'CS2 pro subscription',
    ],
  },
  item: (itemName: string) => ({
    title: `${itemName} - CS2 Skin Price & Details`,
    description: `View detailed information, current prices, price history, and market trends for ${itemName}. Get real-time CS2 skin prices, compare wear conditions, and make informed trading decisions.`,
    path: `/item/${encodeURIComponent(itemName)}`,
    type: 'product' as const,
    keywords: [
      itemName,
      `${itemName} price`,
      `${itemName} CS2`,
      'CS2 skin price',
      'CS2 skin details',
    ],
  }),
};

