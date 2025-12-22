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
  title: "SkinVault",
  description: "Premium CS2 skin analytics and inventory management",
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
    title: 'SkinVault - CS2 Skin Analytics',
    description: 'Premium CS2 skin analytics and inventory management',
    type: 'website',
    images: [{ url: '/icons/web-app-manifest-512x512.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary',
    title: 'SkinVault - CS2 Skin Analytics',
    description: 'Premium CS2 skin analytics and inventory management',
    images: ['/icons/web-app-manifest-512x512.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          src="/safe-storage-init.js"
          strategy="beforeInteractive"
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
