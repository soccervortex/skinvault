import { ImageResponse } from '@vercel/og';
import { getRankForValue } from '@/app/utils/rank-tiers';
import { InventoryImage } from './InventoryImage';

export const runtime = 'edge';

async function fetchInventoryData(steamId: string, baseUrl: string) {
  try {
    const inventoryUrl = `${baseUrl}/api/steam/inventory?steamId=${steamId}&isPro=true&currency=1&includePriceIndex=1`;
    const profileUrl = `${baseUrl}/api/steam/profile?steamId=${steamId}`;

    const [inventoryRes, profileRes] = await Promise.all([
      fetch(inventoryUrl, { next: { revalidate: 3600 } }), // Cache for 1 hour
      fetch(profileUrl, { next: { revalidate: 86400 } }), // Cache for 1 day
    ]);

    if (!inventoryRes.ok || !profileRes.ok) {
      throw new Error('Failed to fetch inventory or profile');
    }

    const [inventoryData, profileData] = await Promise.all([
      inventoryRes.json(),
      profileRes.json(),
    ]);

    const priceIndex = inventoryData.priceIndex || {};
    let totalValue = 0;
    const items = inventoryData.inventory.map((item: any) => {
      const price = priceIndex[item.market_hash_name] || 0;
      totalValue += price * (item.amount || 1);
      return { ...item, price };
    });

    const topItems = items.sort((a: any, b: any) => b.price - a.price).slice(0, 3);
    const rank = getRankForValue(totalValue);

    return {
      profile: profileData,
      totalValue,
      totalItems: inventoryData.inventory.length,
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

  if (!data) {
    return new Response('Failed to generate image', { status: 500 });
  }

  const { profile, totalValue, totalItems, rank, topItems } = data;

  return new ImageResponse(
    <InventoryImage 
      profile={profile} 
      rank={rank} 
      totalValue={totalValue} 
      totalItems={totalItems} 
      topItems={topItems} 
    />,
    {
      width: 1200,
      height: 630,
    },
  );
}
