"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, Swords, Shield, Target, Zap, Award, TrendingUp, BarChart3, Loader2, Heart } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import ProUpgradeModal from '@/app/components/ProUpgradeModal';
import { loadWishlist, toggleWishlistEntry, WishlistEntry } from '@/app/utils/wishlist';
import { getWishlistLimit } from '@/app/utils/pro-limits';

type CompareSkin = {
  id: string;
  name: string;
  image: string;
  weapon?: { name: string };
  rarity?: { name: string; color?: string };
  collections?: { name: string }[];
  team?: { name: string };
  type?: { name: string };
  [key: string]: any;
};

function CompareContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<CompareSkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState({ code: "3", symbol: "€" });
  const [priceMap, setPriceMap] = useState<
    Record<string, { lowest: string; median: string; volume: string } | null>
  >({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isPro, setIsPro] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // --- PROXY ROTATION SETUP FOR PRICES ---
  const PROXY_LIST = [
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  const fetchWithRotation = async (steamUrl: string) => {
    const attempts = PROXY_LIST.map(async (buildUrl, index) => {
      try {
        const proxyUrl = buildUrl(steamUrl);
        const res = await fetch(proxyUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Proxy ${index} status ${res.status}`);

        let data: any;
        const text = await res.text();

        try {
          const json = JSON.parse(text);
          const wrapped = (json as any).contents;
          data = typeof wrapped === "string" ? JSON.parse(wrapped) : wrapped || json;
        } catch {
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
      // @ts-ignore Promise.any available in modern runtimes
      return await Promise.any(attempts);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const id1 = searchParams.get('id1');
    const id2 = searchParams.get('id2');
    if (!id1 || !id2) {
      setItems([]);
      setLoading(false);
      return;
    }
    
    fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json')
      .then(res => res.json())
      .then((data: CompareSkin[] | Record<string, CompareSkin>) => {
        const arr = Array.isArray(data) ? data : Object.values(data);
        const found = [
          arr.find((i) => i.id === id1),
          arr.find((i) => i.id === id2),
        ].filter(Boolean) as CompareSkin[];
        setItems(found);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  }, [searchParams]);

  // Hydrate wishlist / user / Pro status once
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const storedUser = window.localStorage.getItem("steam_user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      setUser(parsedUser);
      const steamId = parsedUser?.steamId || null;
      setWishlist(loadWishlist(steamId));
      
      // Check Pro status
      if (parsedUser?.proUntil) {
        const proUntil = new Date(parsedUser.proUntil);
        setIsPro(proUntil > new Date());
      } else {
        setIsPro(false);
      }
    } catch {
      setUser(null);
      setWishlist([]);
      setIsPro(false);
    }
  }, []);

  // Hydrate currency preference once
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem("sv_currency");
      if (stored === "1") {
        setCurrency({ code: "1", symbol: "$" });
      } else if (stored === "3") {
        setCurrency({ code: "3", symbol: "€" });
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch prices for both items when items or currency change
  useEffect(() => {
    if (items.length < 1) return;

    let cancelled = false;

    const run = async () => {
      setPriceLoading(true);
      const next: Record<string, { lowest: string; median: string; volume: string }> = {};

      await Promise.all(
        items.map(async (skin) => {
          const marketName = (skin as any).market_hash_name || skin.name;
          if (!marketName) return;

          const hash = encodeURIComponent(marketName);
          const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${currency.code}&market_hash_name=${hash}&t=${Date.now()}`;

          const data = await fetchWithRotation(steamUrl);
          if (data?.success) {
            next[skin.id] = {
              lowest: data.lowest_price || data.median_price || "---",
              median: data.median_price || "---",
              volume: data.volume || "Low",
            };
          } else {
            next[skin.id] = {
              lowest: "---",
              median: "---",
              volume: "Low",
            };
          }
        })
      );

      if (!cancelled) {
        setPriceMap(next);
        setPriceLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [items, currency.code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center text-blue-500 font-black animate-pulse text-xs tracking-[0.4em] uppercase">
        Preparing comparison...
      </div>
    );
  }

  if (items.length < 2) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Not enough data</p>
          <p className="text-sm text-gray-400">Please select two valid skins to start a comparison.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 md:space-y-12 pb-32">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8">
            <div className="flex items-center gap-4 md:gap-6">
              <Swords className="text-blue-500 shrink-0" size={28} />
              <div>
                <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none">
                  Compare Skins
                </h1>
                <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
                  Side-by-side comparison
                </p>
              </div>
            </div>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => {
                  setCurrency({ code: "3", symbol: "€" });
                  try {
                    if (typeof window !== "undefined") window.localStorage.setItem("sv_currency", "3");
                  } catch {
                    /* ignore */
                  }
                }}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black transition-all ${
                  currency.code === "3" ? "bg-blue-600 text-white" : "text-gray-500"
                }`}
              >
                EUR
              </button>
              <button
                onClick={() => {
                  setCurrency({ code: "1", symbol: "$" });
                  try {
                    if (typeof window !== "undefined") window.localStorage.setItem("sv_currency", "1");
                  } catch {
                    /* ignore */
                  }
                }}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black transition-all ${
                  currency.code === "1" ? "bg-blue-600 text-white" : "text-gray-500"
                }`}
              >
                USD
              </button>
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {items.map((skin) => {
            const rarityColor = skin.rarity?.color || "#3b82f6";
            const price = priceMap[skin.id];
            const wishlistKey = (skin as any).market_hash_name || skin.name || skin.id;
            const steamId = user?.steamId || null;
            const isWishlisted = wishlist.some((w) => w.key === wishlistKey);

            return (
              <div
                key={skin.id}
                className="bg-[#11141d] p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden"
              >
                <div
                  className="absolute inset-0 opacity-10 blur-[120px]"
                  style={{ backgroundColor: rarityColor }}
                />
                <div className="relative z-10 space-y-4 md:space-y-6">
                  <button
                    onClick={() => {
                      const result = toggleWishlistEntry(
                        {
                          key: wishlistKey,
                          name: skin.name,
                          image: skin.image,
                          market_hash_name: (skin as any).market_hash_name,
                          rarityName: skin.rarity?.name,
                          rarityColor: skin.rarity?.color,
                          weaponName: skin.weapon?.name,
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
                    className="absolute top-3 md:top-4 right-3 md:right-4 inline-flex items-center justify-center p-2 md:p-2.5 rounded-xl md:rounded-2xl border border-white/10 bg-black/60 hover:border-rose-500 hover:bg-rose-500/10 transition-all z-20"
                    aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart
                      size={14}
                      className={isWishlisted ? 'text-rose-500 fill-rose-500' : 'text-gray-400'}
                    />
                  </button>
                  <div className="aspect-video flex items-center justify-center mb-3 md:mb-4">
                    <img
                      src={skin.image}
                      alt={skin.name}
                      className="w-full h-auto max-h-48 md:max-h-none object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                    />
                  </div>
                  <p
                    className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] mb-1"
                    style={{ color: rarityColor }}
                  >
                    {skin.rarity?.name || "Unknown Rarity"}
                  </p>
                  <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter mb-2 md:mb-3 leading-tight">
                    {skin.name}
                  </h2>
                  <div className="flex flex-wrap gap-2 text-[8px] md:text-[9px] uppercase">
                    {skin.weapon?.name && (
                      <span className="px-2 md:px-3 py-1 rounded-full bg-black/40 border border-white/10 text-gray-300">
                        {skin.weapon.name}
                      </span>
                    )}
                    {skin.collections?.[0]?.name && (
                      <span className="px-2 md:px-3 py-1 rounded-full bg-black/40 border border-white/10 text-gray-400">
                        {skin.collections[0].name}
                      </span>
                    )}
                    {skin.team?.name && (
                      <span className="px-2 md:px-3 py-1 rounded-full bg-black/40 border border-white/10 text-gray-400">
                        {skin.team.name}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
                    <div className="bg-black/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5 relative overflow-hidden">
                      <span className="text-[8px] md:text-[9px] font-black text-gray-500 uppercase block mb-1">
                        Current Value
                      </span>
                      <p className="text-base md:text-lg font-black text-emerald-400 italic">
                        {price?.lowest
                          ? price.lowest
                          : priceLoading
                          ? <span className="text-[9px] md:text-[10px] text-gray-500 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> SCANNING...
                            </span>
                          : <span className="text-[9px] md:text-[10px] text-gray-600">NO PRICE</span>}
                      </p>
                      <TrendingUp className="absolute right-2 md:right-3 bottom-2 md:bottom-3 text-emerald-500/10 w-8 h-8 md:w-10 md:h-10" />
                    </div>
                    <div className="bg-black/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5 relative overflow-hidden">
                      <span className="text-[8px] md:text-[9px] font-black text-gray-500 uppercase block mb-1">
                        24h Median
                      </span>
                      <p className="text-base md:text-lg font-black text-white/90 italic">
                        {price?.median
                          ? price.median
                          : priceLoading
                          ? <span className="text-[9px] md:text-[10px] text-gray-500 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> SCANNING...
                            </span>
                          : <span className="text-[9px] md:text-[10px] text-gray-600">NO PRICE</span>}
                      </p>
                      <BarChart3 className="absolute right-2 md:right-3 bottom-2 md:bottom-3 text-white/10 w-8 h-8 md:w-10 md:h-10" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/** derived values for bottom comparison rows */}
        {(() => {
          const collection1 = items[0]?.collections?.[0]?.name || "";
          const collection2 = items[1]?.collections?.[0]?.name || "";
          const showCollectionRow = !!(collection1 || collection2);

          return (
        <section className="space-y-3 md:space-y-4">
          <div className="grid grid-cols-3 px-2 md:px-4 lg:px-10 mb-3 md:mb-4 gap-2">
            <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-500 truncate">
              {items[0]?.weapon?.name || items[0]?.name || "Item 1"}
            </div>
            <div className="text-center text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-600">
              Metric
            </div>
            <div className="text-right text-[9px] md:text-[10px] font-black uppercase tracking-widest text-purple-500 truncate">
              {items[1]?.weapon?.name || items[1]?.name || "Item 2"}
            </div>
          </div>

          <DuelRow
            label="Weapon"
            val1={items[0]?.weapon?.name || "Unknown"}
            val2={items[1]?.weapon?.name || "Unknown"}
            icon={<Shield size={14} />}
          />
          <DuelRow
            label="Rarity"
            val1={items[0]?.rarity?.name || "Unknown"}
            val2={items[1]?.rarity?.name || "Unknown"}
            icon={<Award size={14} />}
          />
          {showCollectionRow && (
            <DuelRow
              label="Collection"
              val1={collection1 || "N/A"}
              val2={collection2 || "N/A"}
              icon={<Target size={14} />}
            />
          )}
          <DuelRow
            label="Team"
            val1={items[0]?.team?.name || "Both"}
            val2={items[1]?.team?.name || "Both"}
            icon={<Zap size={14} />}
          />
        </section>
          );
        })()}
        </div>
      </div>
      
      <ProUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Wishlist Limit Reached"
        message="You've reached the free tier limit of 10 wishlist items. Upgrade to Pro for unlimited wishlist items and access to advanced features."
        feature="Wishlist"
        limit={getWishlistLimit(false)}
        currentCount={wishlist.length}
      />
    </div>
  );
}

function DuelRow({ label, val1, val2, icon }: any) {
  return (
    <div className="bg-[#11141d] border border-white/5 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
      <div className="text-xs md:text-sm font-black uppercase italic tracking-tighter text-blue-400 truncate">{val1}</div>
      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-black/40 rounded-full border border-white/5 shrink-0">
        <span className="text-gray-500">{icon}</span>
        <span className="text-[7px] md:text-[8px] font-black uppercase text-gray-400 whitespace-nowrap">{label}</span>
      </div>
      <div className="text-right text-xs md:text-sm font-black uppercase italic tracking-tighter text-purple-400 truncate">{val2}</div>
    </div>
  );
}

export default function ComparePage() { 
  return (
    <Suspense fallback={null}>
      <CompareContent />
    </Suspense>
  ); 
}