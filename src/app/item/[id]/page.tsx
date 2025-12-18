"use client";
import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, TrendingUp, ExternalLink, Box, Image as ImageIcon, Info, Loader2, ShieldCheck, Tag, BarChart3, Coins, Heart } from 'lucide-react';
import Link from 'next/link';
import { loadWishlist, toggleWishlistEntry, WishlistEntry } from '@/app/utils/wishlist';

const API_FILES = ['skins_not_grouped.json', 'crates.json', 'stickers.json', 'agents.json'];
const DATASET_CACHE_KEY = 'sv_dataset_cache_v1';
const DATASET_CACHE_TTL = 1000 * 60 * 60 * 12; // 12h
const PRICE_CACHE_KEY = 'sv_price_cache_item_v1';

export default function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
  // In app router client components, params is a Promise – unwrap via React.use
  const unwrappedParams = React.use(params as any) as { id: string };
  const { id } = unwrappedParams;
  const decodedId = decodeURIComponent(id);
  
  const [item, setItem] = useState<any>(null);
  const [priceData, setPriceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState({ code: '3', symbol: '€' }); // Default Euro
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [rotation, setRotation] = useState(0);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [user, setUser] = useState<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const datasetCacheRef = useRef<Record<string, { data: any[]; timestamp: number }>>({});
  const priceCacheRef = useRef<Record<string, any>>({});
  const [priceDone, setPriceDone] = useState(false);

  // Shared proxy rotation for Steam price API
  const PROXY_LIST = [
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
    // extra generic proxies (no account)
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  const fetchWithRotation = async (steamUrl: string) => {
    const attempts = PROXY_LIST.map(async (buildUrl, index) => {
      try {
        const proxyUrl = buildUrl(steamUrl);
        const res = await fetch(proxyUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Proxy ${index} status ${res.status}`);

        let data: any;
        const text = await res.text();

        try {
          const json = JSON.parse(text);
          const wrapped = (json as any).contents;
          data = typeof wrapped === 'string' ? JSON.parse(wrapped) : (wrapped || json);
        } catch {
          // raw JSON from /raw or similar
          data = JSON.parse(text);
        }

        if (data && (data.success || data.lowest_price || data.median_price)) {
          return data;
        }
        throw new Error(`Proxy ${index} no price data`);
      } catch (e) {
        console.warn(`Price proxy ${index} failed`, e);
        throw e;
      }
    });

    try {
      // return first successful proxy, ignore others
      // @ts-ignore Promise.any is available in modern runtimes
      return await Promise.any(attempts);
    } catch {
      return null;
    }
  };

  // Hydrate dataset + price caches + wishlist once on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
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

  // Fetch item meta once (by id)
  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true);
      let foundItem: any = null;

      for (const file of API_FILES) {
        try {
          // Try cache first
          const cached = datasetCacheRef.current[file];
          const fresh = cached && Date.now() - cached.timestamp < DATASET_CACHE_TTL;
          let itemArray: any[];

          if (fresh) {
            itemArray = cached.data;
          } else {
            const res = await fetch(`https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/${file}`, { cache: 'force-cache' });
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

      setItem(foundItem);
      setLoading(false);
    };

    fetchItem();
  }, [decodedId]);

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

      const data = await fetchWithRotation(steamUrl);
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
  }, [item, currency.code]);

  // Simple 3D spin animation when in 3D view
  useEffect(() => {
    if (viewMode !== '3D') {
      setRotation(0);
      return;
    }

    let frameId: number;
    let last = performance.now();

    const animate = (time: number) => {
      const delta = time - last;
      last = time;
      // ~360deg every 6 seconds
      setRotation((prev) => (prev + delta * 0.06) % 360);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [viewMode]);

  if (loading) return <div className="min-h-screen bg-[#08090d] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

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
    <div className="min-h-screen bg-[#08090d] text-white p-6 md:p-12 font-sans flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <div className="flex justify-between items-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all">
            <ChevronLeft size={14} /> Back
          </Link>
          
          <div className="flex items-center gap-3">
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
            <div className="flex bg-[#11141d] p-1 rounded-2xl border border-white/5">
              <button
                onClick={() => {
                  setCurrency({ code: '3', symbol: '€' });
                  try {
                    if (typeof window !== 'undefined') window.localStorage.setItem('sv_currency', '3');
                  } catch {
                    /* ignore */
                  }
                }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${currency.code === '3' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
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
                className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${currency.code === '1' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
              >
                USD
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <div
              ref={cardRef}
              className="bg-[#11141d] rounded-[3.5rem] aspect-square border border-white/5 flex items-center justify-center relative overflow-hidden shadow-2xl"
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
              <button
                onClick={() => {
                  const next = toggleWishlistEntry(
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
                  );
                  setWishlist(next);
                }}
                className="absolute bottom-4 right-4 md:hidden inline-flex items-center justify-center p-2.5 rounded-2xl border border-white/10 bg-black/60 hover:border-rose-500 hover:bg-rose-500/10 transition-all z-20"
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart
                  size={16}
                  className={isWishlisted ? 'text-rose-500 fill-rose-500' : 'text-gray-400'}
                />
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-6xl font-black italic uppercase text-white tracking-tighter">{item?.name}</h1>
              <button
                onClick={() => {
                  const next = toggleWishlistEntry(
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
                  );
                  setWishlist(next);
                }}
                className="hidden md:inline-flex items-center justify-center p-3 rounded-2xl border border-white/10 bg-black/40 hover:border-rose-500 hover:bg-rose-500/10 transition-all"
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart
                  size={18}
                  className={isWishlisted ? 'text-rose-500 fill-rose-500' : 'text-gray-500'}
                />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-[#11141d] p-8 rounded-[3rem] border border-white/5 relative overflow-hidden">
                <span className="text-[10px] font-black text-gray-500 uppercase block mb-2">Current Value</span>
                <p className="text-4xl font-black text-green-400 italic">
                  {priceData?.lowest
                    ? priceData.lowest
                    : priceDone
                      ? <span className="text-[14px] text-gray-500">NO PRICE</span>
                      : <span className="text-[14px] text-gray-500 animate-pulse">SCANNING...</span>}
                </p>
                <TrendingUp className="absolute right-6 bottom-6 text-green-500/5 w-20 h-20" />
              </div>
              <div className="bg-[#11141d] p-8 rounded-[3rem] border border-white/5 relative">
                <span className="text-[10px] font-black text-gray-500 uppercase block mb-2">24h Median</span>
                <p className="text-4xl font-black text-white/90 italic">
                  {priceData?.median
                    ? priceData.median
                    : priceDone
                      ? <span className="text-[14px] text-gray-500">NO PRICE</span>
                      : <span className="text-[14px] text-gray-500 animate-pulse">SCANNING...</span>}
                </p>
                <BarChart3 className="absolute right-6 bottom-6 text-white/5 w-20 h-20" />
              </div>
            </div>

            <a href={`https://steamcommunity.com/market/listings/730/${encodeURIComponent(item?.market_hash_name)}`} target="_blank" className="flex items-center justify-center gap-4 w-full py-8 bg-blue-600 hover:bg-blue-500 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-widest transition-all">
              Trade on Steam Market <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}