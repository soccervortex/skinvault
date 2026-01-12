import { Metadata } from 'next';
import { headers } from 'next/headers';
import { generateSEOMetadata } from '@/app/lib/seo';
import InventoryPage from '../page';

export const runtime = 'nodejs';

type SteamProfile = {
  steamId?: string;
  name?: string;
  avatar?: string;
};

async function getRequestOriginSafe() {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host') || '';
    const proto = h.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`;
  } catch {
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://www.skinvaults.online';
}

export async function generateMetadata(
  { params, searchParams }: { params: { steamId: string }; searchParams?: Record<string, string | string[] | undefined> }
): Promise<Metadata> {
  const { steamId } = params;
  const safeSteamId = String(steamId || '').trim();

  const sp = (searchParams || {}) as any;
  const rawCurrency = Array.isArray(sp?.currency) ? sp.currency[0] : sp?.currency;
  const currency = rawCurrency ? String(rawCurrency) : null;

  const rawV = Array.isArray(sp?.v) ? sp.v[0] : sp?.v;
  const userV = rawV ? String(rawV) : null;

  const baseUrl = await getRequestOriginSafe();
  const isValidSteamId = /^\d{17}$/.test(safeSteamId);
  let profile: SteamProfile | null = null;
  if (isValidSteamId) {
    try {
      const res = await fetch(
        `${baseUrl}/api/steam/profile?steamId=${encodeURIComponent(safeSteamId)}`,
        { next: { revalidate: 86400 } }
      );
      if (res.ok) profile = await res.json().catch(() => null);
    } catch {
      profile = null;
    }
  }

  const displayName = String(profile?.name || 'Inventory Vault');
  const title = `${displayName}'s Inventory Vault`;
  const description = `View ${displayName}'s CS2 inventory vault with valuation, rank, and top items.`;
  const version = String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
  const v = version ? version.slice(0, 12) : '';
  const ogImage = `${baseUrl}/api/og/inventory?steamId=${encodeURIComponent(safeSteamId)}${currency ? `&currency=${encodeURIComponent(currency)}` : ''}${v ? `&v=${encodeURIComponent(v)}` : ''}${userV ? `&uv=${encodeURIComponent(userV)}` : ''}`;

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
  { params }: { params: { steamId: string } }
) {
  const { steamId } = params;

  // Reuse the existing client inventory page implementation.
  // This makes /inventory/[steamId] a shareable URL with correct OG tags.
  return <InventoryPage />;
}
