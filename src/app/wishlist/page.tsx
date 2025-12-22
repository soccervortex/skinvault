"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import Sidebar from '@/app/components/Sidebar';
import ProUpgradeModal from '@/app/components/ProUpgradeModal';
import { loadWishlist, toggleWishlistEntry, WishlistEntry } from '@/app/utils/wishlist';
import { getWishlistLimitSync, getWishlistBatchSize, getWishlistBatchSizeSync, preloadRewards } from '@/app/utils/pro-limits';
import { fetchWithProxyRotation, checkProStatus } from '@/app/utils/proxy-utils';

const PROXY_LIST = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://yacdn.org/proxy/${url}`,
];

const fetchWithRotation = async (steamUrl: string, retryCount: number = 0): Promise<any> => {
  // try proxies sequentially to avoid noisy errors in dev
  for (let i = 0; i < PROXY_LIST.length; i++) {
    try {
      const proxyUrl = PROXY_LIST[i](steamUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      
      const res = await fetch(proxyUrl, { 
        cache: 'no-store',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Handle retry for rate limits and timeouts
      if (res.status === 429 || res.status === 408) {
        const errorMsg = res.status === 429 ? 'Rate limit (429)' : 'Timeout (408)';
        console.warn(`Proxy ${i} ${errorMsg}, retrying...`);
        
        if (retryCount === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchWithRotation(steamUrl, retryCount + 1);
        }
        continue; // Try next proxy
      }

      if (!res.ok) continue;

      let data: any;
      const text = await res.text();

      try {
        const json = JSON.parse(text);
        // Handle different proxy response formats (no more allorigins.win)
        data = json;
      } catch {
        try {
          data = JSON.parse(text);
        } catch {
          continue; // Invalid JSON, try next proxy
        }
      }

      if (data && (data.success || data.lowest_price || data.median_price)) {
        return data;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`Proxy ${i} timeout/aborted`);
      }
      // swallow individual proxy errors; we'll fall back to next
    }
  }
  return null;
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState({ code: '3', symbol: '€' });
  const [priceMap, setPriceMap] = useState<
    Record<string, { lowest: string; median: string; volume: string } | null>
  >({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isPro, setIsPro] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [wishlistLimit, setWishlistLimit] = useState(10);

  // hydrate wishlist + currency + Pro status
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // Test localStorage accessibility first
        const testKey = '__localStorage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
        
        const storedUser = window.localStorage.getItem('steam_user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        setUser(parsedUser);
        const steamId = parsedUser?.steamId || null;
        setItems(loadWishlist(steamId));
        
        // Load rewards to update limit
        if (steamId) {
          preloadRewards(steamId).then(() => {
            setWishlistLimit(getWishlistLimitSync(false));
          }).catch(() => {
            setWishlistLimit(getWishlistLimitSync(false));
          });
        } else {
          setWishlistLimit(getWishlistLimitSync(false));
        }
        
        // Check Pro status from API to ensure accuracy
        if (steamId) {
          checkProStatus(steamId).then(setIsPro);
        } else {
          setIsPro(false);
        }
        
        // Load currency
        const stored = window.localStorage.getItem('sv_currency');
        if (stored === '1') {
          setCurrency({ code: '1', symbol: '$' });
        } else if (stored === '3') {
          setCurrency({ code: '3', symbol: '€' });
        }
      }
    } catch {
      // Ignore localStorage errors
      setUser(null);
      setItems([]);
      setIsPro(false);
    }
    setLoading(false);
  }, []);

  // fetch prices for wishlist entries (Pro users get faster batch processing)
  useEffect(() => {
    if (!items.length) return;

    let cancelled = false;

    const run = async () => {
      setPriceLoading(true);
      const next: Record<string, { lowest: string; median: string; volume: string }> = {};

      // Pro users get faster batch processing
      const batchSize = getWishlistBatchSizeSync(isPro);
      const batches: typeof items[] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
      }

      // Process batches sequentially, but items within batch in parallel
      for (const batch of batches) {
        if (cancelled) break;
        
        await Promise.all(
          batch.map(async (entry) => {
            const marketName = entry.market_hash_name || entry.name;
            if (!marketName) return;

            const hash = encodeURIComponent(marketName);
            const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${currency.code}&market_hash_name=${hash}&t=${Date.now()}`;

            const data = await fetchWithProxyRotation(steamUrl, isPro, { 
              parallel: false,
              marketHashName: marketName,
              currency: currency.code,
            });
            if (data?.success) {
              next[entry.key] = {
                lowest: data.lowest_price || data.median_price || '---',
                median: data.median_price || '---',
                volume: data.volume || 'Low',
              };
            } else {
              next[entry.key] = {
                lowest: '---',
                median: '---',
                volume: 'Low',
              };
            }
          })
        );
      }

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
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar flex items-center justify-center">
            <div className="text-center space-y-4">
              <Heart className="animate-pulse text-rose-500 mx-auto" size={40} />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Loading wishlist...</p>
            </div>
          </div>
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
              <Heart className="text-rose-500 shrink-0" size={28} />
              <div>
                <h2 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none">My Wishlist</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
                    {items.length} / {isPro ? '∞' : wishlistLimit} {items.length === 1 ? 'item' : 'items'} saved
                    {!isPro && items.length >= wishlistLimit && (
                      <span className="ml-2 text-amber-500">• Limit reached</span>
                    )}
                  </p>
                  {isPro && (
                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1 mt-2">
                      <span>⚡</span>
                      Fast Updates
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => {
                  setCurrency({ code: '3', symbol: '€' });
                  try {
                    if (typeof window !== 'undefined') window.localStorage.setItem('sv_currency', '3');
                  } catch {
                    /* ignore */
                  }
                }}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-[8px] md:text-[9px] font-black transition-all ${currency.code === '3' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
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
                className={`px-3 md:px-4 py-1.5 rounded-lg text-[8px] md:text-[9px] font-black transition-all ${currency.code === '1' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
              >
                USD
              </button>
            </div>
          </header>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/10 rounded-[2.5rem] bg-black/20">
              <Heart className="text-gray-600 mb-4" size={32} />
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
                {user ? 'No items in wishlist' : 'Not logged in'}
              </p>
              <p className="text-[10px] text-gray-600 mt-2 max-w-sm">
                {user
                  ? 'Browse skins or open an item detail page and tap the heart icon to add items to your wishlist.'
                  : 'Sign in with Steam first, then use the heart icon on items to add them to your wishlist.'}
              </p>
            </div>
          ) : (
            <section className="space-y-6 md:space-y-10">
              <div className="flex items-center gap-3 md:gap-4 px-2 md:px-6">
                <Heart className="text-rose-500 shrink-0" size={24} />
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">Saved Items</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {items.map((entry) => {
                  const rarityColor = entry.rarityColor || '#3b82f6';
                  const price = priceMap[entry.key];
                  const currentPrice = price?.lowest || (priceLoading ? null : 'NO PRICE');

                  return (
                    <Link
                      key={entry.key}
                      href={`/item/${encodeURIComponent(entry.market_hash_name || entry.name)}`}
                      prefetch={false}
                      className="group"
                    >
                      <div className="bg-[#11141d] p-7 rounded-[2.5rem] border border-white/5 flex flex-col group-hover:border-rose-500/40 transition-all group-hover:-translate-y-2 relative overflow-hidden shadow-xl">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const steamId = user?.steamId || null;
                            const result = toggleWishlistEntry(entry, steamId, isPro);
                            if (result.success) {
                              setItems(result.newList);
                            } else if (result.reason === 'limit_reached') {
                              setShowUpgradeModal(true);
                            }
                          }}
                          className="absolute top-4 right-4 z-20 inline-flex items-center justify-center p-2 rounded-xl border border-rose-500/30 bg-black/60 hover:border-rose-500 hover:bg-rose-500/20 transition-all"
                          aria-label="Remove from wishlist"
                        >
                          <Heart size={14} className="text-rose-500 fill-rose-500" />
                        </button>
                        <img
                          src={entry.image}
                          alt={entry.name}
                          className="w-full h-32 object-contain mb-6 z-10 drop-shadow-2xl group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="mt-auto space-y-2">
                          {entry.rarityName && (
                            <p
                              className="text-[9px] font-black uppercase tracking-[0.3em]"
                              style={{ color: rarityColor }}
                            >
                              {entry.rarityName}
                            </p>
                          )}
                          <p className="text-[10px] font-black uppercase leading-tight text-white/90 line-clamp-2">
                            {entry.name}
                          </p>
                          {entry.weaponName && (
                            <p className="text-[9px] text-gray-500 uppercase">
                              {entry.weaponName}
                            </p>
                          )}
                          <p className="text-[11px] font-black text-emerald-500 italic">
                            {currentPrice === null ? (
                              <span className="text-gray-600 animate-pulse text-[9px]">
                                {isPro ? '⚡ FAST SCAN...' : 'SCANNING...'}
                              </span>
                            ) : currentPrice === 'NO PRICE' ? (
                              <span className="text-gray-500 text-[9px]">NO PRICE</span>
                            ) : (
                              currentPrice
                            )}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
      
      <ProUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Wishlist Limit Reached"
        message="You've reached the free tier limit of 10 wishlist items. Upgrade to Pro for unlimited wishlist items and access to advanced features."
        feature="Wishlist"
        limit={wishlistLimit}
        currentCount={items.length}
      />
    </div>
  );
}