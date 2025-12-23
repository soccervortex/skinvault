import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "./christmas-theme.css";
import "./halloween-theme.css";
import "./easter-theme.css";
import "./sinterklaas-theme.css";
import "./newyear-theme.css";
import "./oldyear-theme.css";
import ThemeProviderWrapper from "./components/ThemeProviderWrapper";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import ProExpirationWarning from "./components/ProExpirationWarning";
import NetworkStatus from "./components/NetworkStatus";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import ChunkErrorHandler from "./components/ChunkErrorHandler";
import ChatNotificationListener from "./components/ChatNotificationListener";
import GlobalChatService from "./components/GlobalChatService";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
const LONG_DESCRIPTION = 'SkinVaults is the ultimate CS2 skin analytics and inventory management platform. Track your Steam inventory value in real-time, monitor skin prices with advanced analytics, set custom price alerts, compare skins side-by-side, and manage your wishlist. Get instant market prices, price history charts, and make informed trading decisions. Perfect for CS2 traders, collectors, and investors who want to maximize their skin portfolio value. Features include real-time price tracking, inventory valuation, price alerts, skin comparison tools, wishlist management, and comprehensive market analytics.';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "SkinVaults - CS2 Skin Analytics & Inventory Management",
  description: LONG_DESCRIPTION,
  keywords: [
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
    'CS2 inventory management',
    'CS2 skin portfolio',
  ].join(', '),
  authors: [{ name: 'SkinVaults' }],
  creator: 'SkinVaults',
  publisher: 'SkinVaults',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  icons: {
    icon: [
      { url: '/icons/favicon.ico', type: 'image/x-icon', sizes: 'any' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
      { url: '/icons/web-app-manifest-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/web-app-manifest-512x512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: [
      { url: '/icons/favicon.ico', type: 'image/x-icon' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SkinVaults',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  openGraph: {
    title: 'SkinVaults - CS2 Skin Analytics & Inventory Management',
    description: LONG_DESCRIPTION,
    type: 'website',
    url: BASE_URL,
    siteName: 'SkinVaults',
    locale: 'en_US',
    images: [
      { 
        url: `${BASE_URL}/icons/Open Graph Image.jpg`, 
        width: 1200, 
        height: 630,
        alt: 'SkinVaults - CS2 Skin Analytics & Inventory Management',
      },
      { 
        url: `${BASE_URL}/icons/web-app-manifest-512x512.png`, 
        width: 512, 
        height: 512,
        alt: 'SkinVaults - CS2 Skin Analytics Logo',
      },
      {
        url: `${BASE_URL}/icons/web-app-manifest-192x192.png`,
        width: 192,
        height: 192,
        alt: 'SkinVaults Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SkinVaults - CS2 Skin Analytics & Inventory Management',
    description: LONG_DESCRIPTION,
    images: [`${BASE_URL}/icons/Open Graph Image.jpg`],
  },
  alternates: {
    canonical: BASE_URL,
  },
  other: {
    'googlebot': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    'bingbot': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    'slurp': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1', // Yahoo
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
  
  // Structured data for better SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "SkinVaults",
    "description": LONG_DESCRIPTION,
    "url": baseUrl,
    "applicationCategory": "GameApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "100"
    },
    "featureList": [
      "CS2 Inventory Tracking",
      "Real-time Skin Price Monitoring",
      "Price Alerts",
      "Skin Comparison Tool",
      "Wishlist Management",
      "Steam Integration",
      "Market Analytics",
      "Price History Charts",
      "Portfolio Valuation"
    ],
    "logo": {
      "@type": "ImageObject",
      "url": `${baseUrl}/icons/Open Graph Image.jpg`,
      "width": 1200,
      "height": 630
    },
    "image": {
      "@type": "ImageObject",
      "url": `${baseUrl}/icons/Open Graph Image.jpg`,
      "width": 1200,
      "height": 630
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          src="/safe-storage-init.js"
          strategy="beforeInteractive"
        />
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ErrorBoundary>
          <ToastProvider>
            <ChunkErrorHandler />
            <KeyboardShortcuts />
            <ChatNotificationListener />
            <GlobalChatService />
        {children}
            <ProExpirationWarning />
            <NetworkStatus />
        <ThemeProviderWrapper />
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
