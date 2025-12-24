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
import BanChecker from "./components/BanChecker";
import VercelAnalytics from "./components/VercelAnalytics";
import GlobalErrorHandler from "./components/GlobalErrorHandler";

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
const SHORT_DESCRIPTION = 'Track CS2 skin prices, manage your Steam inventory, set price alerts, and compare skins. Real-time analytics for CS2 traders and collectors.';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "SkinVaults - CS2 Skin Analytics & Inventory Management",
  description: SHORT_DESCRIPTION,
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
      // Google Search requires favicons to be multiples of 48px
      // All required sizes are now present: 48x48, 96x96, 144x144, 192x192, 240x240, 288x288, 384x384, 480x480
      { url: '/icons/favicon-48x48.png', type: 'image/png', sizes: '48x48' },
      { url: '/icons/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
      { url: '/icons/favicon-144x144.png', type: 'image/png', sizes: '144x144' },
      { url: '/icons/web-app-manifest-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/favicon-240x240.png', type: 'image/png', sizes: '240x240' },
      { url: '/icons/favicon-288x288.png', type: 'image/png', sizes: '288x288' },
      { url: '/icons/favicon-384x384.png', type: 'image/png', sizes: '384x384' },
      { url: '/icons/favicon-480x480.png', type: 'image/png', sizes: '480x480' },
    ],
    shortcut: [
      { url: '/icons/favicon.ico', type: 'image/x-icon' },
    ],
    apple: [
      // Note: 180x180 is not a multiple of 48, but required for iOS
      // iOS handles this separately from Google Search favicons
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
    description: SHORT_DESCRIPTION,
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
    description: SHORT_DESCRIPTION,
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
  // Performance optimizations
  verification: {
    google: 'googleb716dc02fc690049',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
  
  // Comprehensive structured data for GEO (Generative Engine Optimization)
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SkinVaults",
    "url": baseUrl,
    "logo": {
      "@type": "ImageObject",
      "url": `${baseUrl}/icons/Open Graph Image.jpg`,
      "width": 1200,
      "height": 630
    },
    "description": "Legitimate CS2 skin analytics and inventory management tool. Read-only analytics service - NOT a trading platform or gambling site.",
    "sameAs": [
      // Add social media links when available
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Support",
      "url": `${baseUrl}/contact`
    }
  };

  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SkinVaults",
    "description": SHORT_DESCRIPTION,
    "url": baseUrl,
    "applicationCategory": "GameApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "100",
      "bestRating": "5",
      "worstRating": "1"
    },
    "featureList": [
      "CS2 Inventory Tracking",
      "Real-time Skin Price Monitoring",
      "Price Alerts",
      "Skin Comparison Tool",
      "Wishlist Management",
      "Steam OpenID Authentication",
      "Market Analytics",
      "Price History Charts",
      "Portfolio Valuation",
      "Faceit Statistics Integration"
    ],
    "screenshot": {
      "@type": "ImageObject",
      "url": `${baseUrl}/icons/Open Graph Image.jpg`,
      "width": 1200,
      "height": 630
    },
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
    },
    "author": {
      "@type": "Organization",
      "name": "SkinVaults"
    },
    "publisher": {
      "@type": "Organization",
      "name": "SkinVaults",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/icons/Open Graph Image.jpg`
      }
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is SkinVaults safe?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, SkinVaults is completely safe. We use official Steam OpenID for authentication, which is the same secure system used by legitimate Steam partners. SkinVaults only reads your public inventory data - we never modify, transfer, or access your Steam account. We are a read-only analytics tool, not a trading platform."
        }
      },
      {
        "@type": "Question",
        "name": "How does the Steam login work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "SkinVaults uses official Steam OpenID for authentication. When you click 'Sign in with Steam', you are redirected to Steam's official website to log in. After authentication, Steam provides us with a secure token that allows us to read your public inventory data. We never see or store your Steam password."
        }
      },
      {
        "@type": "Question",
        "name": "Does SkinVaults buy or sell skins?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No, SkinVaults does NOT buy or sell skins. We are purely an analytics and inventory management tool. We do not facilitate trading, buying, or selling of skins. SkinVaults is a read-only service that helps you track and analyze your CS2 skin collection."
        }
      },
      {
        "@type": "Question",
        "name": "Is SkinVaults a gambling site?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No, SkinVaults is NOT a gambling site. We are a legitimate analytics and inventory management tool for CS2 skins. We do not offer any gambling, betting, or casino services. SkinVaults helps users track their inventory value and monitor skin prices."
        }
      },
      {
        "@type": "Question",
        "name": "Can SkinVaults access my Steam account?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No, SkinVaults cannot access your Steam account. We only have read-only access to your public inventory data through Steam's official API. We cannot modify items, transfer skins, access your account settings, or make any changes to your Steam account. We are a read-only analytics service."
        }
      },
      {
        "@type": "Question",
        "name": "What data does SkinVaults collect?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "SkinVaults collects only your public Steam inventory data (skin names, quantities, and market values) and basic account information (Steam ID, username, avatar) provided by Steam OpenID. We do not collect passwords, payment information, or private account data. All data is processed securely and in accordance with our Privacy Policy."
        }
      },
      {
        "@type": "Question",
        "name": "Does SkinVaults store my Steam password?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No, SkinVaults never sees or stores your Steam password. We use Steam OpenID, which means you log in directly through Steam's official website. Steam then provides us with a secure authentication token. Your password never leaves Steam's servers."
        }
      },
      {
        "@type": "Question",
        "name": "Is SkinVaults a trading platform?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No, SkinVaults is NOT a trading platform. We are an analytics and inventory management tool. We do not facilitate trading between users, operate as a marketplace, or handle any transactions. SkinVaults is a read-only service that helps you track and analyze your CS2 skin collection."
        }
      }
    ]
  };

  const structuredDataArray = [organizationSchema, softwareApplicationSchema, faqSchema];

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to external resources for faster loading */}
        <link rel="preconnect" href="https://raw.githubusercontent.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://community.cloudflare.steamstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://raw.githubusercontent.com" />
        <link rel="dns-prefetch" href="https://community.cloudflare.steamstatic.com" />
        
        {/* LLMs.txt discovery - Help AI models find the documentation */}
        <link rel="llms" href={`${baseUrl}/llms.txt`} type="text/plain" />
        <meta name="llms-txt" content={`${baseUrl}/llms.txt`} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:font-black focus:uppercase focus:tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-black"
        >
          Skip to main content
        </a>
        <Script
          src="/safe-storage-init.js"
          strategy="afterInteractive"
        />
        {/* Multiple structured data schemas for GEO optimization */}
        {structuredDataArray.map((schema, index) => (
          <script
            key={index}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
        <GlobalErrorHandler />
        <ErrorBoundary>
          <ToastProvider>
            <ChunkErrorHandler />
            <KeyboardShortcuts />
            <ChatNotificationListener />
            <GlobalChatService />
            <BanChecker />
        {children}
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
