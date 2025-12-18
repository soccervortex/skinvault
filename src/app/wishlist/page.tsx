"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, TrendingUp, BarChart3, Loader2, Heart } from 'lucide-react';
import { loadWishlist, toggleWishlistEntry, WishlistEntry } from '@/app/utils/wishlist';

const PROXY_LIST = [
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const fetchWithRotation = async (steamUrl: string) => {
  // try proxies sequentially to avoid noisy errors in dev
  for (let i = 0; i < PROXY_LIST.length; i++) {
    try {
      const proxyUrl = PROXY_LIST[i](steamUrl);
      const res = await fetch(proxyUrl, { cache: 'no-store' });
      if (!res.ok) continue;

      let data: any;
      const text = await res.text();

      try {
        const json = JSON.parse(text);
        const wrapped = (json as any).contents;
        data = typeof wrapped === 'string' ? JSON.parse(wrapped) : wrapped || json;
      } catch {
        data = JSON.parse(text);
      }

      if (data && (data.success || data.lowest_price || data.median_price)) {
        return data;
      }
    } catch {
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

  // hydrate wishlist + currency
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedUser = window.localStorage.getItem('steam_user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        setUser(parsedUser);
        const steamId = parsedUser?.steamId || null;
        setItems(loadWishlist(steamId));
      }
    } catch {
      setUser(null);
      setItems([]);
    }
    try {
      if (typeof window === 'undefined') return;
      const stored = window.localStorage.getItem('sv_currency');
      if (stored === '1') {
        setCurrency({ code: '1', symbol: '$' });
      } else if (stored === '3') {
        setCurrency({ code: '3', symbol: '€' });
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  // fetch prices for wishlist entries
  useEffect(() => {
    if (!items.length) return;

    let cancelled = false;

    const run = async () => {
      setPriceLoading(true);
      const next: Record<string, { lowest: string; median: string; volume: string }> = {};

      await Promise.all(
        items.map(async (entry) => {
          const marketName = entry.market_hash_name || entry.name;
          if (!marketName) return;

          const hash = encodeURIComponent(marketName);
          const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${currency.code}&market_hash_name=${hash}&t=${Date.now()}`;

          const data = await fetchWithRotation(steamUrl);
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
        Loading wishlist...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white font-sans">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-500 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all"
            >
              <ChevronLeft size={14} /> Back
            </Link>
            <h1 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">
              Wishlist
            </h1>
          </div>
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
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                currency.code === '3' ? 'bg-blue-600 text-white' : 'text-gray-500'
              }`}
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
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                currency.code === '1' ? 'bg-blue-600 text-white' : 'text-gray-500'
              }`}
            >
              USD
            </button>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="mt-20 flex flex-col items-center justify-center text-center text-gray-500">
            <p className="text-xs font-black uppercase tracking-[0.4em] mb-2">
              {user ? 'No items in wishlist' : 'Not logged in'}
            </p>
            <p className="text-sm text-gray-400 max-w-sm">
              {user
                ? 'Browse skins or open an item detail page and tap the heart icon to add items to your wishlist.'
                : 'Sign in with Steam first, then use the heart icon on items to add them to your wishlist.'}
            </p>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {items.map((entry) => {
              const rarityColor = entry.rarityColor || '#3b82f6';
              const price = priceMap[entry.key];

              return (
                <div
                  key={entry.key}
                  className="bg-[#11141d] p-6 md:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden"
                >
                  <div
                    className="absolute inset-0 opacity-10 blur-[120px]"
                    style={{ backgroundColor: rarityColor }}
                  />
                  <div className="relative z-10 space-y-4 md:space-y-6">
                    <button
                      onClick={() => {
                        const steamId = user?.steamId || null;
                        const next = toggleWishlistEntry(entry, steamId);
                        setItems(next);
                      }}
                      className="absolute top-4 right-4 inline-flex items-center justify-center p-2.5 rounded-2xl border border-white/10 bg-black/60 hover:border-rose-500 hover:bg-rose-500/10 transition-all"
                      aria-label="Remove from wishlist"
                    >
                      <Heart size={16} className="text-rose-500 fill-rose-500" />
                    </button>
                    <div className="w-full h-32 md:h-40 flex items-center justify-center mb-4">
                      <img
                        src={entry.image}
                        alt={entry.name}
                        className="max-h-full w-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                      />
                    </div>
                    {entry.rarityName && (
                      <p
                        className="text-[10px] font-black uppercase tracking-[0.4em] mb-1"
                        style={{ color: rarityColor }}
                      >
                        {entry.rarityName}
                      </p>
                    )}
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-3">
                      {entry.name}
                    </h2>
                    {entry.weaponName && (
                      <div className="flex flex-wrap gap-2 text-[9px] uppercase">
                        <span className="px-3 py-1 rounded-full bg-black/40 border border-white/10 text-gray-300">
                          {entry.weaponName}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-black/40 p-4 rounded-2xl border border-white/5 relative overflow-hidden">
                        <span className="text-[9px] font-black text-gray-500 uppercase block mb-1">
                          Current Value
                        </span>
                        <p className="text-lg font-black text-emerald-400 italic">
                          {price?.lowest
                            ? price.lowest
                            : priceLoading
                            ? (
                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> SCANNING...
                                </span>
                              )
                            : (
                                <span className="text-[10px] text-gray-600">NO PRICE</span>
                              )}
                        </p>
                        <TrendingUp className="absolute right-3 bottom-3 text-emerald-500/10 w-10 h-10" />
                      </div>
                      <div className="bg-black/40 p-4 rounded-2xl border border-white/5 relative overflow-hidden">
                        <span className="text-[9px] font-black text-gray-500 uppercase block mb-1">
                          24h Median
                        </span>
                        <p className="text-lg font-black text-white/90 italic">
                          {price?.median
                            ? price.median
                            : priceLoading
                            ? (
                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> SCANNING...
                                </span>
                              )
                            : (
                                <span className="text-[10px] text-gray-600">NO PRICE</span>
                              )}
                        </p>
                        <BarChart3 className="absolute right-3 bottom-3 text-white/10 w-10 h-10" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
