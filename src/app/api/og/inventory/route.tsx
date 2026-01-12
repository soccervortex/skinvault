import { ImageResponse } from '@vercel/og';
import { getRankForValue } from '@/app/utils/rank-tiers';
import { InventoryImage } from './InventoryImage';

export const runtime = 'edge';

const STEAM_CURRENCY_TO_ISO: Record<string, string> = {
  '1': 'USD',
  '2': 'GBP',
  '3': 'EUR',
  '5': 'RUB',
  '6': 'PLN',
  '7': 'BRL',
  '8': 'JPY',
  '9': 'NOK',
  '10': 'IDR',
  '11': 'MYR',
  '12': 'PHP',
  '13': 'SGD',
  '14': 'THB',
  '15': 'VND',
  '16': 'KRW',
  '17': 'TRY',
  '18': 'UAH',
  '19': 'MXN',
  '20': 'CAD',
  '21': 'AUD',
  '22': 'NZD',
  '23': 'CNY',
  '24': 'INR',
  '29': 'HKD',
  '30': 'TWD',
  '33': 'SEK',
  '35': 'ILS',
  '28': 'ZAR',
};

const ISO_TO_STEAM_CURRENCY: Record<string, string> = {
  USD: '1',
  GBP: '2',
  EUR: '3',
  RUB: '5',
  PLN: '6',
  BRL: '7',
  JPY: '8',
  NOK: '9',
  IDR: '10',
  MYR: '11',
  PHP: '12',
  SGD: '13',
  THB: '14',
  VND: '15',
  KRW: '16',
  TRY: '17',
  UAH: '18',
  MXN: '19',
  CAD: '20',
  AUD: '21',
  NZD: '22',
  CNY: '23',
  INR: '24',
  HKD: '29',
  TWD: '30',
  SEK: '33',
  ILS: '35',
  ZAR: '28',
};

function normalizeCurrencyParam(raw: string | null): { steam: string; iso: string } {
  const v = String(raw || '').trim();
  if (!v) return { steam: '3', iso: 'EUR' };
  if (/^\d+$/.test(v)) {
    const iso = STEAM_CURRENCY_TO_ISO[v] || 'USD';
    return { steam: v, iso };
  }
  const iso = v.toUpperCase();
  const steam = ISO_TO_STEAM_CURRENCY[iso] || '1';
  return { steam, iso: ISO_TO_STEAM_CURRENCY[iso] ? iso : 'USD' };
}

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

async function fetchInventoryData(steamId: string, baseUrl: string, steamCurrency: string) {
  try {
    const inventoryUrl = `${baseUrl}/api/steam/inventory?steamId=${steamId}&isPro=true&currency=${encodeURIComponent(steamCurrency)}&includePriceIndex=1`;
    const profileUrl = `${baseUrl}/api/steam/profile?steamId=${steamId}`;

    const invController = new AbortController();
    const profController = new AbortController();
    const invTimeout = setTimeout(() => invController.abort(), 8000);
    const profTimeout = setTimeout(() => profController.abort(), 6000);

    const [inventoryRes, profileRes] = await Promise.all([
      fetch(inventoryUrl, { next: { revalidate: 3600 }, signal: invController.signal }).catch(() => null),
      fetch(profileUrl, { next: { revalidate: 86400 }, signal: profController.signal }).catch(() => null),
    ]);

    clearTimeout(invTimeout);
    clearTimeout(profTimeout);

    const profileData: Profile | null = profileRes && (profileRes as any).ok
      ? await (profileRes as Response).json().catch(() => null)
      : null;

    const inventoryData: any | null = inventoryRes && (inventoryRes as any).ok
      ? await (inventoryRes as Response).json().catch(() => null)
      : null;

    const priceIndex = inventoryData?.priceIndex && typeof inventoryData.priceIndex === 'object'
      ? (inventoryData.priceIndex as Record<string, number>)
      : {};

    const computed = computeTopItemsAndTotal(inventoryData, priceIndex, 5);
    const totalValue = computed.totalValue;
    const totalItems = computed.totalItems;
    const topItems = computed.topItems;
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
  const { steam: steamCurrency, iso: isoCurrency } = normalizeCurrencyParam(searchParams.get('currency'));

  if (!steamId) {
    return new Response('Missing steamId', { status: 400 });
  }

  const data = await fetchInventoryData(steamId, origin, steamCurrency);

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
      currency={isoCurrency}
      baseUrl={origin}
    />,
    {
      width: 1200,
      height: 630,
    },
  );

  res.headers.set('cache-control', 'public, max-age=3600, s-maxage=3600');
  return res;
}
