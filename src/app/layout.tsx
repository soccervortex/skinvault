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

config.autoAddCss = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
const SHORT_DESCRIPTION = 'Track CS2 skin prices, manage your Steam inventory, set price alerts, and analyze your portfolio value safely with our read-only tools.';

// --- 1. METADATA API (The Robot Cover) ---
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "SkinVaults - CS2 Inventory Tracker & Skin Valuation Tool",
    template: "%s | SkinVaults"
  },
  description: SHORT_DESCRIPTION,
  keywords: [
    'CS2 inventory tracker', 'CS2 skin valuation', 'Steam portfolio analytics', 
    'CS2 investment tool', 'skin price alerts', 'CS2 float checker'
  ],
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
  maximumScale: 1,
  userScalable: false,
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SkinVaults",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "description": SHORT_DESCRIPTION,
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    ...(ratingData && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": ratingData.rating.toFixed(1),
        "reviewCount": ratingData.count.toString()
      }
    })
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://raw.githubusercontent.com" crossOrigin="anonymous" />
        {/* Structured Data injected as a Script tag */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
