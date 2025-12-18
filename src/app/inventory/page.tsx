"use client";

import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Loader2, PackageOpen, Target, Skull, Award, Swords, TrendingUp } from 'lucide-react';

const STEAM_API_KEYS = ["0FC9C1CEBB016CB0B78642A67680F500"];

type InventoryItem = {
  market_hash_name: string;
  icon_url: string;
  [key: string]: any;
};

function StatCard({ label, icon, val, unit = "", color = "text-white" }: any) {
  return (
    <div className="bg-[#11141d] p-5 rounded-[2rem] border border-white/5">
      <div className="flex items-center gap-2 mb-3 text-[9px] font-black uppercase text-gray-500 tracking-widest">
        {icon} {label}
      </div>
      <div className={`text-xl font-black italic tracking-tighter ${color}`}>
        {val ?? '---'}{unit}
      </div>
    </div>
  );
}

function InventoryContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [itemPrices, setItemPrices] = useState<{ [key: string]: string }>({});
  const [currency, setCurrency] = useState({ code: '3', symbol: '€' });
  const [viewedUser, setViewedUser] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [statsPrivate, setStatsPrivate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceScanDone, setPriceScanDone] = useState(false);
  const priceCacheRef = useRef<{ [key: string]: string }>({});
  const cacheKey = useMemo(() => `sv_price_cache_${currency.code}`, [currency.code]);

  // --- PROXY ROTATION SETUP ---
  const PROXY_LIST = [
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  const fetchWithRotation = async (steamUrl: string) => {
    for (let i = 0; i < PROXY_LIST.length; i++) {
      try {
        const proxyUrl = PROXY_LIST[i](steamUrl);
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Status ${res.status}`);

        const json = await res.json();
        // AllOrigins wraps data in .contents, corsproxy returns it directly
        const data = typeof json.contents === 'string' ? JSON.parse(json.contents) : (json.contents || json);
        
        if (data && (data.success || data.descriptions)) return data;
      } catch (e) {
        console.warn(`Proxy ${i} failed, trying next...`);
      }
    }
    return null;
  };

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        priceCacheRef.current = parsed;
        setItemPrices(parsed);
      } catch {
        priceCacheRef.current = {};
        setItemPrices({});
      }
    } else {
      priceCacheRef.current = {};
      setItemPrices({});
    }
  }, [cacheKey]);

  const fetchViewedProfile = async (id: string) => {
    try {
      const steamUrl = `https://steamcommunity.com/profiles/${id}/?xml=1`;
      const textRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`);
      const text = await textRes.text();
      const name = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || "User";
      const avatar = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || "";
      return { steamId: id, name, avatar };
    } catch (e) { return null; }
  };

  const fetchPlayerStats = async (id: string) => {
    try {
      const res = await fetch(`/api/steam/stats?id=${id}`);
      if (!res.ok) {
        console.warn("Stats API error", await res.text());
        return;
      }
      const data = await res.json();
      const ps = data?.playerstats;
      const s = ps?.stats;

      if (s && Array.isArray(s)) {
        const statsObj: any = {};
        s.forEach((item: any) => statsObj[item.name] = item.value);
        const kills = Number(statsObj.total_kills ?? 0);
        const deaths = Number(statsObj.total_deaths ?? 0);
        const hsKills = Number(statsObj.total_kills_headshot ?? 0);
        const matchesWon = Number(statsObj.total_matches_won ?? 0);
        const matchesPlayed = Number(statsObj.total_matches_played ?? 0);

        const kd = deaths > 0 ? (kills / deaths) : kills > 0 ? kills : 0;
        const hs = kills > 0 ? (hsKills / kills) * 100 : 0;
        const wr = matchesPlayed > 0 ? (matchesWon / matchesPlayed) * 100 : 0;

        setPlayerStats({
          kd: kd.toFixed(2),
          hs: hs.toFixed(1),
          wr: wr.toFixed(1),
          kills: kills.toLocaleString(),
          wins: matchesWon.toLocaleString()
        });
        setStatsPrivate(false);
      } else {
        // Only flag as private when Steam explicitly says so
        const errMsg = typeof ps?.error === 'string' ? ps.error.toLowerCase() : '';
        if (errMsg.includes('private') || errMsg.includes('not allowed')) {
          setStatsPrivate(true);
        } else {
          setStatsPrivate(false);
        }
      }
    } catch (e) { console.error("Stats failed", e); }
  };

  const mergeAndStorePrices = (next: Record<string, string>) => {
    const merged = { ...priceCacheRef.current, ...next };
    priceCacheRef.current = merged;
    setItemPrices(merged);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(merged));
    } catch {
      // ignore quota errors
    }
  };

  const fetchPrices = async (names: string[]) => {
    const missing = names.filter((n) => !priceCacheRef.current[n]);
    if (!missing.length) return;

    const results: Record<string, string> = {};
    const active = new Set<Promise<void>>();
    const CONCURRENCY = 6;

    for (const name of missing) {
      let taskPromise: Promise<void>;
      taskPromise = (async () => {
        try {
          const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${currency.code}&market_hash_name=${encodeURIComponent(name as string)}`;
          const pData = await fetchWithRotation(steamUrl);
          if (pData?.success) {
            const price = pData.lowest_price || pData.median_price;
            if (price) results[name] = price;
          }
        } catch {
          /* ignore individual price failures */
        }
      })().finally(() => active.delete(taskPromise));

      active.add(taskPromise);
      if (active.size >= CONCURRENCY) {
        await Promise.race(active);
      }
    }

    await Promise.all(active);
    mergeAndStorePrices(results);
  };

  const fetchInventory = async (id: string) => {
    try {
      setPriceScanDone(false);
      const invUrl = `https://steamcommunity.com/inventory/${id}/730/2?l=english&count=500`;
      const data = await fetchWithRotation(invUrl);
      const items = (data?.descriptions || []) as InventoryItem[];
      setInventory(items);

      const uniqueNames = Array.from(new Set(items.map((i) => i.market_hash_name)));
      await fetchPrices(uniqueNames);
      setPriceScanDone(true);
    } catch (e) { console.error("Inventory failed", e); }
  };

  useEffect(() => {
    const steamId = searchParams.get('openid.claimed_id')?.split('/').pop() || 
                    JSON.parse(localStorage.getItem('steam_user') || '{}')?.steamId;
    if (!steamId) return;

    const loadAll = async () => {
      setLoading(true);
      const [profile] = await Promise.all([
        fetchViewedProfile(steamId),
        fetchPlayerStats(steamId),
        fetchInventory(steamId)
      ]);
      setViewedUser(profile);
      setLoading(false);
    };
    loadAll();
  }, [searchParams, currency.code]);

  const totalVaultValue = useMemo(() => {
    let total = 0;
    inventory.forEach(item => {
      const priceStr = itemPrices[item.market_hash_name];
      if (priceStr) {
        const num = parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(num)) total += num;
      }
    });
    return total.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [inventory, itemPrices]);

  const totalItems = useMemo(() => inventory.length, [inventory]);

  const pricedItems = useMemo(
    () => inventory.filter(i => itemPrices[i.market_hash_name]).length,
    [inventory, itemPrices]
  );

  const filteredInv = useMemo(() => 
    inventory.filter(i => i.market_hash_name.toLowerCase().includes(searchQuery.toLowerCase())), 
    [inventory, searchQuery]
  );

  if (!viewedUser && loading) return (
    <div className="h-screen bg-[#08090d] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Syncing with Steam...</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        {viewedUser && (
          <div className="max-w-6xl mx-auto space-y-12 pb-32">
            <header className="bg-[#11141d] p-10 rounded-[3.5rem] border border-white/5 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-6">
                <img src={viewedUser.avatar} className="w-24 h-24 rounded-[2.5rem] border-2 border-blue-600 shadow-2xl" alt="avatar" />
                <div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">{viewedUser.name}</h2>
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mt-4 w-fit">
                    <button onClick={() => setCurrency({code: '3', symbol: '€'})} className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${currency.code === '3' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>EUR</button>
                    <button onClick={() => setCurrency({code: '1', symbol: '$'})} className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${currency.code === '1' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>USD</button>
                  </div>
                </div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-10 py-6 rounded-[2.5rem] flex items-center gap-6 shadow-inner">
                <TrendingUp className="text-emerald-500" size={28} />
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Vault Value</p>
                  <p className="text-4xl font-black text-white italic tracking-tighter">{currency.symbol}{totalVaultValue}</p>
                </div>
              </div>
            </header>

            {statsPrivate && (
              <div className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/20 p-5 rounded-[2rem] text-xs">
                <span className="font-black uppercase tracking-[0.25em] text-amber-400">
                  Stats are private
                </span>
                <span className="text-[10px] text-gray-400">
                  Set your Steam &quot;Game details&quot; to Public to show K/D, HS% and Wins.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard label="K/D Ratio" icon={<Skull size={12}/>} val={playerStats?.kd} />
              <StatCard label="Total Kills" icon={<Swords size={12}/>} val={playerStats?.kills} color="text-blue-500" />
              <StatCard label="Wins" icon={<Award size={12}/>} val={playerStats?.wins} color="text-emerald-500" />
              <StatCard label="HS %" icon={<Target size={12}/>} val={playerStats?.hs} unit="%" />
              <StatCard label="Total Items" icon={<PackageOpen size={12}/>} val={totalItems} />
              <StatCard label="Priced Items" icon={<TrendingUp size={12}/>} val={pricedItems} />
            </div>
            <section className="space-y-10">
              <div className="flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                  <PackageOpen className="text-blue-500" size={28} />
                  <h3 className="text-3xl font-black uppercase tracking-tighter italic">Secured Items</h3>
                </div>
                <input 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="bg-[#11141d] border border-white/5 rounded-2xl py-4 px-8 text-[11px] outline-none font-black uppercase tracking-widest focus:border-blue-500/50 w-80 transition-all shadow-xl" 
                  placeholder="SEARCH VAULT..." 
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {filteredInv.map((item, idx) => (
                  <div key={idx} className="bg-[#11141d] p-7 rounded-[2.5rem] border border-white/5 flex flex-col group hover:border-blue-500/40 transition-all hover:-translate-y-2 relative overflow-hidden shadow-xl">
                    <img 
                      src={`https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`} 
                      className="w-full h-32 object-contain mb-6 z-10 drop-shadow-2xl group-hover:scale-110 transition-transform duration-500" 
                      alt="skin" 
                    />
                    <div className="mt-auto space-y-2">
                      <p className="text-[10px] font-black uppercase leading-tight text-white/90 line-clamp-2">{item.market_hash_name}</p>
                      <p className="text-[11px] font-black text-emerald-500 italic">
                        {itemPrices[item.market_hash_name] 
                          ? itemPrices[item.market_hash_name] 
                          : priceScanDone 
                            ? <span className="text-gray-500 text-[9px]">NO PRICE</span>
                            : <span className="text-gray-600 animate-pulse text-[9px]">SCANNING...</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default function InventoryPage() { 
  return <Suspense fallback={null}><InventoryContent /></Suspense>; 
}