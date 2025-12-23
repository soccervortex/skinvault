import { Metadata } from 'next';
import { generateMetadata, pageSEO } from '../lib/seo';

export const metadata: Metadata = generateMetadata(pageSEO.compare);

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

