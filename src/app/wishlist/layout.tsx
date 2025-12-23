import { Metadata } from 'next';
import { generateSEOMetadata, pageSEO } from '../lib/seo';

export const metadata: Metadata = generateSEOMetadata(pageSEO.wishlist);

export default function WishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

