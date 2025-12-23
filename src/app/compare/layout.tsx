import { Metadata } from 'next';
import { generateSEOMetadata, pageSEO } from '../lib/seo';

export const metadata: Metadata = generateSEOMetadata(pageSEO.compare);

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

