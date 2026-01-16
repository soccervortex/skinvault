"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Search, Loader2, Tag, Disc, User, Package, Crosshair, Zap, Shield, Target, CheckCircle2, X, Scale, Trash2, Dices, Heart, Bell, Star, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import dynamic from 'next/dynamic';
import InstallPrompt from '@/app/components/InstallPrompt';

// Dynamic imports for modals to reduce initial bundle size
const PriceTrackerModal = dynamic(() => import('@/app/components/PriceTrackerModal'), {
  ssr: false,
});
const ProUpgradeModal = dynamic(() => import('@/app/components/ProUpgradeModal'), {
  ssr: false,
});
const SurpriseMeModal = dynamic(() => import('@/app/components/SurpriseMeModal'), {
  ssr: false,
});
import { ItemCardSkeleton } from '@/app/components/LoadingSkeleton';
import { loadWishlist, toggleWishlistEntry } from '@/app/utils/wishlist';
import { getWishlistLimitSync } from '@/app/utils/pro-limits';
import { checkProStatus } from '@/app/utils/proxy-utils';

type SortType =
  | 'rarity-desc'
  | 'rarity-asc'
  | 'alphabetical-asc'
  | 'alphabetical-desc'
  | 'weapon-az'
  | 'weapon-za';

const CATEGORIES = [
  { name: 'All Items', icon: <Tag size={14}/>, file: 'all', filter: 'all' },
  { name: 'Rifles', icon: <Crosshair size={14}/>, file: 'skins_not_grouped.json', filter: 'rifle' },
  { name: 'Sniper Rifles', icon: <Target size={14}/>, file: 'skins_not_grouped.json', filter: 'sniper' },
  { name: 'SMGs', icon: <Zap size={14}/>, file: 'skins_not_grouped.json', filter: 'smg' },
  { name: 'Pistols', icon: <Shield size={14}/>, file: 'skins_not_grouped.json', filter: 'pistol' },
  { name: 'Knives', icon: <Dices size={14}/>, file: 'skins_not_grouped.json', filter: 'knife' },
  { name: 'Agents', icon: <User size={14}/>, file: 'agents.json', filter: 'agent' },
  { name: 'Stickers', icon: <Disc size={14}/>, file: 'stickers.json', filter: 'sticker' },
  { name: 'Sticker Slabs', icon: <Disc size={14}/>, file: 'sticker_slabs.json', filter: 'sticker_slab' },
  { name: 'Crates', icon: <Package size={14}/>, file: 'crates.json', filter: 'crate' },
  { name: 'Collections', icon: <Package size={14}/>, file: 'collections.json', filter: 'collection' },
  { name: 'Crate Keys', icon: <Package size={14}/>, file: 'keys.json', filter: 'key' },
  { name: 'Patches', icon: <Tag size={14}/>, file: 'patches.json', filter: 'patch' },
  { name: 'Graffiti', icon: <Tag size={14}/>, file: 'graffiti.json', filter: 'graffiti' },
  { name: 'Music Kits', icon: <Tag size={14}/>, file: 'music_kits.json', filter: 'music_kit' },
  { name: 'Keychains', icon: <Tag size={14}/>, file: 'keychains.json', filter: 'keychain' },
  { name: 'Collectibles', icon: <Tag size={14}/>, file: 'collectibles.json', filter: 'collectible' },
];

const RARITY_ORDER: { [key: string]: number } = {
  'Covert': 1, 'Extraordinary': 1, 'Classified': 2, 'Restricted': 3, 
  'Mil-Spec Grade': 4, 'Mil-Spec': 4, 'Industrial Grade': 5, 'Industrial': 5,
  'Consumer Grade': 6, 'Consumer': 6, 'Base Grade': 7, 'Base': 7,
  'High Grade': 3, 'High': 3,
};

const CACHE_KEY = 'sv_dataset_cache_v1';
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12h

// Reviews Widget Component - ONLY for home page
function HomeReviewsWidget() {
  const [reviewsData, setReviewsData] = useState<{ aggregateRating: number | null; totalReviews: number } | null>(null);

  useEffect(() => {
    fetch('/api/reviews')
      .then(res => res.json())
      .then(data => {
        if (data.aggregateRating && data.totalReviews > 0) {
          setReviewsData(data);
        }
      })
      .catch(() => {});
  }, []);

  if (!reviewsData || !reviewsData.aggregateRating || reviewsData.totalReviews === 0) return null;

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={14}
        className={i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}
      />
    ));
  };

  return (
    <div className="mb-6 md:mb-8">
      <Link
        href="/reviews"
        className="block bg-[#11141d] border border-white/5 rounded-2xl p-4 md:p-6 hover:border-blue-500/30 transition-all"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <div className="text-3xl md:text-4xl font-black text-blue-500">
                {reviewsData.aggregateRating.toFixed(1)}
              </div>
              <div className="flex items-center gap-0.5 mt-1">
                {renderStars(reviewsData.aggregateRating)}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="text-sm md:text-base font-black uppercase">Customer Reviews</div>
              <div className="text-xs text-gray-500">
                Based on {reviewsData.totalReviews} reviews from Trustpilot & Sitejabber
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300">
            <span className="font-black uppercase">View All Reviews</span>
            <ExternalLink size={14} />
          </div>
        </div>
      </Link>
    </div>
  );
}

const SORT_OPTIONS: { id: SortType; label: string }[] = [
  { id: 'rarity-desc', label: 'Rarity ↓' },
  { id: 'rarity-asc', label: 'Rarity ↑' },
  { id: 'alphabetical-asc', label: 'Name A–Z' },
  { id: 'alphabetical-desc', label: 'Name Z–A' },
  { id: 'weapon-az', label: 'Weapon A–Z' },
  { id: 'weapon-za', label: 'Weapon Z–A' },
];

export default function GlobalSkinSearch() {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]);
  const [items, setItems] = useState<any[]>([]);
  const [allMarketItems, setAllMarketItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortType>('rarity-desc');
  
  const [compareList, setCompareList] = useState<any[]>([]);
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  const datasetCacheRef = useRef<Record<string, { data: any[]; timestamp: number }>>({});
  const [visibleCount, setVisibleCount] = useState(80);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const [user, setUser] = useState<any>(null);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackerModalItem, setTrackerModalItem] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSurpriseModal, setShowSurpriseModal] = useState(false);
  const [currency, setCurrency] = useState({ code: '3', symbol: '€' });

  // VEILIGE SYNC VOOR LOCALSTORAGE
  useEffect(() => {
    const updateStates = () => {
      if (typeof window === 'undefined') return;
      
      try {
        // Test localStorage accessibility first
        const testKey = '__localStorage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
        
        const savedInv = window.localStorage.getItem('user_inventory');
        let marketHashNames: string[] = [];
        
        if (savedInv) {
          const parsed = JSON.parse(savedInv);
          if (Array.isArray(parsed)) {
            // If it's an array of strings (market_hash_names), use as is
            // If it's an array of objects, extract market_hash_name
            marketHashNames = parsed.map((item: any) => 
              typeof item === 'string' ? item : (item.market_hash_name || item.market_name || item.name || '')
            ).filter(Boolean);
          } else if (parsed && typeof parsed === 'object') {
            // If it's an object, try to extract market_hash_names
            marketHashNames = Object.values(parsed).map((item: any) => 
              typeof item === 'string' ? item : (item?.market_hash_name || item?.market_name || item?.name || '')
            ).filter(Boolean);
          }
        }
        
        // Load user and wishlist
        const storedUser = window.localStorage.getItem('steam_user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        
        setOwnedItems(marketHashNames);
        
        setUser(parsedUser);
        
        if (parsedUser?.steamId) {
          setWishlist(loadWishlist(parsedUser.steamId));
          checkProStatus(parsedUser.steamId).then(setIsPro);
        }
        
        // Load currency
        const storedCurrency = window.localStorage.getItem('sv_currency');
        if (storedCurrency === '1') {
          setCurrency({ code: '1', symbol: '$' });
        } else if (storedCurrency === '3') {
          setCurrency({ code: '3', symbol: '€' });
        }
      } catch (e: any) {
        // Silently ignore localStorage errors (browser privacy settings, sandboxed iframe, etc.)
        // Don't log SecurityError to avoid console noise in production
      }
    };

    updateStates();
    window.addEventListener('storage', updateStates);
    return () => window.removeEventListener('storage', updateStates);
  }, []);

  // Hydrate dataset cache
  useEffect(() => {
    try {
      const cached = typeof window !== 'undefined' ? window.localStorage.getItem(CACHE_KEY) : null;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') datasetCacheRef.current = parsed;
      }
    } catch {
      datasetCacheRef.current = {};
    }
  }, []);

  const persistCache = () => {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(datasetCacheRef.current));
    } catch {
      /* ignore quota errors */
    }
  };

  const loadAllMarketItems = async (): Promise<any[]> => {
    const { API_FILES, BASE_URL, isItemExcluded } = await import('@/data/api-endpoints');
    let all: any[] = [];

    const allCached = API_FILES.every((file) => {
      const cached = datasetCacheRef.current[file];
      const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL;
      if (isFresh) {
        const filtered = cached.data.filter((item: any) => !isItemExcluded(item.id));
        all.push(...filtered);
        return true;
      }
      return false;
    });

    if (!allCached) {
      const fetchPromises = API_FILES.map(async (file) => {
        const cached = datasetCacheRef.current[file];
        const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL;
        if (isFresh) return cached.data;

        try {
          const res = await fetch(`${BASE_URL}/${file}`, { cache: 'force-cache' });
          const data = await res.json();
          const items = Array.isArray(data) ? data : Object.values(data);
          const filteredItems = items.filter((item: any) => !isItemExcluded(item.id));
          datasetCacheRef.current[file] = { data: filteredItems, timestamp: Date.now() };
          return filteredItems;
        } catch {
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      all = results.flat();
      persistCache();
    }

    // Load custom items and add them to the list
    try {
      const customRes = await fetch('/api/admin/custom-items');
      if (customRes.ok) {
        const customData = await customRes.json();
        if (customData.items && Array.isArray(customData.items)) {
          const formattedCustomItems = customData.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            market_hash_name: item.marketHashName || item.name,
            image: item.image || null,
            rarity: item.rarity ? { name: item.rarity } : null,
            weapon: item.weapon ? { name: item.weapon } : null,
            category: item.weapon ? { name: item.weapon } : null,
            isCustom: true,
          }));
          const existingIds = new Set(all.map((i: any) => i.id));
          formattedCustomItems.forEach((customItem: any) => {
            if (!existingIds.has(customItem.id)) all.push(customItem);
          });
        }
      }
    } catch {
      // ignore
    }

    return all;
  };

  const filterItems = (list: any[], cat: (typeof CATEGORIES)[number]) => {
    if (cat.file !== 'skins_not_grouped.json' || cat.filter === 'all') return list;
    return list.filter(i => {
      const weaponName = i.weapon?.name?.toLowerCase() || "";
      const catName = i.category?.name?.toLowerCase() || "";
      if (cat.filter === 'sniper') return weaponName.includes('awp') || weaponName.includes('ssg') || weaponName.includes('scar-20') || weaponName.includes('g3sg1');
      if (cat.filter === 'rifle') return (catName.includes('rifle') || weaponName.includes('ak-47') || weaponName.includes('m4a')) && !weaponName.includes('awp') && !weaponName.includes('ssg') && !weaponName.includes('scar-20') && !weaponName.includes('g3sg1');
      if (cat.filter === 'knife') return catName.includes('knife') || weaponName.includes('knife');
      return catName.includes(cat.filter) || weaponName.includes(cat.filter);
    });
  };

  // Fetch items with cache + abort safety
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      // If "All Items" category, load from all API files
      if (activeCat.file === 'all') {
        const { API_FILES, BASE_URL, isItemExcluded } = await import('@/data/api-endpoints');
        let allItems: any[] = [];
        
        // Check cache for all files
        const allCached = API_FILES.every(file => {
          const cached = datasetCacheRef.current[file];
          const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL;
          if (isFresh) {
            // Filter excluded items from cached data
            const filtered = cached.data.filter((item: any) => !isItemExcluded(item.id));
            allItems.push(...filtered);
            return true;
          }
          return false;
        });

        // If not all cached, fetch missing files
        if (!allCached) {
          const fetchPromises = API_FILES.map(async (file) => {
            const cached = datasetCacheRef.current[file];
            const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL;
            
            if (isFresh) {
              return cached.data;
            }
            
            try {
              const res = await fetch(`${BASE_URL}/${file}`, { cache: 'force-cache' });
              const data = await res.json();
              const items = Array.isArray(data) ? data : Object.values(data);
              // Filter out excluded items
              const { isItemExcluded } = await import('@/data/api-endpoints');
              const filteredItems = items.filter((item: any) => !isItemExcluded(item.id));
              datasetCacheRef.current[file] = { data: filteredItems, timestamp: Date.now() };
              return filteredItems;
            } catch {
              return [];
            }
          });
          
          const results = await Promise.all(fetchPromises);
          allItems = results.flat();
          persistCache();
        }

        // Load custom items and add them to the list
        try {
          const customRes = await fetch('/api/admin/custom-items');
          if (customRes.ok) {
            const customData = await customRes.json();
            if (customData.items && Array.isArray(customData.items)) {
              // Convert custom items to match API format
              const formattedCustomItems = customData.items.map((item: any) => ({
                id: item.id,
                name: item.name,
                market_hash_name: item.marketHashName || item.name,
                image: item.image || null,
                rarity: item.rarity ? { name: item.rarity } : null,
                weapon: item.weapon ? { name: item.weapon } : null,
                category: item.weapon ? { name: item.weapon } : null,
                isCustom: true,
              }));
              // Add custom items (avoid duplicates by checking ID)
              const existingIds = new Set(allItems.map((i: any) => i.id));
              formattedCustomItems.forEach((customItem: any) => {
                if (!existingIds.has(customItem.id)) {
                  allItems.push(customItem);
                }
              });
            }
          }
        } catch (error) {
          // Silently ignore custom items errors
          console.warn('Failed to load custom items:', error);
        }

        if (cancelled) return;
        setItems(filterItems(allItems, activeCat));
        setLoading(false);
        return;
      }

      // For specific categories, load from single file
      const cached = datasetCacheRef.current[activeCat.file];
      const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL;
      let rawItems: any[] | undefined = isFresh ? cached.data : undefined;

      if (!rawItems) {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/${activeCat.file}`, { cache: 'force-cache' });
          const data = await res.json();
          rawItems = Array.isArray(data) ? data : Object.values(data);
          // Filter out excluded items
          const { isItemExcluded } = await import('@/data/api-endpoints');
          rawItems = rawItems.filter((item: any) => !isItemExcluded(item.id));
          datasetCacheRef.current[activeCat.file] = { data: rawItems, timestamp: Date.now() };
          persistCache();
        } catch {
          rawItems = [];
        }
      }

      // Load custom items and add them to the list
      try {
        const customRes = await fetch('/api/admin/custom-items');
        if (customRes.ok) {
          const customData = await customRes.json();
          if (customData.items && Array.isArray(customData.items)) {
            // Convert custom items to match API format
            const formattedCustomItems = customData.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              market_hash_name: item.marketHashName || item.name,
              image: item.image || null,
              rarity: item.rarity ? { name: item.rarity } : null,
              weapon: item.weapon ? { name: item.weapon } : null,
              category: item.weapon ? { name: item.weapon } : null,
              isCustom: true,
            }));
            // Add custom items (avoid duplicates by checking ID)
            const existingIds = new Set((rawItems || []).map((i: any) => i.id));
            formattedCustomItems.forEach((customItem: any) => {
              if (!existingIds.has(customItem.id)) {
                rawItems = [...(rawItems || []), customItem];
              }
            });
          }
        }
      } catch (error) {
        // Silently ignore custom items errors
        console.warn('Failed to load custom items:', error);
      }

      if (cancelled) return;
      setItems(filterItems(rawItems || [], activeCat));
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [activeCat]);

  const openSurpriseModal = () => {
    setShowSurpriseModal(true);
    if (allMarketItems.length === 0) {
      void loadAllMarketItems()
        .then((all) => setAllMarketItems(all))
        .catch(() => {});
    }
  };

  const toggleCompare = (item: any) => {
    if (compareList.find(i => i.id === item.id)) {
      setCompareList(compareList.filter(i => i.id !== item.id));
    } else if (compareList.length < 2) {
      setCompareList([...compareList, item]);
    }
  };

  const processedItems = useMemo(() => {
    const searchWords = query.toLowerCase().trim().split(/\s+/);
    let result = items.filter((item) => {
      const name = String(item?.name || item?.market_hash_name || item?.market_name || '').toLowerCase();
      return searchWords.every((word) => name.includes(word));
    });

    return result.sort((a, b) => {
      if (sortBy === 'rarity-desc') {
        const rarityA = (a.rarity?.name || '').trim();
        const rarityB = (b.rarity?.name || '').trim();
        const orderA = RARITY_ORDER[rarityA] || RARITY_ORDER[rarityA.toLowerCase()] || 99;
        const orderB = RARITY_ORDER[rarityB] || RARITY_ORDER[rarityB.toLowerCase()] || 99;
        if (orderA !== orderB) return orderA - orderB;
        // If same rarity order, sort by name
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'rarity-asc') {
        const rarityA = (a.rarity?.name || '').trim();
        const rarityB = (b.rarity?.name || '').trim();
        const orderA = RARITY_ORDER[rarityA] || RARITY_ORDER[rarityA.toLowerCase()] || 99;
        const orderB = RARITY_ORDER[rarityB] || RARITY_ORDER[rarityB.toLowerCase()] || 99;
        if (orderA !== orderB) return orderB - orderA;
        // If same rarity order, sort by name
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'alphabetical-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'alphabetical-desc') {
        return b.name.localeCompare(a.name);
      }
      const weaponA = (a.weapon?.name || a.name || '').toLowerCase();
      const weaponB = (b.weapon?.name || b.name || '').toLowerCase();
      if (sortBy === 'weapon-az') {
        return weaponA.localeCompare(weaponB);
      }
      if (sortBy === 'weapon-za') {
        return weaponB.localeCompare(weaponA);
      }
      return 0;
    });
  }, [items, query, sortBy]);

  // Reset visible window when the dataset changes
  useEffect(() => {
    setVisibleCount(Math.min(80, processedItems.length || 0));
  }, [processedItems]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const rootEl = scrollRootRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 60, processedItems.length));
        }
      },
      { root: rootEl, rootMargin: '600px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [processedItems.length]);

  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar categories={CATEGORIES} activeCat={activeCat} setActiveCat={setActiveCat} />
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Compare Bar */}
        {compareList.length > 0 && (
          <div className="fixed bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-[#11141d]/95 backdrop-blur-2xl border border-blue-500/30 p-3 md:p-5 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center gap-4 md:gap-8 shadow-2xl max-w-[calc(100vw-2rem)]">
            <div className="flex gap-2 md:gap-4">
              {compareList.map(i => (
                <div key={i.id} className="relative bg-black/40 p-1.5 md:p-2 rounded-xl md:rounded-2xl border border-white/5">
                   <Image src={i.image} width={48} height={48} className="w-8 h-8 md:w-12 md:h-12 object-contain" alt={i.name ? `${i.name} - CS2 Skin Portfolio Dashboard Analytics` : "CS2 Skin Category Icon"} unoptimized />
                   <button onClick={() => toggleCompare(i)} className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-red-500 rounded-full p-0.5 md:p-1" aria-label={`Remove ${i.name} from compare`}><X size={8} /></button>
                </div>
              ))}
            </div>
            {compareList.length === 2 && (
              <Link href={`/compare?id1=${compareList[0].id}&id2=${compareList[1].id}`} className="bg-blue-600 px-4 md:px-8 py-2.5 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all whitespace-nowrap">Duel Skins</Link>
            )}
            <button onClick={() => setCompareList([])} className="text-gray-500 hover:text-white shrink-0" aria-label="Clear compare list"><Trash2 size={16} /></button>
          </div>
        )}

        <header className="p-3 md:p-4 lg:p-8 border-b border-white/5 bg-[#08090d] flex flex-col xl:flex-row gap-3 md:gap-4 lg:gap-6 items-center">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={14} />
            <label htmlFor="main-search" className="sr-only">Search all skins</label>
            <input id="main-search" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-[#11141d] border border-white/5 rounded-xl md:rounded-2xl py-3 md:py-4 pl-12 md:pl-14 pr-4 md:pr-6 text-[10px] md:text-xs outline-none focus:border-blue-500 transition-all" placeholder="Search all skins..." />
          </div>
          
          <div className="flex items-center gap-2 md:gap-3 w-full xl:w-auto justify-between xl:justify-end">
            <button onClick={openSurpriseModal} className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 lg:py-3 rounded-lg md:rounded-xl text-[7px] md:text-[8px] lg:text-[9px] font-black uppercase border border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500 hover:text-black transition-all whitespace-nowrap shrink-0">
              <Dices size={12} />
              <span className="hidden sm:inline">Surprise Me</span>
              <span className="sm:hidden">Random</span>
            </button>
            <div className="hidden md:block h-6 w-[1px] bg-white/10 mx-2" />
            <div className="flex-1 xl:flex-none overflow-x-auto -mx-2 px-2">
              <div className="flex gap-1.5 md:gap-2 lg:gap-3 min-w-max">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSortBy(opt.id)}
                    className={`px-3 md:px-4 lg:px-5 py-1.5 md:py-2 lg:py-3 rounded-lg md:rounded-xl text-[7px] md:text-[8px] lg:text-[9px] font-black uppercase border transition-all shrink-0 ${
                      sortBy === opt.id
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                        : 'bg-[#11141d] border-white/5 text-gray-500 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main ref={scrollRootRef} id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar scroll-smooth">
          {/* SEO-optimized heading structure for AI crawlers */}
          <h1 className="sr-only">CS2 Inventory Tracker - The Ultimate Skin Valuation Tool</h1>
          <div className="mb-6 md:mb-8 text-center">
            <h2 className="text-[11px] md:text-xs lg:text-sm font-black uppercase tracking-[0.3em] text-gray-400 mb-2">
              CS2 Skin Analytics & Market Valuation
            </h2>
            <p className="text-[9px] md:text-[10px] text-gray-500 max-w-2xl mx-auto">
              Track your CS2 skin collection, monitor prices, and analyze your inventory value. 
              <span className="block mt-1">Safe, secure, and read-only. Uses official Steam OpenID authentication.</span>
            </p>
          </div>

          {/* Reviews Widget - ONLY on home page */}
          <HomeReviewsWidget />

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
              {Array.from({ length: 20 }).map((_, i) => (
                <ItemCardSkeleton key={i} />
              ))}
            </div>
          ) : processedItems.length === 0 && query.trim() ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/10 rounded-[2.5rem] bg-black/20">
              <Search className="text-gray-600 mb-4" size={32} />
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                No items found
              </p>
              <p className="text-[10px] text-gray-600 mb-6 max-w-md">
                We couldn't find any items matching "{query}". Try a different search term or check the spelling.
              </p>
              <Link
                href="/report-item"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-black uppercase tracking-widest transition-all"
              >
                <AlertTriangle size={16} />
                Report Missing Item
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
              {processedItems.slice(0, visibleCount).map((item) => {
                // Check if item is owned by comparing market_hash_name, id, or name
                const normalize = (str: string | undefined | null): string => {
                  if (!str) return '';
                  return str.toString().toLowerCase().trim();
                };
                
                const itemMarketHash = normalize(item.market_hash_name);
                const itemId = normalize(item.id);
                const itemName = normalize(item.name);
                
                const isOwned = ownedItems.length > 0 && ownedItems.some(owned => {
                  if (!owned) return false;
                  const ownedLower = normalize(owned);
                  if (!ownedLower) return false;
                  
                  // Check exact matches (case-insensitive, trimmed)
                  if (itemMarketHash && ownedLower === itemMarketHash) return true;
                  if (itemId && ownedLower === itemId) return true;
                  if (itemName && ownedLower === itemName) return true;
                  
                  // Check if names match when normalized (remove special chars for comparison)
                  const normalizeStrict = (s: string) => s.replace(/[^a-z0-9]/g, '');
                  if (itemMarketHash && normalizeStrict(ownedLower) === normalizeStrict(itemMarketHash)) return true;
                  if (itemName && normalizeStrict(ownedLower) === normalizeStrict(itemName)) return true;
                  
                  return false;
                });
                const rarityColor = item.rarity?.color || "#4b5563";

                return (
                  <div key={item.id} className={`bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] lg:rounded-[2.5rem] transition-[border-color,transform] duration-300 group relative flex flex-col border ${isOwned ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/5 hover:border-blue-500/40'}`}>
                    {isOwned && (
                      <div className="absolute top-2 md:top-3 lg:top-4 left-2 md:left-3 lg:left-4 z-50 flex items-center gap-1 md:gap-1.5 bg-emerald-500 px-2 md:px-3 py-1 md:py-1.5 rounded-full shadow-lg">
                        <CheckCircle2 size={8} className="text-white" />
                        <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-white">Owned</span>
                      </div>
                    )}
                    <div className="absolute top-2 md:top-3 lg:top-4 right-2 md:right-3 lg:right-4 z-20 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Compare Button */}
                      <button 
                        onClick={() => toggleCompare(item)} 
                        className={`p-2 md:p-2.5 rounded-lg md:rounded-xl border bg-black/60 backdrop-blur-md transition-[color,border-color,transform] flex items-center justify-center ${compareList.find(i => i.id === item.id) ? 'text-blue-500 border-blue-500' : 'text-white border-white/10 hover:text-blue-500'}`} 
                        title="Add to Compare"
                        aria-label={compareList.find(i => i.id === item.id) ? 'Remove from compare' : 'Add to compare'}
                      >
                        <Scale size={12} />
                      </button>
                      
                      {/* Price Tracker Button - Only show if logged in */}
                      {user?.steamId && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setTrackerModalItem({
                                id: item.id,
                                name: item.name,
                                image: item.image,
                                market_hash_name: item.market_hash_name,
                              });
                              setShowTrackerModal(true);
                            }}
                            className="p-2 md:p-2.5 rounded-lg md:rounded-xl border bg-black/60 backdrop-blur-md transition-all text-white border-white/10 hover:text-purple-500 hover:border-purple-500 flex items-center justify-center"
                            title="Price Tracker"
                            aria-label="Set price tracker"
                          >
                            <Bell size={12} />
                          </button>
                          
                          {/* Wishlist Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const isWishlisted = wishlist.some(w => w.market_hash_name === item.market_hash_name || w.key === item.id);
                              const result = toggleWishlistEntry(
                                {
                                  key: item.id,
                                  name: item.name,
                                  image: item.image,
                                  market_hash_name: item.market_hash_name,
                                  rarityName: item.rarity?.name,
                                  rarityColor: item.rarity?.color,
                                  weaponName: item.weapon?.name,
                                },
                                user.steamId,
                                isPro,
                              );
                              if (result.success) {
                                setWishlist(result.newList);
                              } else if (result.reason === 'limit_reached') {
                                setShowUpgradeModal(true);
                              }
                            }}
                            className={`p-2 md:p-2.5 rounded-lg md:rounded-xl border bg-black/60 backdrop-blur-md transition-all flex items-center justify-center ${
                              wishlist.some(w => w.market_hash_name === item.market_hash_name || w.key === item.id)
                                ? 'text-rose-500 border-rose-500'
                                : 'text-white border-white/10 hover:text-rose-500 hover:border-rose-500'
                            }`}
                            title={wishlist.some(w => w.market_hash_name === item.market_hash_name || w.key === item.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                            aria-label={wishlist.some(w => w.market_hash_name === item.market_hash_name || w.key === item.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                          >
                            <Heart 
                              size={12} 
                              className={wishlist.some(w => w.market_hash_name === item.market_hash_name || w.key === item.id) ? 'fill-current' : ''} 
                            />
                          </button>
                        </>
                      )}
                    </div>
                    <Link href={`/item/${encodeURIComponent(item.id)}`} prefetch={false} className="flex-1">
                      <div className="aspect-square bg-black/20 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center p-3 md:p-4 mb-3 md:mb-4 relative overflow-hidden">
                        <div className="absolute inset-0 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: rarityColor }} />
                        <Image 
                          src={item.image} 
                          width={384} 
                          height={384} 
                          className="w-full h-full object-contain relative z-10 group-hover:scale-110 transition-transform duration-500" 
                          style={{ transform: 'translateZ(0)' }}
                          alt={item.name ? `${item.name} - CS2 Skin Portfolio Dashboard Analytics` : "CS2 Skin Image"}
                          loading="lazy"
                          unoptimized
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                        />
                      </div>
                      <p className="text-[9px] md:text-[10px] font-black uppercase truncate tracking-widest text-white/90">{item.name}</p>
                      <p className="text-[7px] md:text-[8px] font-black mt-1 md:mt-2 opacity-80 uppercase" style={{color: rarityColor}}>{item.rarity?.name || 'Standard'}</p>
                    </Link>
                  </div>
                );
              })}
              <div ref={sentinelRef} className="h-4 col-span-full" />
            </div>
          )}
        </main>
      </div>
      
      {showTrackerModal && trackerModalItem && user && (
        <PriceTrackerModal
          isOpen={showTrackerModal}
          onClose={() => {
            setShowTrackerModal(false);
            setTrackerModalItem(null);
          }}
          item={trackerModalItem}
          user={user}
          isPro={isPro}
          currency={currency}
        />
      )}
      
      <ProUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Wishlist Limit Reached"
        message="You've reached the free tier limit of 10 wishlist items. Upgrade to Pro for unlimited wishlist items and access to advanced features."
        feature="Wishlist"
        limit={getWishlistLimitSync(false)}
        currentCount={wishlist.length}
      />

      <SurpriseMeModal
        isOpen={showSurpriseModal}
        onClose={() => setShowSurpriseModal(false)}
        allItems={allMarketItems.length ? allMarketItems : items}
      />

      <InstallPrompt />
    </div>
  );
}