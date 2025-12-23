import { Metadata } from 'next';
import { generateMetadata, pageSEO } from '../lib/seo';

export const metadata: Metadata = generateMetadata(pageSEO.wishlist);

export default function WishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

