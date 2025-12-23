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
import InstallPrompt from "./components/InstallPrompt";
import ThemeProviderWrapper from "./components/ThemeProviderWrapper";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import ProExpirationWarning from "./components/ProExpirationWarning";
import NetworkStatus from "./components/NetworkStatus";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import ChunkErrorHandler from "./components/ChunkErrorHandler";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online'),
  title: "SkinVault - CS2 Skin Analytics & Inventory Management",
  description: "SkinVault is a comprehensive CS2 skin analytics platform that helps you track your inventory value, monitor skin prices, set price alerts, compare skins, and manage your wishlist. View your Steam inventory, get real-time market prices, track price changes, and make informed trading decisions.",
  icons: {
    icon: [
      { url: '/icons/favicon.ico', type: 'image/x-icon' },
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
    title: 'SkinVault',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  openGraph: {
    title: 'SkinVault - CS2 Skin Analytics & Inventory Management',
    description: 'Track your CS2 inventory value, monitor skin prices, set price alerts, compare skins, and manage your wishlist. Real-time market prices and comprehensive skin analytics for CS2 traders.',
    type: 'website',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online',
    siteName: 'SkinVault',
    images: [
      { 
        url: '/icons/web-app-manifest-512x512.png', 
        width: 512, 
        height: 512,
        alt: 'SkinVault - CS2 Skin Analytics',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SkinVault - CS2 Skin Analytics & Inventory Management',
    description: 'Track your CS2 inventory value, monitor skin prices, set price alerts, compare skins, and manage your wishlist.',
    images: ['/icons/web-app-manifest-512x512.png'],
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
    "name": "SkinVault",
    "description": "SkinVault is a comprehensive CS2 skin analytics platform that helps you track your inventory value, monitor skin prices, set price alerts, compare skins, and manage your wishlist. View your Steam inventory, get real-time market prices, track price changes, and make informed trading decisions.",
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
      "Steam Integration"
    ]
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
        {children}
            <ProExpirationWarning />
            <NetworkStatus />
        <InstallPrompt />
        <ThemeProviderWrapper />
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
