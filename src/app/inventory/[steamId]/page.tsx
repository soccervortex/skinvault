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
  { params, searchParams }: { params: { steamId: string }; searchParams?: Record<string, string | string[] | undefined> }
): Promise<Metadata> {
  const { steamId } = params;
  const safeSteamId = String(steamId || '').trim();

  const sp = (searchParams || {}) as any;
  const rawCurrency = Array.isArray(sp?.currency) ? sp.currency[0] : sp?.currency;
  const currency = rawCurrency ? String(rawCurrency) : null;

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
  const version = String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
  const v = version ? version.slice(0, 12) : '';
  const ogImage = `${baseUrl}/api/og/inventory?steamId=${encodeURIComponent(safeSteamId)}${currency ? `&currency=${encodeURIComponent(currency)}` : ''}${v ? `&v=${encodeURIComponent(v)}` : ''}`;

  const base = generateSEOMetadata({
    title,
    description,
    path: `/inventory/${encodeURIComponent(safeSteamId)}${currency ? `?currency=${encodeURIComponent(currency)}` : ''}`,
    image: ogImage,
  });

  return {
    ...base,
    openGraph: {
      ...(base.openGraph || {}),
      title,
      description,
      url: `${baseUrl}/inventory/${encodeURIComponent(safeSteamId)}${currency ? `?currency=${encodeURIComponent(currency)}` : ''}`,
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
