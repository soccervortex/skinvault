import { Metadata } from 'next';
import { generateSEOMetadata, pageSEO } from '../lib/seo';

export const metadata: Metadata = generateSEOMetadata(pageSEO.pro);

export default function ProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

