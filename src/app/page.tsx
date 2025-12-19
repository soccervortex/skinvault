"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Loader2, Tag, Disc, User, Package, Crosshair, Zap, Shield, Target, CheckCircle2, X, Scale, Trash2, Dices } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';

type SortType = 'rarity-desc' | 'rarity-asc' | 'alphabetical' | 'weapon';

const CATEGORIES = [
  { name: 'All Skins', icon: <Tag size={14}/>, file: 'skins_not_grouped.json', filter: 'all' },
  { name: 'Rifles', icon: <Crosshair size={14}/>, file: 'skins_not_grouped.json', filter: 'rifle' },
  { name: 'Sniper Rifles', icon: <Target size={14}/>, file: 'skins_not_grouped.json', filter: 'sniper' },
  { name: 'SMGs', icon: <Zap size={14}/>, file: 'skins_not_grouped.json', filter: 'smg' },
  { name: 'Pistols', icon: <Shield size={14}/>, file: 'skins_not_grouped.json', filter: 'pistol' },
  { name: 'Agents', icon: <User size={14}/>, file: 'agents.json', filter: 'agent' },
  { name: 'Stickers', icon: <Disc size={14}/>, file: 'stickers.json', filter: 'sticker' },
  { name: 'Crates', icon: <Package size={14}/>, file: 'crates.json', filter: 'crate' },
];

const RARITY_ORDER: { [key: string]: number } = {
  'Covert': 1, 'Extraordinary': 1, 'Classified': 2, 'Restricted': 3, 
  'Mil-Spec Grade': 4, 'Industrial Grade': 5, 'Consumer Grade': 6,
};

const CACHE_KEY = 'sv_dataset_cache_v1';
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12h

export default function GlobalSkinSearch() {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortType>('rarity-desc');
  
  const [compareList, setCompareList] = useState<any[]>([]);
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  const datasetCacheRef = useRef<Record<string, { data: any[]; timestamp: number }>>({});
  const [visibleCount, setVisibleCount] = useState(80);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // VEILIGE SYNC VOOR LOCALSTORAGE
  useEffect(() => {
    const updateStates = () => {
      if (typeof window === 'undefined') return;
      
      try {
        const savedInv = window.localStorage.getItem('user_inventory');
        if (savedInv) {
          const parsed = JSON.parse(savedInv);
          setOwnedItems(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        console.warn("LocalStorage access denied by browser:", e);
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

  const filterItems = (list: any[], cat: (typeof CATEGORIES)[number]) => {
    if (cat.file !== 'skins_not_grouped.json' || cat.filter === 'all') return list;
    return list.filter(i => {
      const weaponName = i.weapon?.name?.toLowerCase() || "";
      const catName = i.category?.name?.toLowerCase() || "";
      if (cat.filter === 'sniper') return weaponName.includes('awp') || weaponName.includes('ssg') || weaponName.includes('scar-20') || weaponName.includes('g3sg1');
      if (cat.filter === 'rifle') return (catName.includes('rifle') || weaponName.includes('ak-47') || weaponName.includes('m4a')) && !weaponName.includes('awp') && !weaponName.includes('ssg') && !weaponName.includes('scar-20') && !weaponName.includes('g3sg1');
      return catName.includes(cat.filter) || weaponName.includes(cat.filter);
    });
  };

  // Fetch items with cache + abort safety
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      const cached = datasetCacheRef.current[activeCat.file];
      const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL;
      let rawItems: any[] | undefined = isFresh ? cached.data : undefined;

      if (!rawItems) {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/${activeCat.file}`, { cache: 'force-cache' });
          const data = await res.json();
          rawItems = Array.isArray(data) ? data : Object.values(data);
          datasetCacheRef.current[activeCat.file] = { data: rawItems, timestamp: Date.now() };
          persistCache();
        } catch {
          rawItems = [];
        }
      }

      if (cancelled) return;
      setItems(filterItems(rawItems || [], activeCat));
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [activeCat]);

  const goToRandomSkin = () => {
    if (items.length === 0) return;
    const randomIndex = Math.floor(Math.random() * items.length);
    router.push(`/item/${items[randomIndex].id}`);
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
    let result = items.filter(item => searchWords.every(word => item.name.toLowerCase().includes(word)));

    return result.sort((a, b) => {
      if (sortBy === 'rarity-desc') return (RARITY_ORDER[a.rarity?.name] || 99) - (RARITY_ORDER[b.rarity?.name] || 99);
      if (sortBy === 'rarity-asc') return (RARITY_ORDER[b.rarity?.name] || 99) - (RARITY_ORDER[a.rarity?.name] || 99);
      if (sortBy === 'alphabetical') return a.name.localeCompare(b.name);
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

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 60, processedItems.length));
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [processedItems.length]);

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar categories={CATEGORIES} activeCat={activeCat} setActiveCat={setActiveCat} />
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Compare Bar */}
        {compareList.length > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-[#11141d]/95 backdrop-blur-2xl border border-blue-500/30 p-5 rounded-[2.5rem] flex items-center gap-8 shadow-2xl">
            <div className="flex gap-4">
              {compareList.map(i => (
                <div key={i.id} className="relative bg-black/40 p-2 rounded-2xl border border-white/5">
                   <img src={i.image} className="w-12 h-12 object-contain" alt="" />
                   <button onClick={() => toggleCompare(i)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"><X size={10}/></button>
                </div>
              ))}
            </div>
            {compareList.length === 2 && (
              <Link href={`/compare?id1=${compareList[0].id}&id2=${compareList[1].id}`} className="bg-blue-600 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all">Duel Skins</Link>
            )}
            <button onClick={() => setCompareList([])} className="text-gray-500 hover:text-white"><Trash2 size={18}/></button>
          </div>
        )}

        <header className="p-8 border-b border-white/5 bg-[#08090d] flex flex-col xl:flex-row gap-6 items-center">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={16}/>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-[#11141d] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-xs outline-none focus:border-blue-500 transition-all" placeholder="Search all skins..." />
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={goToRandomSkin} className="flex items-center gap-2 px-5 py-3 rounded-xl text-[9px] font-black uppercase border border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500 hover:text-black transition-all">
              <Dices size={14} />
              Surprise Me
            </button>
            <div className="h-6 w-[1px] bg-white/10 mx-2" />
            {['rarity-desc', 'alphabetical'].map((opt) => (
              <button key={opt} onClick={() => setSortBy(opt as SortType)} className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${sortBy === opt ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-[#11141d] border-white/5 text-gray-500 hover:text-white'}`}>{opt.split('-')[0]}</button>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 custom-scrollbar scroll-smooth">
          {loading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6">
              {processedItems.slice(0, visibleCount).map((item) => {
                const isOwned = ownedItems.includes(item.market_hash_name);
                const rarityColor = item.rarity?.color || "#4b5563";

                return (
                  <div key={item.id} className={`bg-[#11141d] p-5 rounded-[2.5rem] transition-all duration-300 group relative flex flex-col border ${isOwned ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-white/5 hover:border-blue-500/40'}`}>
                    {isOwned && (
                      <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 bg-emerald-500 px-3 py-1.5 rounded-full">
                        <CheckCircle2 size={10} className="text-white" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white">Owned</span>
                      </div>
                    )}
                    <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggleCompare(item)} className={`p-2.5 rounded-xl border bg-black/60 backdrop-blur-md transition-all ${compareList.find(i => i.id === item.id) ? 'text-blue-500 border-blue-500' : 'text-white border-white/10 hover:text-blue-500'}`}><Scale size={14}/></button>
                    </div>
                    <Link href={`/item/${item.id}`} className="flex-1">
                      <div className="aspect-square bg-black/20 rounded-[2rem] flex items-center justify-center p-4 mb-4 relative overflow-hidden">
                        <div className="absolute inset-0 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: rarityColor }} />
                        <img loading="lazy" src={item.image} className="w-full h-full object-contain relative z-10 transition-transform group-hover:scale-110 duration-500" alt={item.name} />
                      </div>
                      <p className="text-[10px] font-black uppercase truncate tracking-widest text-white/90">{item.name}</p>
                      <p className="text-[8px] font-black mt-2 opacity-80 uppercase" style={{color: rarityColor}}>{item.rarity?.name || 'Standard'}</p>
                    </Link>
                  </div>
                );
              })}
              <div ref={sentinelRef} className="h-4 col-span-full" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}