"use client";
import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, TrendingUp, ExternalLink, Box, Image as ImageIcon, Info, Loader2, ShieldCheck, Tag, BarChart3, Coins, Heart, Bell, Scale, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import dynamic from 'next/dynamic';
import ReportMissingItemModal from '@/app/components/ReportMissingItemModal';

// Dynamic imports for modals to reduce initial bundle size
const ProUpgradeModal = dynamic(() => import('@/app/components/ProUpgradeModal'), {
  ssr: false,
});
const PriceTrackerModal = dynamic(() => import('@/app/components/PriceTrackerModal'), {
  ssr: false,
});
const CompareModal = dynamic(() => import('@/app/components/CompareModal'), {
  ssr: false,
});
import ShareButton from '@/app/components/ShareButton';
import { ItemCardSkeleton } from '@/app/components/LoadingSkeleton';
import { loadWishlist, toggleWishlistEntry, WishlistEntry } from '@/app/utils/wishlist';
import { getWishlistLimitSync } from '@/app/utils/pro-limits';
import { fetchWithProxyRotation, checkProStatus } from '@/app/utils/proxy-utils';

import { API_FILES, BASE_URL as API_BASE_URL } from '@/data/api-endpoints';

const DATASET_CACHE_KEY = 'sv_dataset_cache_v1';
const DATASET_CACHE_TTL = 1000 * 60 * 60 * 12; // 12h
const PRICE_CACHE_KEY = 'sv_price_cache_item_v1';

interface ItemDetailClientProps {
  initialItem: any;
  itemId: string;
}

export default function ItemDetailClient({ initialItem, itemId }: ItemDetailClientProps) {
  const decodedId = decodeURIComponent(itemId);
  
  const [item, setItem] = useState<any>(initialItem);
  const [priceData, setPriceData] = useState<any>(null);
  const [loading, setLoading] = useState(!initialItem);
  const [currency, setCurrency] = useState({ code: '3', symbol: '€' }); // Default Euro
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [rotation, setRotation] = useState(0);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isPro, setIsPro] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const datasetCacheRef = useRef<Record<string, { data: any[]; timestamp: number }>>({});
  const priceCacheRef = useRef<Record<string, any>>({});
  const [priceDone, setPriceDone] = useState(false);

  const [contentsHydrated, setContentsHydrated] = useState(false);
  const [contentsLoading, setContentsLoading] = useState(false);

  const normalizeItem = (raw: any) => {
    if (!raw) return raw;
    const baseImg =
      raw.image ||
      raw.image_inventory ||
      raw.image_large ||
      raw.image_small ||
      raw.image_url ||
      null;

    let img: string | null = baseImg ? String(baseImg) : null;
    if (!img) {
      const icon = raw.icon_url || raw.iconUrl || raw.icon || null;
      if (icon) {
        const iconStr = String(icon);
        if (/^https?:\/\//i.test(iconStr)) img = iconStr;
        else img = `https://community.cloudflare.steamstatic.com/economy/image/${iconStr}`;
      }
    }

    return {
      ...raw,
      image: img,
      market_hash_name: raw.market_hash_name || raw.marketHashName || raw.market_name || raw.marketName || raw.name,
    };
  };

  // Hydrate dataset + price caches + wishlist once on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // Test localStorage accessibility first
        const testKey = '__localStorage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
        
        const ds = window.localStorage.getItem(DATASET_CACHE_KEY);
        if (ds) datasetCacheRef.current = JSON.parse(ds);
        const pc = window.localStorage.getItem(PRICE_CACHE_KEY);
        if (pc) priceCacheRef.current = JSON.parse(pc);

        const storedCurrency = window.localStorage.getItem('sv_currency');
        if (storedCurrency === '1') {
          setCurrency({ code: '1', symbol: '$' });
        } else if (storedCurrency === '3') {
          setCurrency({ code: '3', symbol: '€' });
        }

        const storedUser = window.localStorage.getItem('steam_user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        setUser(parsedUser);
        const steamId = parsedUser?.steamId || null;
        setWishlist(loadWishlist(steamId));
        
        // Check Pro status from API to ensure accuracy
        if (steamId) {
          checkProStatus(steamId).then(setIsPro);
        } else {
          setIsPro(false);
        }
      }
    } catch {
      datasetCacheRef.current = {};
      priceCacheRef.current = {};
      setUser(null);
      setWishlist([]);
    }
  }, []);

  const persistDatasetCache = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DATASET_CACHE_KEY, JSON.stringify(datasetCacheRef.current));
      }
    } catch {
      /* ignore quota */
    }
  };

  const persistPriceCache = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(priceCacheRef.current));
      }
    } catch {
      /* ignore quota */
    }
  };

  // Fetch item meta once (by id) - only if not provided initially
  useEffect(() => {
    const normalizedInitial = initialItem ? normalizeItem(initialItem) : null;
    if (normalizedInitial?.image) {
      // Use initial payload for fast paint, but still hydrate full fields (contains/float/type/etc)
      // from the upstream datasets in the background.
      setItem(normalizedInitial);
      setLoading(false);
    }
    
    const fetchItem = async () => {
      if (!normalizedInitial?.image) {
        setLoading(true);
      }
      let foundItem: any = null;

      // First check custom items
      try {
        const customRes = await fetch('/api/admin/custom-items');
        if (customRes.ok) {
          const customData = await customRes.json();
          if (customData.items && Array.isArray(customData.items)) {
            const customItem = customData.items.find((item: any) => 
              item.id === decodedId || 
              item.marketHashName === decodedId || 
              item.name === decodedId
            );
            if (customItem) {
              foundItem = {
                id: customItem.id,
                name: customItem.name,
                market_hash_name: customItem.marketHashName || customItem.name,
                image: customItem.image || null,
                rarity: customItem.rarity ? { name: customItem.rarity } : null,
                weapon: customItem.weapon ? { name: customItem.weapon } : null,
                isCustom: true,
              };
            }
          }
        }
      } catch (error) {
        // Silently ignore custom items errors
      }

      // If not found in custom items, check API files
      if (!foundItem) {
        for (const file of API_FILES) {
          try {
            // Try cache first
            const cached = datasetCacheRef.current[file];
            const fresh = cached && Date.now() - cached.timestamp < DATASET_CACHE_TTL;
            let itemArray: any[];

            if (fresh) {
              itemArray = cached.data;
            } else {
              const res = await fetch(`${API_BASE_URL}/${file}`, { cache: 'force-cache' });
              const data = await res.json();
              itemArray = Array.isArray(data) ? data : Object.values(data);
              datasetCacheRef.current[file] = { data: itemArray, timestamp: Date.now() };
              persistDatasetCache();
            }

            foundItem = itemArray.find((i: any) => i.id === decodedId || i.market_hash_name === decodedId || i.name === decodedId);
            if (foundItem) break;
          } catch (e) {
            console.error(e);
          }
        }
      }

      const fallback = initialItem || {
        id: decodedId,
        name: decodedId,
        market_hash_name: decodedId,
        image: null,
      };

      setItem(normalizeItem(foundItem || fallback));
      setLoading(false);
    };

    fetchItem();
  }, [decodedId, initialItem]);

  useEffect(() => {
    if (!item) return;
    if (contentsHydrated) return;

    const currentContains = Array.isArray((item as any)?.contains) ? ((item as any).contains as any[]) : [];
    const currentContainsRare = Array.isArray((item as any)?.contains_rare) ? ((item as any).contains_rare as any[]) : [];
    const currentCrates = Array.isArray((item as any)?.crates) ? ((item as any).crates as any[]) : [];
    const hasAny = currentContains.length > 0 || currentContainsRare.length > 0 || currentCrates.length > 0;

    const nm = String((item as any)?.market_hash_name || (item as any)?.name || '').toLowerCase();
    const t = String((item as any)?.type || '').toLowerCase();
    const containerLikely =
      t.includes('case') ||
      t.includes('capsule') ||
      t.includes('package') ||
      nm.includes('case') ||
      nm.includes('capsule') ||
      nm.includes('package') ||
      nm.includes('souvenir') ||
      nm.includes('collection');

    if (!containerLikely || hasAny) {
      setContentsHydrated(true);
      return;
    }

    setContentsLoading(true);

    const findMatchIn = (arr: any[]) => {
      const id = String((item as any)?.id || '').trim();
      const mh = String((item as any)?.market_hash_name || '').trim();
      const name = String((item as any)?.name || '').trim();
      return (
        arr.find((x: any) => String(x?.id || '').trim() === id) ||
        arr.find((x: any) => String(x?.market_hash_name || '').trim() === mh) ||
        arr.find((x: any) => String(x?.name || '').trim() === name) ||
        null
      );
    };

    (async () => {
      const files = ['crates', 'collections'];
      for (const f of files) {
        try {
          const res = await fetch(`/api/csgo-api?file=${encodeURIComponent(f)}&lang=en`, { cache: 'no-store' });
          if (!res.ok) continue;
          const json = await res.json().catch(() => null);
          const arr = Array.isArray(json) ? json : json && typeof json === 'object' ? Object.values(json as any) : [];
          const found = findMatchIn(arr as any[]);
          if (!found) continue;

          const nextContains = Array.isArray((found as any)?.contains) ? (found as any).contains : null;
          const nextContainsRare = Array.isArray((found as any)?.contains_rare) ? (found as any).contains_rare : null;
          const nextCrates = Array.isArray((found as any)?.crates) ? (found as any).crates : null;

          if ((nextContains && nextContains.length) || (nextContainsRare && nextContainsRare.length) || (nextCrates && nextCrates.length)) {
            setItem((prev: any) => ({
              ...prev,
              contains: nextContains ?? (prev as any)?.contains,
              contains_rare: nextContainsRare ?? (prev as any)?.contains_rare,
              crates: nextCrates ?? (prev as any)?.crates,
              type: (found as any)?.type ?? (prev as any)?.type,
              rarity: (found as any)?.rarity ?? (prev as any)?.rarity,
            }));
            break;
          }
        } catch {
          // ignore
        }
      }
    })()
      .finally(() => {
        setContentsLoading(false);
        setContentsHydrated(true);
      });
  }, [item, contentsHydrated]);

  // Fetch price when item or currency changes
  useEffect(() => {
    if (!item) return;

    const fetchPrice = async () => {
      const marketName = item.market_hash_name || item.name;
      if (!marketName) return;

      const cacheKey = `${currency.code}:${marketName}`;
      const cached = priceCacheRef.current[cacheKey];
      if (cached) {
        setPriceData(cached);
        setPriceDone(true);
        return;
      }

      setPriceData(null);
      setPriceDone(false);
      const hash = encodeURIComponent(marketName);
      const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${currency.code}&market_hash_name=${hash}&t=${Date.now()}`;

      const marketHashName = item?.market_hash_name || item?.name || '';
      const data = await fetchWithProxyRotation(steamUrl, isPro, { 
        parallel: true,
        marketHashName,
        currency: currency.code,
      });
      if (data?.success) {
        const next = {
          lowest: data.lowest_price || data.median_price || "---",
          median: data.median_price || "---",
          volume: data.volume || "Low"
        };
        priceCacheRef.current[cacheKey] = next;
        setPriceData(next);
        persistPriceCache();
        setPriceDone(true);
      } else {
        const fallback = {
          lowest: "---",
          median: "---",
          volume: "Low"
        };
        priceCacheRef.current[cacheKey] = fallback;
        setPriceData(fallback);
        persistPriceCache();
        setPriceDone(true);
      }
    };

    fetchPrice();
  }, [item, currency.code, isPro]);

  // Simple 3D spin animation when in 3D view
  useEffect(() => {
    if (viewMode !== '3D') {
      setRotation(0);
      return;
    }

    let frameId: number;
    const animate = () => {
      setRotation((prev) => (prev + 1) % 360);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [viewMode]);

  if (loading) {
    return (
      <div className="flex h-dvh bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 no-scrollbar">
            <div className="w-full max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-12 items-start">
                <div className="lg:col-span-5">
                  <ItemCardSkeleton />
                </div>
                <div className="lg:col-span-7 space-y-6">
                  <div className="h-12 bg-gray-700/30 rounded animate-pulse" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-32 bg-gray-700/30 rounded animate-pulse" />
                    <div className="h-32 bg-gray-700/30 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <p className="text-sm font-medium text-gray-300">Item not found</p>
          <p className="text-sm text-gray-400">This skin could not be loaded from the CS:GO API dataset.</p>
        </div>
      </div>
    );
  }

  const rarityColor = item?.rarity?.color || '#3b82f6';
  const wishlistKey = (item as any).market_hash_name || item.name || decodedId;
  const steamId = user?.steamId || null;
  const isWishlisted = wishlist.some((w) => w.key === wishlistKey);

  const minFloatRaw = (item as any)?.min_float ?? (item as any)?.minFloat;
  const maxFloatRaw = (item as any)?.max_float ?? (item as any)?.maxFloat;
  const minFloat = typeof minFloatRaw === 'number' ? minFloatRaw : Number.isFinite(Number(minFloatRaw)) ? Number(minFloatRaw) : null;
  const maxFloat = typeof maxFloatRaw === 'number' ? maxFloatRaw : Number.isFinite(Number(maxFloatRaw)) ? Number(maxFloatRaw) : null;
  const wearName = String((item as any)?.wear?.name || '').trim() || null;

  const contains = Array.isArray((item as any)?.contains) ? ((item as any).contains as any[]) : [];
  const containsRare = Array.isArray((item as any)?.contains_rare) ? ((item as any).contains_rare as any[]) : [];
  const crates = Array.isArray((item as any)?.crates) ? ((item as any).crates as any[]) : [];

  const hasFloatRange = minFloat !== null && maxFloat !== null;
  const hasContents = contains.length > 0 || containsRare.length > 0 || crates.length > 0;

  const itemTypeLabel = String((item as any)?.type || '').trim() || null;
  const categoryLabel = String((item as any)?.category?.name || '').trim() || null;
  const patternLabel = String((item as any)?.pattern?.name || '').trim() || null;
  const teamLabel = String((item as any)?.team?.name || '').trim() || null;
  const paintIndexLabel = String((item as any)?.paint_index || '').trim() || null;
  const isStatTrak = Boolean((item as any)?.stattrak);
  const isSouvenir = Boolean((item as any)?.souvenir);

  const containerLikely = (() => {
    const nm = String((item as any)?.market_hash_name || (item as any)?.name || '').toLowerCase();
    const t = String((item as any)?.type || '').toLowerCase();
    return (
      t.includes('case') ||
      t.includes('capsule') ||
      t.includes('package') ||
      nm.includes('case') ||
      nm.includes('capsule') ||
      nm.includes('package') ||
      nm.includes('souvenir') ||
      nm.includes('collection')
    );
  })();

  const makeItemHref = (raw: any) => {
    const id = String(raw?.id || '').trim();
    const marketHashName = String(raw?.market_hash_name || raw?.marketHashName || '').trim();
    const name = String(raw?.name || '').trim();
    const key = id || marketHashName || name;
    return `/item/${encodeURIComponent(key)}`;
  };

  const rowCardKey = (raw: any) => String(raw?.id || raw?.market_hash_name || raw?.marketHashName || raw?.name || '');

  const formatOdds = (raw: any): string | null => {
    const direct = raw?.chance ?? raw?.percentage ?? raw?.probability ?? raw?.odds;
    const directNum = typeof direct === 'number' ? direct : Number.isFinite(Number(direct)) ? Number(direct) : null;
    if (directNum !== null) {
      const pct = directNum > 1 ? directNum : directNum * 100;
      return `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
    }

    const rarityName = String(raw?.rarity?.name || '').toLowerCase();
    if (!rarityName) return null;

    // Typical CS case odds by rarity (approx). Only used when no explicit odds are available.
    if (rarityName.includes('mil-spec')) return '79.9%';
    if (rarityName.includes('restricted')) return '16.0%';
    if (rarityName.includes('classified')) return '3.2%';
    if (rarityName.includes('covert')) return '0.64%';
    if (rarityName.includes('extraordinary') || rarityName.includes('rare special')) return '0.26%';
    return null;
  };

  const formatFloatRange = (raw: any): string | null => {
    const minRaw = raw?.min_float ?? raw?.minFloat;
    const maxRaw = raw?.max_float ?? raw?.maxFloat;
    const min = typeof minRaw === 'number' ? minRaw : Number.isFinite(Number(minRaw)) ? Number(minRaw) : null;
    const max = typeof maxRaw === 'number' ? maxRaw : Number.isFinite(Number(maxRaw)) ? Number(maxRaw) : null;
    if (min === null || max === null) return null;
    return `${min.toFixed(2)}–${max.toFixed(2)}`;
  };

  const ContentGrid = ({ items }: { items: any[] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((c: any) => {
        const odds = formatOdds(c);
        const floatRange = formatFloatRange(c);
        const isEstimated = odds && !(c?.chance ?? c?.percentage ?? c?.probability ?? c?.odds);

        return (
          <div
            key={rowCardKey(c)}
            className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/5 transition-all"
          >
            <Link href={makeItemHref(c)} className="block">
              <div className="aspect-square bg-[#0b0e14] flex items-center justify-center border-b border-white/10">
                {c?.image ? (
                  <img
                    src={String(c.image)}
                    alt={String(c?.name || '')}
                    className="w-[70%] h-auto object-contain"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10" />
                )}
              </div>

              <div className="p-3">
                <div className="text-[12px] font-semibold text-white/90 truncate">{String(c?.name || '—')}</div>
                <div className="mt-1 text-[11px] text-gray-500 truncate">{String(c?.rarity?.name || c?.id || '')}</div>

                {(odds || floatRange) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {floatRange ? (
                      <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300">
                        Float {floatRange}
                      </div>
                    ) : null}
                    {odds ? (
                      <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300">
                        {isEstimated ? `~${odds}` : odds}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </Link>

            <div className="px-3 pb-3">
              <Link
                href={makeItemHref(c)}
                className="w-full inline-flex items-center justify-center rounded-lg border border-white/10 bg-black/30 hover:bg-white/5 transition-all py-2 text-[12px] font-medium text-gray-200"
              >
                View
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
  <div className="flex h-dvh bg-[#08090d] text-white overflow-hidden font-sans">
    <Sidebar />
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 no-scrollbar">
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6 md:mb-8 gap-4">
            <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white font-medium text-xs transition-all shrink-0">
              <ChevronLeft size={12} /> <span className="hidden sm:inline">Back</span>
            </Link>
            
            <div className="flex items-center gap-2 md:gap-3">
              {/* VIEW MODE SWITCHER */}
              <div className="hidden md:flex bg-[#11141d] p-1 rounded-lg border border-white/10">
                <button
                  onClick={() => setViewMode('2D')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    viewMode === '2D' ? 'bg-white text-black' : 'text-gray-500'
                  }`}
                >
                  2D
                </button>
                <button
                  onClick={() => setViewMode('3D')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    viewMode === '3D' ? 'bg-blue-600 text-white' : 'text-gray-500'
                  }`}
                >
                  Tilt
                </button>
              </div>

              {/* CURRENCY SWITCHER */}
              <div className="flex bg-[#11141d] p-1 rounded-lg border border-white/10">
                <button
                  onClick={() => {
                    setCurrency({ code: '3', symbol: '€' });
                    try {
                      if (typeof window !== 'undefined') window.localStorage.setItem('sv_currency', '3');
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`px-3 md:px-4 py-2 rounded-lg text-xs font-medium transition-all ${currency.code === '3' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                >
                  EUR
                </button>
                <button
                  onClick={() => {
                    setCurrency({ code: '1', symbol: '$' });
                    try {
                      if (typeof window !== 'undefined') window.localStorage.setItem('sv_currency', '1');
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`px-3 md:px-4 py-2 rounded-lg text-xs font-medium transition-all ${currency.code === '1' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                >
                  USD
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 items-start">
            <div className="lg:col-span-5">
              <div
                ref={cardRef}
                className="bg-[#11141d] rounded-2xl aspect-square border border-white/10 flex items-center justify-center relative overflow-hidden"
                style={{ perspective: '1200px' }}
              >
              <div className="absolute inset-0 opacity-20 blur-[120px]" style={{ backgroundColor: rarityColor }} />
              <img
                src={item?.image}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/icon.png';
                }}
                className="w-[80%] h-auto object-contain z-10"
                alt={item?.name || ''}
                style={{
                  transform: viewMode === '3D' ? `rotateY(${rotation}deg)` : 'rotateY(0deg)',
                  transformStyle: 'preserve-3d',
                  transition: viewMode === '2D' ? 'transform 0.4s ease-out' : undefined,
                }}
              />
              <div className="absolute top-4 right-4 flex bg-black/30 rounded-xl border border-white/10 text-xs font-medium overflow-hidden md:hidden z-20">
                <button
                  onClick={() => setViewMode('2D')}
                  className={`px-3 py-1.5 transition-all ${viewMode === '2D' ? 'bg-white text-black' : 'text-gray-400'}`}
                >
                  2D
                </button>
                <button
                  onClick={() => setViewMode('3D')}
                  className={`px-3 py-1.5 transition-all ${viewMode === '3D' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                  Tilt
                </button>
              </div>
              <div className="absolute bottom-4 left-4 right-4 hidden md:flex items-center justify-center gap-2 bg-black/30 rounded-xl border border-white/10 p-2 z-20">
                <button
                  onClick={() => setViewMode('2D')}
                  className={`px-4 py-2 rounded-lg transition-all text-[12px] font-medium ${viewMode === '2D' ? 'bg-white text-black' : 'text-gray-300'}`}
                >
                  2D View
                </button>
                <button
                  onClick={() => setViewMode('3D')}
                  className={`px-4 py-2 rounded-lg transition-all text-[12px] font-medium ${viewMode === '3D' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
                >
                  Tilt View
                </button>
              </div>
            </div>
            <div className="mt-4 md:mt-6 flex flex-wrap items-center gap-2 md:gap-3">
              <div className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-[#11141d] border border-white/10">
                <Tag size={12} className="text-gray-400" />
                <span className="text-[11px] font-medium text-gray-300">{item?.rarity?.name || 'Standard'}</span>
              </div>
              {item?.weapon?.name && (
                <div className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-[#11141d] border border-white/10">
                  <Box size={12} className="text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-300">{item.weapon.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-[#11141d] border border-white/10">
                <ShieldCheck size={12} className="text-green-400" />
                <span className="text-[11px] font-medium text-green-300">Verified</span>
              </div>
              <div className="md:hidden flex-1 flex justify-end gap-2">
                {/* Share Button (Mobile) */}
                {typeof window !== 'undefined' && (
                  <ShareButton
                    url={window.location.href}
                    title={`${item?.name} - SkinVaults`}
                    text={`Check out ${item?.name} on SkinVaults`}
                    variant="icon"
                    className="inline-flex"
                  />
                )}

                {/* Compare Button (Mobile) */}
                <button
                  onClick={() => setShowCompareModal(true)}
                  className="inline-flex items-center justify-center p-2.5 min-h-[44px] rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 transition-all"
                  aria-label="Compare items"
                >
                  <Scale size={16} className="text-blue-400" />
                </button>

                {/* Price Tracker Button (Mobile) */}
                {user && (
                  <button
                    onClick={() => setShowTrackerModal(true)}
                    className="inline-flex items-center justify-center p-2.5 min-h-[44px] rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 transition-all"
                    aria-label="Set price tracker"
                  >
                    <Bell size={16} className="text-blue-400" />
                  </button>
                )}

                {/* Report Button (Mobile) */}
                <button
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center justify-center p-2.5 min-h-[44px] rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 transition-all"
                  aria-label="Report missing item"
                >
                  <AlertTriangle size={16} className="text-yellow-400" />
                </button>
                {/* Wishlist Button (Mobile) */}
                <button
                  onClick={() => {
                    const result = toggleWishlistEntry(
                      {
                        key: wishlistKey,
                        name: item.name,
                        image: item.image,
                        market_hash_name: (item as any).market_hash_name,
                        rarityName: item.rarity?.name,
                        rarityColor: item.rarity?.color,
                        weaponName: item.weapon?.name,
                      },
                      steamId,
                      isPro,
                    );
                    if (result.success) {
                      setWishlist(result.newList);
                    } else if (result.reason === 'limit_reached') {
                      setShowUpgradeModal(true);
                    }
                  }}
                  className="inline-flex items-center justify-center p-2.5 min-h-[44px] rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 transition-all"
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart
                    size={16}
                    className={isWishlisted ? 'text-rose-500 fill-rose-500' : 'text-gray-400'}
                  />
                </button>
              </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5 md:space-y-6">
            <div className="space-y-3">
              <h1 className="text-2xl md:text-4xl font-semibold text-white leading-tight break-words">
                {item?.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Share Button */}
                {typeof window !== 'undefined' && (
                  <ShareButton
                    url={window.location.href}
                    title={`${item?.name} - SkinVaults`}
                    text={`Check out ${item?.name} on SkinVaults`}
                    variant="icon"
                    className="hidden md:flex"
                  />
                )}
                {/* Compare Button */}
                <button
                  onClick={() => {
                    // Just show modal - it will handle adding the current item automatically
                    setShowCompareModal(true);
                  }}
                  className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 transition-all shrink-0 min-h-[40px]"
                  aria-label="Compare items"
                >
                  <Scale size={18} className="text-blue-400" />
                  <span className="text-[12px] font-medium text-gray-200">Compare</span>
                </button>
                {/* Report Missing Item Button */}
                <button
                  onClick={() => setShowReportModal(true)}
                  className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 transition-all shrink-0 min-h-[40px]"
                  aria-label="Report missing item"
                >
                  <AlertTriangle size={18} className="text-yellow-400" />
                  <span className="text-[12px] font-medium text-gray-200">Report</span>
                </button>
                {/* Price Tracker Button */}
                {user && (
                  <button
                    onClick={() => setShowTrackerModal(true)}
                    className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 transition-all shrink-0 min-h-[40px]"
                    aria-label="Set price tracker"
                  >
                    <Bell size={18} className="text-blue-400" />
                    <span className="text-[12px] font-medium text-gray-200">Tracker</span>
                  </button>
                )}
                {/* Wishlist Button */}
                <button
                  onClick={() => {
                    const result = toggleWishlistEntry(
                      {
                        key: wishlistKey,
                        name: item.name,
                        image: item.image,
                        market_hash_name: (item as any).market_hash_name,
                        rarityName: item.rarity?.name,
                        rarityColor: item.rarity?.color,
                        weaponName: item.weapon?.name,
                      },
                      steamId,
                      isPro,
                    );
                    if (result.success) {
                      setWishlist(result.newList);
                    } else if (result.reason === 'limit_reached') {
                      setShowUpgradeModal(true);
                    }
                  }}
                  className="hidden md:inline-flex items-center justify-center p-2.5 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 transition-all shrink-0 min-h-[40px]"
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart
                    size={18}
                    className={isWishlisted ? 'text-rose-500 fill-rose-500' : 'text-gray-500'}
                  />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#11141d] p-5 md:p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                <span className="text-[12px] text-gray-400 block mb-2">Current Value</span>
                <p className="text-2xl md:text-3xl font-semibold text-green-400">
                  {priceData?.lowest
                    ? priceData.lowest
                    : priceDone
                      ? <span className="text-[12px] md:text-[13px] text-gray-500">No price</span>
                      : <span className="text-[12px] md:text-[13px] text-gray-500 animate-pulse">Scanning…</span>}
                </p>
                <TrendingUp className="absolute right-4 md:right-6 bottom-4 md:bottom-6 text-green-500/5 w-16 h-16 md:w-20 md:h-20" />
              </div>
              <div className="bg-[#11141d] p-5 md:p-6 rounded-2xl border border-white/10 relative">
                <span className="text-[12px] text-gray-400 block mb-2">24h Median</span>
                <p className="text-2xl md:text-3xl font-semibold text-white/90">
                  {priceData?.median
                    ? priceData.median
                    : priceDone
                      ? <span className="text-[12px] md:text-[13px] text-gray-500">No price</span>
                      : <span className="text-[12px] md:text-[13px] text-gray-500 animate-pulse">Scanning…</span>}
                </p>
                <BarChart3 className="absolute right-4 md:right-6 bottom-4 md:bottom-6 text-white/5 w-16 h-16 md:w-20 md:h-20" />
              </div>
            </div>

            {(hasFloatRange || wearName) && (
              <div className="bg-[#11141d] p-5 md:p-6 rounded-2xl border border-white/10">
                <div className="text-xs font-medium text-gray-400 mb-4">Wear / Float</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                    <div className="text-xs font-medium text-gray-500">Wear</div>
                    <div className="mt-1 text-sm font-semibold text-white/90">{wearName || '—'}</div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                    <div className="text-xs font-medium text-gray-500">Float Range</div>
                    <div className="mt-1 text-sm font-semibold text-white/90">{hasFloatRange ? `${minFloat!.toFixed(2)} – ${maxFloat!.toFixed(2)}` : '—'}</div>
                  </div>
                </div>
              </div>
            )}

            {(itemTypeLabel || categoryLabel || patternLabel || teamLabel || paintIndexLabel || isStatTrak || isSouvenir) && (
              <div className="bg-[#11141d] p-5 md:p-6 rounded-2xl border border-white/10">
                <div className="text-xs font-medium text-gray-400 mb-4">Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {itemTypeLabel ? (
                    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                      <div className="text-xs font-medium text-gray-500">Type</div>
                      <div className="mt-1 text-sm font-semibold text-white/90">{itemTypeLabel}</div>
                    </div>
                  ) : null}
                  {categoryLabel ? (
                    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                      <div className="text-xs font-medium text-gray-500">Category</div>
                      <div className="mt-1 text-sm font-semibold text-white/90">{categoryLabel}</div>
                    </div>
                  ) : null}
                  {patternLabel ? (
                    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                      <div className="text-xs font-medium text-gray-500">Finish</div>
                      <div className="mt-1 text-sm font-semibold text-white/90">{patternLabel}</div>
                    </div>
                  ) : null}
                  {paintIndexLabel ? (
                    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                      <div className="text-xs font-medium text-gray-500">Paint Index</div>
                      <div className="mt-1 text-sm font-semibold text-white/90">{paintIndexLabel}</div>
                    </div>
                  ) : null}
                  {teamLabel ? (
                    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                      <div className="text-xs font-medium text-gray-500">Team</div>
                      <div className="mt-1 text-sm font-semibold text-white/90">{teamLabel}</div>
                    </div>
                  ) : null}
                  {(isStatTrak || isSouvenir) ? (
                    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                      <div className="text-xs font-medium text-gray-500">Flags</div>
                      <div className="mt-1 text-sm font-semibold text-white/90">
                        {isStatTrak ? 'StatTrak™' : ''}
                        {isStatTrak && isSouvenir ? ' • ' : ''}
                        {isSouvenir ? 'Souvenir' : ''}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <a href={`https://steamcommunity.com/market/listings/730/${encodeURIComponent(item?.market_hash_name)}`} target="_blank" className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-semibold text-sm transition-all">
              Open on Steam Market <ExternalLink size={16} />
            </a>
          </div>

          {(hasContents || containerLikely) && (
            <div className="lg:col-span-12 bg-[#11141d] p-5 md:p-6 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="text-sm font-medium text-gray-200">Contains</div>
                <div className="text-xs text-gray-500 font-medium">
                  {contains.length ? `${contains.length} items` : ''}
                  {contains.length && containsRare.length ? ' • ' : ''}
                  {containsRare.length ? `${containsRare.length} rare` : ''}
                  {(contains.length || containsRare.length) && crates.length ? ' • ' : ''}
                  {crates.length ? `${crates.length} crates` : ''}
                </div>
              </div>

              {contentsLoading ? (
                <div className="text-gray-500 text-[11px]">Loading contents...</div>
              ) : null}

              {crates.length > 0 && (
                <div className="mb-8">
                  <div className="text-xs font-medium text-gray-400 mb-3">Related Crates</div>
                  <ContentGrid items={crates} />
                </div>
              )}

              {contains.length > 0 && (
                <div className="mb-8">
                  <div className="text-xs font-medium text-gray-400 mb-3">Items</div>
                  <ContentGrid items={contains} />
                </div>
              )}

              {containsRare.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-400 mb-3">Rare Special Items</div>
                  <ContentGrid items={containsRare} />
                </div>
              )}

              {!contentsLoading && !hasContents ? (
                <div className="text-gray-500 text-[11px]">No contents data available for this item.</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
    </div>

    <ProUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Wishlist Limit Reached"
        message="You've reached the free tier limit of 10 wishlist items. Upgrade to Pro for unlimited wishlist items and access to advanced features."
        feature="Wishlist"
        limit={getWishlistLimitSync(false)}
        currentCount={wishlist.length}
      />
      
      {item && (
        <PriceTrackerModal
          isOpen={showTrackerModal}
          onClose={() => setShowTrackerModal(false)}
          item={{
            id: item.id || decodedId,
            name: item.name,
            image: item.image,
            market_hash_name: (item as any).market_hash_name,
          }}
          user={user}
          isPro={isPro}
          currency={currency}
        />
      )}
      
      <CompareModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        currentItem={item ? {
          id: item.id || decodedId,
          name: item.name,
          image: item.image,
          market_hash_name: (item as any).market_hash_name,
        } : undefined}
      />
      
      <ReportMissingItemModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        itemName={item?.name || decodedId}
        itemId={item?.id || decodedId}
        itemImage={item?.image}
      />
  </div>
  );
}

