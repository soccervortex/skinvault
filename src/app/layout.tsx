import type { Metadata, Viewport } from "next";
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
import BanChecker from "./components/BanChecker";
import VercelAnalytics from "./components/VercelAnalytics";
import GlobalErrorHandler from "./components/GlobalErrorHandler";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { SITE_CONFIG, ALL_KEYWORDS } from "@/lib/seo-config";

config.autoAddCss = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  // Preload is enabled by default in Next.js - this font is used on initial page load
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  adjustFontFallback: false, // Reduce font loading overhead
  // This font is only used on specific pages (admin, contact), not initial load
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || SITE_CONFIG.url;
const SHORT_DESCRIPTION = SITE_CONFIG.description;
const COMPREHENSIVE_DESCRIPTION = SITE_CONFIG.description;

// --- 1. METADATA API (The Robot Cover) ---
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: SITE_CONFIG.title,
    template: "%s | SkinVaults"
  },
  description: COMPREHENSIVE_DESCRIPTION,
  keywords: ALL_KEYWORDS,
  alternates: {
    canonical: BASE_URL,
  },
  authors: [{ name: 'SkinVaults' }],
  creator: 'SkinVaults',
  publisher: 'SkinVaults',
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
  other: {
    'bingbot': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'SkinVaults - CS2 Skin Analytics & Inventory Management',
    description: SHORT_DESCRIPTION,
    type: 'website',
    url: BASE_URL,
    siteName: 'SkinVaults',
    images: [{ url: `${BASE_URL}/icons/Open Graph Image.jpg`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SkinVaults - CS2 Inventory Analytics',
    description: SHORT_DESCRIPTION,
    images: [`${BASE_URL}/icons/Open Graph Image.jpg`],
  },
  verification: {
    google: 'googleb716dc02fc690049',
  },
};

// Viewport is now a separate export in newer Next.js versions
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#000000',
};

// --- 2. DATA FETCHING (The Rating Logic) ---
async function getHomePageRating() {
  try {
    const res = await fetch(`${BASE_URL}/api/reviews/aggregate`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.aggregateRating > 0) return { rating: data.aggregateRating, count: data.totalReviews };
    }
  } catch (e) { /* ignore */ }
  return null;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ratingData = await getHomePageRating();

  // --- 3. STRUCTURED DATA (The Advanced Secret whisper) ---
  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SkinVaults",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "description": COMPREHENSIVE_DESCRIPTION,
    "url": BASE_URL,
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    ...(ratingData && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": ratingData.rating.toFixed(1),
        "reviewCount": ratingData.count.toString()
      }
    })
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SkinVaults",
    "url": BASE_URL,
    "logo": `${BASE_URL}/icons/favicon.svg`,
    "description": COMPREHENSIVE_DESCRIPTION,
    "sameAs": []
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://raw.githubusercontent.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://steamcommunity.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://community.akamai.steamstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://community.cloudflare.steamstatic.com" />
        {/* Structured Data injected as Script tags */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:p-4 focus:bg-blue-600 focus:text-white">
          Skip to main content
        </a>
        
        <Script src="/safe-storage-init.js" strategy="afterInteractive" />
        
        <GlobalErrorHandler />
        <ErrorBoundary>
          <ToastProvider>
            <ChunkErrorHandler />
            <KeyboardShortcuts />
            <ChatNotificationListener />
            <GlobalChatService />
            <BanChecker />
            <main id="main-content">{children}</main>
            <ProExpirationWarning />
            <NetworkStatus />
            <ThemeProviderWrapper />
          </ToastProvider>
        </ErrorBoundary>
        <VercelAnalytics />
      </body>
    </html>
  );
}
