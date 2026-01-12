import { ImageResponse } from '@vercel/og';
import { getRankForValue } from '@/app/utils/rank-tiers';
import { InventoryImage } from './InventoryImage';

export const runtime = 'edge';

type Profile = {
  steamId?: string;
  name?: string;
  avatar?: string;
};

type TopItem = {
  market_hash_name: string;
  icon_url: string;
  amount: number;
  price: number;
};

function computeTopItemsAndTotal(
  inv: any,
  prices: Record<string, number>,
  limit: number,
): { topItems: TopItem[]; totalValue: number; totalItems: number } {
  try {
    const assets = Array.isArray(inv?.assets) ? inv.assets : [];
    const descriptions = Array.isArray(inv?.descriptions) ? inv.descriptions : [];
    if (!assets.length || !descriptions.length) return { topItems: [], totalValue: 0, totalItems: 0 };

    const descByKey = new Map<string, any>();
    for (const d of descriptions) {
      const key = `${String(d?.classid)}_${String(d?.instanceid || 0)}`;
      if (!descByKey.has(key)) descByKey.set(key, d);
    }

    const items: TopItem[] = [];
    let totalValue = 0;
    let totalItems = 0;

    for (const a of assets) {
      const key = `${String((a as any)?.classid)}_${String((a as any)?.instanceid || 0)}`;
      const d = descByKey.get(key);
      const marketHashName = String(d?.market_hash_name || '').trim();
      if (!marketHashName) continue;
      const price = Number(prices[marketHashName] || 0);
      const amount = Math.max(1, Number((a as any)?.amount || 1));
      totalItems += amount;
      if (!Number.isFinite(price) || price <= 0) continue;
      totalValue += price * amount;
      items.push({
        market_hash_name: marketHashName,
        icon_url: String(d?.icon_url || ''),
        amount,
        price,
      });
    }

    items.sort((a, b) => (b.price * b.amount) - (a.price * a.amount));
    return {
      topItems: items.slice(0, limit),
      totalValue,
      totalItems,
    };
  } catch {
    return { topItems: [], totalValue: 0, totalItems: 0 };
  }
}

async function fetchInventoryData(steamId: string, baseUrl: string) {
  try {
    const inventoryUrl = `${baseUrl}/api/steam/inventory?steamId=${steamId}&isPro=true&currency=1&includePriceIndex=1`;
    const profileUrl = `${baseUrl}/api/steam/profile?steamId=${steamId}`;

    const [inventoryRes, profileRes] = await Promise.all([
      fetch(inventoryUrl, { next: { revalidate: 3600 } }).catch(() => null),
      fetch(profileUrl, { next: { revalidate: 86400 } }).catch(() => null),
    ]);

    const profileData: Profile | null = profileRes && (profileRes as any).ok
      ? await (profileRes as Response).json().catch(() => null)
      : null;

    const inventoryData: any | null = inventoryRes && (inventoryRes as any).ok
      ? await (inventoryRes as Response).json().catch(() => null)
      : null;

    const priceIndex: Record<string, number> = (inventoryData?.priceIndex && typeof inventoryData.priceIndex === 'object')
      ? inventoryData.priceIndex
      : {};

    const { topItems, totalValue, totalItems } = computeTopItemsAndTotal(inventoryData, priceIndex, 3);
    const rank = getRankForValue(totalValue);

    const avatarFallback = `${baseUrl}/icons/web-app-manifest-192x192.png`;
    const safeProfile: Profile = {
      steamId,
      name: String(profileData?.name || 'Unknown User'),
      avatar: String(profileData?.avatar || avatarFallback),
    };

    return {
      profile: safeProfile,
      totalValue,
      totalItems,
      rank,
      topItems,
    };
  } catch (error) {
    console.error('Failed to fetch inventory data for OG image:', error);
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const steamId = searchParams.get('steamId');

  if (!steamId) {
    return new Response('Missing steamId', { status: 400 });
  }

  const data = await fetchInventoryData(steamId, origin);

  const safe = data || {
    profile: {
      steamId,
      name: 'Unknown User',
      avatar: `${origin}/icons/web-app-manifest-192x192.png`,
    },
    totalValue: 0,
    totalItems: 0,
    rank: getRankForValue(0),
    topItems: [],
  };

  const { profile, totalValue, totalItems, rank, topItems } = safe as any;

  const res = new ImageResponse(
    <InventoryImage
      profile={profile}
      rank={rank}
      totalValue={totalValue}
      totalItems={totalItems}
      topItems={Array.isArray(topItems) ? topItems : []}
    />,
    {
      width: 1200,
      height: 630,
    },
  );

  res.headers.set('cache-control', 'public, max-age=3600, s-maxage=3600');
  return res;
}
