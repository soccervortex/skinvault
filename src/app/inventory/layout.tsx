import { Metadata } from 'next';
import { generateSEOMetadata, pageSEO } from '../lib/seo';

export const metadata: Metadata = generateSEOMetadata(pageSEO.inventory);

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

