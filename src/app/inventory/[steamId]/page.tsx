import { Metadata } from 'next';
import { generateSEOMetadata } from '@/app/lib/seo';
import InventoryPage from '../page';

export async function generateMetadata(
  { params }: { params: Promise<{ steamId: string }> }
): Promise<Metadata> {
  const { steamId } = await params;
  const safeSteamId = String(steamId || '').trim();

  const base = generateSEOMetadata({
    title: 'Inventory Vault',
    description: 'View a CS2 inventory vault with valuation, rank, and top items.',
    path: `/inventory/${encodeURIComponent(safeSteamId)}`,
    image: `/api/og/inventory?steamId=${encodeURIComponent(safeSteamId)}`,
  });

  return {
    ...base,
    openGraph: {
      ...(base.openGraph || {}),
      url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online'}/inventory/${encodeURIComponent(safeSteamId)}`,
      images: [
        {
          url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online'}/api/og/inventory?steamId=${encodeURIComponent(safeSteamId)}`,
          width: 1200,
          height: 630,
          alt: `SkinVaults Inventory ${safeSteamId}`,
        },
      ],
    },
    twitter: {
      ...(base.twitter || {}),
      images: [`${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online'}/api/og/inventory?steamId=${encodeURIComponent(safeSteamId)}`],
    },
  };
}

export default async function InventorySteamIdPage(
  { params }: { params: Promise<{ steamId: string }> }
) {
  const { steamId } = await params;

  // Reuse the existing client inventory page implementation.
  // This makes /inventory/[steamId] a shareable URL with correct OG tags.
  return <InventoryPage />;
}
