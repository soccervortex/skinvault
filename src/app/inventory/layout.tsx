import { Metadata } from 'next';
import { generateMetadata, pageSEO } from '../lib/seo';

export const metadata: Metadata = generateMetadata(pageSEO.inventory);

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

