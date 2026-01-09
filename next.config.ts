import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs';
import path from 'path';

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Optimize for modern browsers - reduce legacy JavaScript
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year cache for images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'community.akamai.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'community.cloudflare.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'steamcommunity.com',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
    ],
  },
  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Reduce legacy JavaScript - target modern browsers
  transpilePackages: [],
  // Turbopack configuration
    turbopack: {
    root: path.resolve(__dirname),
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Rewrites
  async rewrites() {
    return [
      {
        source: '/sitemap',
        destination: '/sitemap.xml',
      },
    ];
  },

  // Redirects for SEO canonicalization
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'skinvaults.online',
          },
        ],
        destination: 'https://www.skinvaults.online/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://www.skinvaults.online/:path*',
        permanent: true,
      },
    ];
  },
};

// Wrap with Sentry if DSN is configured
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // Sentry options
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      widenClientFileUpload: true,
      tunnelRoute: '/monitoring',
      automaticVercelMonitors: true,
    })
  : nextConfig;
