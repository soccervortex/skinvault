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
    if (initialItem) return; // Skip if we already have the item
    
    const fetchItem = async () => {
      setLoading(true);
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

      setItem(foundItem);
      setLoading(false);
    };

    fetchItem();
  }, [decodedId, initialItem]);

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
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-12 custom-scrollbar">
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
          <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Item not found</p>
          <p className="text-sm text-gray-400">This skin could not be loaded from the CS:GO API dataset.</p>
        </div>
      </div>
    );
  }

  const rarityColor = item?.rarity?.color || '#3b82f6';
  const wishlistKey = (item as any).market_hash_name || item.name || decodedId;
  const steamId = user?.steamId || null;
  const isWishlisted = wishlist.some((w) => w.key === wishlistKey);

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-12 custom-scrollbar">
          <div className="w-full max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6 md:mb-10 gap-4">
              <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-white font-bold text-[9px] md:text-[10px] uppercase tracking-widest transition-all shrink-0">
                <ChevronLeft size={12} /> <span className="hidden sm:inline">Back</span>
              </Link>
              
              <div className="flex items-center gap-2 md:gap-3">
                {/* VIEW MODE SWITCHER */}
                <div className="hidden md:flex bg-[#11141d] p-1 rounded-2xl border border-white/5">
                  <button
                    onClick={() => setViewMode('2D')}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                      viewMode === '2D' ? 'bg-white text-black' : 'text-gray-500'
                    }`}
                  >
                    2D
                  </button>
                  <button
                    onClick={() => setViewMode('3D')}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                      viewMode === '3D' ? 'bg-blue-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    3D
                  </button>
                </div>

                {/* CURRENCY SWITCHER */}
                <div className="flex bg-[#11141d] p-1 rounded-xl md:rounded-2xl border border-white/5">
                  <button
                    onClick={() => {
                      setCurrency({ code: '3', symbol: '€' });
                      try {
                        if (typeof window !== 'undefined') window.localStorage.setItem('sv_currency', '3');
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black transition-all ${currency.code === '3' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
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
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black transition-all ${currency.code === '1' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                  >
                    USD
                  </button>
                </div>
              </div>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-12 items-start">
            <div className="lg:col-span-5">
              <div
                ref={cardRef}
                className="bg-[#11141d] rounded-[2rem] md:rounded-[3.5rem] aspect-square border border-white/5 flex items-center justify-center relative overflow-hidden shadow-2xl"
                style={{ perspective: '1200px' }}
              >
              <div className="absolute inset-0 opacity-20 blur-[120px]" style={{ backgroundColor: rarityColor }} />
              <img
                src={item?.image}
                className="w-[80%] h-auto object-contain z-10"
                alt={item?.name || ''}
                style={{
                  transform: viewMode === '3D' ? `rotateY(${rotation}deg)` : 'rotateY(0deg)',
                  transformStyle: 'preserve-3d',
                  transition: viewMode === '2D' ? 'transform 0.4s ease-out' : undefined,
                }}
              />
              <div className="absolute top-4 right-4 flex bg-black/40 rounded-2xl border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] overflow-hidden md:hidden z-20">
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
                  3D
                </button>
              </div>
              <div className="absolute bottom-4 left-4 right-4 hidden md:flex items-center justify-center gap-2 bg-black/40 rounded-2xl border border-white/10 p-2 z-20">
                <button
                  onClick={() => setViewMode('2D')}
                  className={`px-4 py-2 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest ${viewMode === '2D' ? 'bg-white text-black' : 'text-gray-400'}`}
                >
                  2D View
                </button>
                <button
                  onClick={() => setViewMode('3D')}
                  className={`px-4 py-2 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest ${viewMode === '3D' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                  3D View
                </button>
              </div>
            </div>
            <div className="mt-4 md:mt-6 flex flex-wrap items-center gap-2 md:gap-3">
              <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-[#11141d] border border-white/5">
                <Tag size={12} className="text-gray-400" />
                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-400">{item?.rarity?.name || 'Standard'}</span>
              </div>
              {item?.weapon?.name && (
                <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-[#11141d] border border-white/5">
                  <Box size={12} className="text-gray-400" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-400">{item.weapon.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-[#11141d] border border-white/5">
                <ShieldCheck size={12} className="text-green-400" />
                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-green-400">Verified</span>
              </div>
              <div className="md:hidden flex-1 flex justify-end gap-2">
                {/* Report Button (Mobile) */}
                <button
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center justify-center p-2.5 min-h-[44px] rounded-2xl border border-white/10 bg-black/60 hover:border-yellow-500 hover:bg-yellow-500/10 transition-all"
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
                  className="inline-flex items-center justify-center p-2.5 min-h-[44px] rounded-2xl border border-white/10 bg-black/60 hover:border-rose-500 hover:bg-rose-500/10 transition-all"
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

            <div className="lg:col-span-7 space-y-6 md:space-y-8">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black italic uppercase text-white tracking-tighter leading-tight">{item?.name}</h1>
              <div className="flex items-center gap-2">
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
                  className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-white/10 bg-black/40 hover:border-blue-500 hover:bg-blue-500/10 transition-all shrink-0 min-h-[44px]"
                  aria-label="Compare items"
                >
                  <Scale size={18} className="text-blue-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Compare</span>
                </button>
                {/* Report Missing Item Button */}
                <button
                  onClick={() => setShowReportModal(true)}
                  className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-white/10 bg-black/40 hover:border-yellow-500 hover:bg-yellow-500/10 transition-all shrink-0 min-h-[44px]"
                  aria-label="Report missing item"
                >
                  <AlertTriangle size={18} className="text-yellow-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400">Report</span>
                </button>
                {/* Price Tracker Button */}
                {user && (
                  <button
                    onClick={() => setShowTrackerModal(true)}
                    className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-white/10 bg-black/40 hover:border-blue-500 hover:bg-blue-500/10 transition-all shrink-0 min-h-[44px]"
                    aria-label="Set price tracker"
                  >
                    <Bell size={18} className="text-blue-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Tracker</span>
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
                  className="hidden md:inline-flex items-center justify-center p-3 rounded-2xl border border-white/10 bg-black/40 hover:border-rose-500 hover:bg-rose-500/10 transition-all shrink-0 min-h-[44px]"
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart
                    size={18}
                    className={isWishlisted ? 'text-rose-500 fill-rose-500' : 'text-gray-500'}
                  />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
              <div className="bg-[#11141d] p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-white/5 relative overflow-hidden">
                <span className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase block mb-2">Current Value</span>
                <p className="text-3xl md:text-4xl font-black text-green-400 italic">
                  {priceData?.lowest
                    ? priceData.lowest
                    : priceDone
                      ? <span className="text-[12px] md:text-[14px] text-gray-500">NO PRICE</span>
                      : <span className="text-[12px] md:text-[14px] text-gray-500 animate-pulse">SCANNING...</span>}
                </p>
                <TrendingUp className="absolute right-4 md:right-6 bottom-4 md:bottom-6 text-green-500/5 w-16 h-16 md:w-20 md:h-20" />
              </div>
              <div className="bg-[#11141d] p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-white/5 relative">
                <span className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase block mb-2">24h Median</span>
                <p className="text-3xl md:text-4xl font-black text-white/90 italic">
                  {priceData?.median
                    ? priceData.median
                    : priceDone
                      ? <span className="text-[12px] md:text-[14px] text-gray-500">NO PRICE</span>
                      : <span className="text-[12px] md:text-[14px] text-gray-500 animate-pulse">SCANNING...</span>}
                </p>
                <BarChart3 className="absolute right-4 md:right-6 bottom-4 md:bottom-6 text-white/5 w-16 h-16 md:w-20 md:h-20" />
              </div>
            </div>

            <a href={`https://steamcommunity.com/market/listings/730/${encodeURIComponent(item?.market_hash_name)}`} target="_blank" className="flex items-center justify-center gap-3 md:gap-4 w-full py-6 md:py-8 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] md:rounded-[2.5rem] font-black text-[10px] md:text-xs uppercase tracking-widest transition-all">
              Trade on Steam Market <ExternalLink size={16} />
            </a>
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
      </div>
  );
}

