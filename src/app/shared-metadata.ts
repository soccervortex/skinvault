import { Metadata } from 'next';

// 1. Define your base URL (Change this to your real domain)
const BASE_URL = 'https://skinvaults.online';

export const defaultMetadata: Metadata = {
  // 2. The Title Template: Adds "| SkinVaults" to every page automatically
  title: {
    template: '%s | SkinVaults',
    default: 'SkinVaults - CS2 Inventory Tracker & Valuation Tool',
  },
  // 3. The "Elevator Pitch" for Google
  description: 'The safest way to track your CS2 skins. Monitor daily price changes, analyze your portfolio value, and manage your investments without logging into trading sites.',
  
  // 4. Keywords: The "Tags" for your site
  keywords: ['CS2 Skins', 'Inventory Tracker', 'Steam Portfolio', 'Skin Valuation', 'CS2 Investment', 'Float Value Checker'],
  
  // 5. Authors & Creator info
  authors: [{ name: 'SkinVaults Team', url: BASE_URL }],
  creator: 'SkinVaults',
  
  // 6. Robots: Telling Google it's okay to read this
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // 7. Open Graph: How your link looks when shared on Discord/Twitter
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'SkinVaults',
    title: 'SkinVaults - Track Your CS2 Inventory Value',
    description: 'Stop guessing your inventory value. Get real-time analytics for your CS2 skins and investments.',
    images: [
      {
        url: `${BASE_URL}/icons/og-image.jpg`, // You need to add an image named og-image.jpg to your public folder!
        width: 1200,
        height: 630,
        alt: 'SkinVaults Dashboard Preview',
      },
    ],
  },

  // 8. Twitter Card: Specifically for X (formerly Twitter)
  twitter: {
    card: 'summary_large_image',
    title: 'SkinVaults - CS2 Inventory Analytics',
    description: 'Track your CS2 skin portfolio safely. Read-only access, real-time prices.',
    images: [`${BASE_URL}/icons/og-image.jpg`], // Same image as above
  },
  
  // 9. Icons: The tiny logo in the browser tab
  icons: {
    icon: '/icons/favicon.ico',
    shortcut: '/icons/favicon-16x16.png',
    apple: '/icons/apple-touch-icon.png',
  },
};
