import { Metadata } from 'next';
import { generateMetadata, pageSEO } from '../lib/seo';

export const metadata: Metadata = generateMetadata(pageSEO.pro);

export default function ProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

