import { Metadata } from 'next';
import { generateMetadata, pageSEO } from '../../lib/seo';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const itemName = decodeURIComponent(id);
  return generateMetadata(pageSEO.item(itemName));
}

export default function ItemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

