import { Metadata } from 'next';
import { generateSEOMetadata } from '@/app/lib/seo';
import InventoryPage from '../page';

export const runtime = 'edge';

type SteamProfile = {
  steamId?: string;
  name?: string;
  avatar?: string;
};

export async function generateMetadata(
  { params }: { params: Promise<{ steamId: string }> }
): Promise<Metadata> {
  const { steamId } = await params;
  const safeSteamId = String(steamId || '').trim();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
  let profile: SteamProfile | null = null;
  try {
    const res = await fetch(
      `${baseUrl}/api/steam/profile?steamId=${encodeURIComponent(safeSteamId)}`,
      { next: { revalidate: 86400 } },
    );
    if (res.ok) profile = await res.json().catch(() => null);
  } catch {
    profile = null;
  }

  const displayName = String(profile?.name || 'Inventory Vault');
  const title = `${displayName}'s Inventory Vault`;
  const description = `View ${displayName}'s CS2 inventory vault with valuation, rank, and top items.`;
  const ogImage = `${baseUrl}/api/og/inventory?steamId=${encodeURIComponent(safeSteamId)}`;

  const base = generateSEOMetadata({
    title,
    description,
    path: `/inventory/${encodeURIComponent(safeSteamId)}`,
    image: ogImage,
  });

  return {
    ...base,
    openGraph: {
      ...(base.openGraph || {}),
      title,
      description,
      url: `${baseUrl}/inventory/${encodeURIComponent(safeSteamId)}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${displayName}'s SkinVaults Inventory`,
        },
      ],
    },
    twitter: {
      ...(base.twitter || {}),
      title,
      description,
      images: [ogImage],
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
