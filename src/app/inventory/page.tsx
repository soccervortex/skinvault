"use client";

import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { Loader2, PackageOpen, Target, Skull, Award, Swords, TrendingUp, Lock, MessageSquare, CheckCircle2, Settings, Bell, Heart, Scale } from 'lucide-react';
import { getPriceScanConcurrency } from '@/app/utils/pro-limits';
import { fetchWithProxyRotation, checkProStatus } from '@/app/utils/proxy-utils';
import ManagePriceTrackers from '@/app/components/ManagePriceTrackers';
import PriceTrackerModal from '@/app/components/PriceTrackerModal';
import ProUpgradeModal from '@/app/components/ProUpgradeModal';
import CompareModal from '@/app/components/CompareModal';
import { InventoryItemSkeleton, ProfileHeaderSkeleton, StatCardSkeleton } from '@/app/components/LoadingSkeleton';
import ShareButton from '@/app/components/ShareButton';
import { loadWishlist, toggleWishlistEntry } from '@/app/utils/wishlist';
import { getWishlistLimitSync } from '@/app/utils/pro-limits';
import { useToast } from '@/app/components/Toast';
import { isBanned } from '@/app/utils/ban-check';

// STEAM_API_KEYS removed - using environment variables instead

type InventoryItem = {
  market_hash_name?: string;
  market_name?: string;
  name?: string;
  display_name?: string;
  icon_url?: string;
  classid?: string;
  instanceid?: string;
  amount?: number;
  assetid?: string;
  tradable?: number | boolean;
  marketable?: number | boolean;
  [key: string]: any;
};

function formatProfileName(name: string): string {
  return String(name || '')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getItemDisplayName(item: InventoryItem): string {
  return (
    item.display_name ||
    item.market_hash_name ||
    item.market_name ||
    item.name ||
    'Unknown Item'
  );
}

function getMarketKey(item: InventoryItem): string | null {
  const k = item.market_hash_name || item.market_name;
  return k ? String(k) : null;
}

function getPriceForItem(item: InventoryItem, prices: Record<string, string>): string | undefined {
  const k = getMarketKey(item);
  return k ? prices[k] : undefined;
}

function isNonTradable(item: InventoryItem): boolean {
  return item.tradable === 0 || item.tradable === false;
}

function StatCard({ label, icon, val, unit = "", color = "text-white" }: any) {
  return (
    <div className="bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/5">
      <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3 text-[8px] md:text-[9px] font-black uppercase text-gray-500 tracking-widest">
        {icon} {label}
      </div>
      <div className={`text-lg md:text-xl font-black italic tracking-tighter ${color}`}>
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
  const [sortMode, setSortMode] = useState<'name-asc' | 'price-desc' | 'price-asc'>('price-desc');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<any>(null);
  const [showManageTrackers, setShowManageTrackers] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackerModalItem, setTrackerModalItem] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loggedInUserPro, setLoggedInUserPro] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareModalItem, setCompareModalItem] = useState<any>(null);
  const priceCacheRef = useRef<{ [key: string]: string }>({});
  const toast = useToast();
  const cacheKey = useMemo(() => `sv_price_cache_${currency.code}`, [currency.code]);
  const isPro = useMemo(
    () => !!(viewedUser?.proUntil && new Date(viewedUser.proUntil) > new Date()),
    [viewedUser?.proUntil]
  );

  // Proxy rotation will use Pro status to determine proxy count

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      // Test localStorage accessibility first
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      
      const stored = window.localStorage.getItem('sv_currency');
      if (stored === '1') {
        setCurrency({ code: '1', symbol: '$' });
      } else if (stored === '3') {
        setCurrency({ code: '3', symbol: '€' });
      }
    } catch {
      // Ignore localStorage errors (browser privacy settings, sandboxed iframe, etc.)
    }
  }, []);

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const textRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const text = await textRes.text();
      const name = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || "User";
      const avatar = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || "";
      return { steamId: id, name, avatar };
    } catch (e) { 
      console.warn('Profile fetch failed:', e);
      return null; 
    }
  };

  const fetchPlayerStats = async (id: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const res = await fetch(`/api/steam/stats?id=${id}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
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

        // Basic stats (free for all)
        const basicStats = {
          kd: kd.toFixed(2),
          hs: hs.toFixed(1),
          wr: wr.toFixed(1),
          kills: kills.toLocaleString(),
          wins: matchesWon.toLocaleString()
        };
        
        // Pro-only advanced stats
        const totalDamage = Number(statsObj.total_damage_done ?? 0);
        const roundsPlayed = Number(statsObj.total_rounds_played ?? 0);
        const mvps = Number(statsObj.total_mvps ?? 0);
        const totalShots = Number(statsObj.total_shots_hit ?? 0) + Number(statsObj.total_shots_fired ?? 0);
        const shotsHit = Number(statsObj.total_shots_hit ?? 0);
        
        const adr = roundsPlayed > 0 ? (totalDamage / roundsPlayed) : 0;
        const accuracy = totalShots > 0 ? (shotsHit / totalShots) * 100 : 0;
        
        setPlayerStats({
          ...basicStats,
          // Pro-only stats
          adr: adr.toFixed(1),
          mvps: mvps.toLocaleString(),
          accuracy: accuracy.toFixed(1),
          roundsPlayed: roundsPlayed.toLocaleString(),
          totalDamage: totalDamage.toLocaleString(),
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
      if (typeof window === 'undefined') return;
      // Test localStorage accessibility first
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      
      window.localStorage.setItem(cacheKey, JSON.stringify(merged));
    } catch {
      // Ignore quota errors and localStorage access errors
    }
  };

  const fetchPrices = async (names: string[]) => {
    const missing = names.filter((n) => !priceCacheRef.current[n]);
    if (!missing.length) return;

    const results: Record<string, string> = {};
    const active = new Set<Promise<void>>();
    // Pro users get faster scanning with higher concurrency
    const CONCURRENCY = getPriceScanConcurrencySync(isPro, viewedUser?.steamId);

    for (const name of missing) {
      let taskPromise: Promise<void>;
      taskPromise = (async () => {
        try {
          const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${currency.code}&market_hash_name=${encodeURIComponent(name as string)}`;
          const pData = await fetchWithProxyRotation(steamUrl, isPro, { 
            parallel: false,
            marketHashName: name as string,
            currency: currency.code,
          });
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

  const fetchInventory = async (id: string, proStatus?: boolean) => {
    try {
      // Check Pro status if not provided
      let actualProStatus = proStatus;
      if (actualProStatus === undefined) {
        // Check Pro status from API
        try {
          const proRes = await fetch(`/api/user/pro?id=${id}`);
          if (proRes.ok) {
            const proData = await proRes.json();
            actualProStatus = !!(proData?.proUntil && new Date(proData.proUntil) > new Date());
          }
        } catch {
          actualProStatus = false;
        }
      }
      
      let allItems: InventoryItem[] = [];
      let startAssetId: string | null = null;
      let hasMore = true;
      let attempts = 0;
      const maxAttempts = 20; // Prevent infinite loops

      while (hasMore && attempts < maxAttempts) {
        attempts++;
        
        try {
          // Use server-side API route to avoid CORS issues
          const apiUrl: string = `/api/steam/inventory?steamId=${id}&isPro=${actualProStatus}${startAssetId ? `&start_assetid=${startAssetId}` : ''}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
          
          const res: Response = await fetch(apiUrl, {
            signal: controller.signal,
            cache: 'no-store',
          });
          
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            const errorText = await res.text();
            console.error(`Inventory API error (${res.status}):`, errorText);
            throw new Error(`API returned ${res.status}: ${errorText}`);
          }
          
          const data: any = await res.json();
          
          // Check for error response
          if (data?.error) {
            console.error('Inventory API error:', data.error);
            throw new Error(data.error);
          }
          
          // Steam inventory API returns assets and descriptions separately
          // We need to match them together
          if (data?.descriptions && Array.isArray(data.descriptions)) {
            // Create a map of classid_instanceid to descriptions for quick lookup
            const descMap = new Map<string, any>();
            data.descriptions.forEach((desc: any) => {
              const key = String(desc.classid) + '_' + String(desc.instanceid || 0);
              // Prefer the most "complete" description (market_hash_name/market_name/name)
              const incomingName = desc?.market_hash_name || desc?.market_name || desc?.name;
              const existing = descMap.get(key);
              const existingName = existing?.market_hash_name || existing?.market_name || existing?.name;
              if (!existing || (!existingName && incomingName)) {
                descMap.set(key, desc);
              }
            });

            const existingAssetIds = new Set(allItems.map((i) => i.assetid).filter(Boolean));

            // If we have assets, match them with descriptions
            if (data?.assets && Array.isArray(data.assets)) {
              const matchedItems: InventoryItem[] = [];
              data.assets.forEach((asset: any) => {
                const key = String(asset.classid) + '_' + String(asset.instanceid || 0);
                const desc = descMap.get(key);
                if (!desc) return;

                const displayName = desc.market_hash_name || desc.market_name || desc.name || ('Item ' + String(asset.classid));
                const assetid = String(asset.assetid ?? '');
                if (assetid && existingAssetIds.has(assetid)) return;

                matchedItems.push({
                  ...desc,
                  market_hash_name: desc.market_hash_name || desc.market_name || desc.name || displayName,
                  icon_url: desc.icon_url || '',
                  display_name: displayName,
                  amount: Number(asset.amount ?? 1),
                  assetid,
                });
                if (assetid) existingAssetIds.add(assetid);
              });

              allItems = [...allItems, ...matchedItems];
            } else {
              // Fallback: use descriptions directly if no assets
              const newItems = (data.descriptions as any[]).map((desc: any, idx: number) => {
                const displayName = desc.market_hash_name || desc.market_name || desc.name || ('Item ' + String(idx));
                return {
                  ...desc,
                  market_hash_name: desc.market_hash_name || desc.market_name || desc.name || displayName,
                  icon_url: desc.icon_url || '',
                  display_name: displayName,
                  amount: 1,
                  assetid: desc.assetid ? String(desc.assetid) : undefined,
                } as InventoryItem;
              });

              allItems = [...allItems, ...newItems];
            }
          }

          // Check if there are more items
          if (data?.more_items && data?.last_assetid) {
            startAssetId = data.last_assetid;
            hasMore = true;
          } else {
            hasMore = false;
          }
        } catch (e) {
          console.error(`Inventory fetch attempt ${attempts} failed:`, e);
          hasMore = false; // Stop trying if we get an error
        }
      }

      setInventory(allItems);
    } catch (e) { 
      console.error("Inventory failed", e);
      setInventory([]); // Set empty array so page can still render
    }
  };

  useEffect(() => {
    const extractSteamId = (raw: string | null) => {
      if (!raw) return null;

      // If it's a full Steam OpenID or profile URL, grab the last path segment
      if (raw.includes('steamcommunity.com')) {
        try {
          const url = new URL(raw);
          const parts = url.pathname.split('/').filter(Boolean);
          return parts[parts.length - 1] || null;
        } catch {
          const parts = raw.split('/').filter(Boolean);
          return parts[parts.length - 1] || null;
        }
      }

      // If it's just digits, assume it's already a SteamID64
      if (/^\d+$/.test(raw)) return raw;

      return raw;
    };

    // Support multiple query keys for flexibility
    const possibleKeys = ['steamId', 'steamid', 'id', 'openid.claimed_id', 'openid_claimed_id'];
    let fromQuery: string | null = null;

    for (const key of possibleKeys) {
      const v = searchParams.get(key as any);
      if (v) {
        fromQuery = v;
        break;
      }
    }

    // Get logged-in user (your own account) - this should NEVER change when viewing other profiles
    const storedLoggedInUser = typeof window !== 'undefined' 
      ? JSON.parse(localStorage.getItem('steam_user') || '{}')
      : null;
    const loggedInSteamId = storedLoggedInUser?.steamId;
    
    // Set logged-in user state and check Pro status
    if (storedLoggedInUser?.steamId) {
      setLoggedInUser(storedLoggedInUser);
      // Load wishlist for logged-in user
      setWishlist(loadWishlist(storedLoggedInUser.steamId));
      // Check Pro status from API
      checkProStatus(storedLoggedInUser.steamId).then(setLoggedInUserPro);
    } else {
      setLoggedInUser(null);
      setWishlist([]);
      setLoggedInUserPro(false);
    }

    // Determine which profile to view
    // Priority: query param > OpenID callback > logged-in user's own profile
    const viewedSteamId =
      extractSteamId(fromQuery) ||
      extractSteamId(searchParams.get('openid.claimed_id')) ||
      extractSteamId(searchParams.get('openid_claimed_id')) ||
      loggedInSteamId;

    if (!viewedSteamId) return;

    // Check if this is a REAL Steam login callback (from /api/auth/steam redirect)
    // vs a search query that happens to use the same parameter
    // Real login callbacks will have 'openid.mode' or come from Steam's domain
    const hasOpenIdMode = !!searchParams.get('openid.mode');
    const isLoginCallback = hasOpenIdMode && !!(
      searchParams.get('openid.claimed_id') || 
      searchParams.get('openid_claimed_id')
    );
    const isViewingOwnProfile = viewedSteamId === loggedInSteamId;

    const loadAll = async () => {
      setLoading(true);
      
      // Check if user is banned (only for login callbacks)
      if (isLoginCallback) {
        const banned = await isBanned(viewedSteamId);
        if (banned) {
          setLoading(false);
          toast.error('Your account has been banned from this service. Please contact support if you believe this is an error.');
          // Clear any stored user data
          try {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('steam_user');
            }
          } catch {}
          return;
        }
      }
      
      // Fetch Pro status FIRST so we can use it for inventory fetch
      let proInfo: any = { proUntil: null };
      try {
        const proRes = await fetch(`/api/user/pro?id=${viewedSteamId}`);
        if (proRes.ok) {
          const proData = await proRes.json();
          proInfo = { proUntil: proData?.proUntil || null };
        }
      } catch (err) {
        console.error('Pro status fetch error:', err);
      }
      
      // Calculate Pro status for inventory fetch
      const proStatusForInventory = !!(proInfo?.proUntil && new Date(proInfo.proUntil) > new Date());
      
      // Start all requests but don't wait for all - show content progressively
      const profilePromise = fetchViewedProfile(viewedSteamId);
      
      // These can load in background - use correct Pro status for inventory
      fetchPlayerStats(viewedSteamId).catch(() => {});
      fetchInventory(viewedSteamId, proStatusForInventory).catch(() => {});

      // Wait for profile with timeout - Pro info already fetched above
      try {
        const profile = await Promise.race([
          profilePromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 12000)
          )
        ]) as any;

        const combinedUser = profile
          ? { ...profile, proUntil: proInfo?.proUntil || null }
          : null;

        setViewedUser(combinedUser);
        
        // Also update Pro status for logged-in user if viewing own profile
        if (isViewingOwnProfile && storedLoggedInUser?.steamId) {
          checkProStatus(storedLoggedInUser.steamId).then((proStatus) => {
            setLoggedInUserPro(proStatus);
            // Update localStorage with latest Pro status
            if (proStatus && combinedUser?.proUntil) {
              const updatedUser = {
                ...storedLoggedInUser,
                proUntil: combinedUser.proUntil,
              };
              try {
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('steam_user', JSON.stringify(updatedUser));
                  setLoggedInUser(updatedUser);
                }
              } catch {}
            }
          });
        }

        // Only update logged-in user in localStorage when:
        // 1. It's a Steam login callback (OpenID redirect) - always update
        // 2. User is viewing their own profile - update Pro status but keep your account
        // This ensures your logged-in account stays consistent and Pro status stays up-to-date
        try {
          if (combinedUser && typeof window !== 'undefined') {
            if (isLoginCallback) {
              // This is your actual login - record first login date (don't block on this)
              fetch('/api/user/first-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steamId: viewedSteamId }),
              }).catch(() => {}); // Silently fail if this doesn't work
              
              // This is your actual login - update the logged-in user completely
              window.localStorage.setItem('steam_user', JSON.stringify(combinedUser));
              // Trigger storage event so sidebar updates
              window.dispatchEvent(new Event('storage'));
            } else if (isViewingOwnProfile && loggedInUser) {
              // Viewing your own profile - only update Pro status, keep your account info
              const updatedUser = {
                ...loggedInUser,
                proUntil: combinedUser.proUntil, // Update Pro status
              };
              window.localStorage.setItem('steam_user', JSON.stringify(updatedUser));
              // Trigger storage event so sidebar updates
              window.dispatchEvent(new Event('storage'));
            }
            // Otherwise, we're just viewing someone else's profile - don't touch logged-in user
          }
        } catch {
          // ignore storage issues (e.g. private mode)
        }
      } catch (error) {
        // If profile fetch times out, try to use cached or minimal data
        console.warn('Critical data fetch timeout, using fallback');
        const fallbackLoggedInUser = typeof window !== 'undefined' 
          ? JSON.parse(localStorage.getItem('steam_user') || '{}')
          : null;
        
        let fallbackUser;
        if (fallbackLoggedInUser?.steamId === viewedSteamId) {
          // If viewing own profile and fetch fails, use cached data
          fallbackUser = fallbackLoggedInUser;
        } else {
          // Otherwise show minimal user data
          fallbackUser = { 
            steamId: viewedSteamId, 
            name: "User", 
            avatar: "",
            proUntil: null 
          };
        }
        
        setViewedUser(fallbackUser);
        
        // Don't update localStorage on timeout - keep existing data
      }

      setLoading(false);
    };
    loadAll();
  }, [searchParams]);

  // Save inventory to localStorage for owned badge on market page (only for own profile)
  useEffect(() => {
    if (!inventory.length || !loggedInUser?.steamId || !viewedUser?.steamId) return;
    if (loggedInUser.steamId !== viewedUser.steamId) return; // Only save for own profile
    
    try {
      // Extract market_hash_names from inventory
      const marketHashNames = inventory
        .map((item) => getMarketKey(item))
        .filter(Boolean) as string[];
      
      // Save to localStorage for market page to use
      if (typeof window !== 'undefined' && marketHashNames.length > 0) {
        window.localStorage.setItem('user_inventory', JSON.stringify(marketHashNames));
        // Trigger storage event so market page updates
        window.dispatchEvent(new Event('storage'));
      }
    } catch (error) {
      // Silently ignore localStorage errors
      console.error('Failed to save inventory to localStorage:', error);
    }
  }, [inventory, loggedInUser?.steamId, viewedUser?.steamId]);

  useEffect(() => {
    if (!inventory.length) return;

    const run = async () => {
      setPriceScanDone(false);
      const uniqueNames = Array.from(new Set(inventory.map((i) => getMarketKey(i)).filter(Boolean) as string[]));
      await fetchPrices(uniqueNames);
      setPriceScanDone(true);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency.code, inventory]);

  useEffect(() => {
    if (!viewedUser?.steamId) return;
    try {
      if (typeof window === 'undefined') return;
      const origin = window.location.origin;
      setShareUrl(`${origin}/inventory?steamId=${viewedUser.steamId}`);
    } catch {
      setShareUrl(null);
    }
  }, [viewedUser]);

  // Load Discord status for viewed user (only show if Pro)
  useEffect(() => {
    if (!viewedUser?.steamId) {
      setDiscordStatus(null);
      return;
    }
    
    // Only check Discord status if user is Pro
    if (!isPro) {
      setDiscordStatus({ connected: false, requiresPro: true });
      return;
    }
    
    fetch(`/api/discord/status?steamId=${viewedUser.steamId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        // Ensure we set connected status correctly - only show if Pro and connected
        setDiscordStatus(data?.connected ? data : { connected: false, requiresPro: true });
      })
      .catch(() => setDiscordStatus({ connected: false, requiresPro: true }));
  }, [viewedUser?.steamId, isPro]);

  const totalVaultValue = useMemo(() => {
    // Always return a valid number, never Infinity
    if (!inventory || inventory.length === 0) {
      return '0,00';
    }
    let total = 0;
    inventory.forEach(item => {
      const key = getMarketKey(item);
      const priceStr = key ? itemPrices[key] : undefined;
      if (priceStr) {
        const num = parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(num) && isFinite(num)) {
          total += num * Number(item.amount ?? 1);
        }
      }
    });
    // Ensure total is always a finite number (not Infinity)
    if (!isFinite(total) || isNaN(total)) {
      total = 0;
    }
    return total.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [inventory, itemPrices]);

  const totalItems = useMemo(() => inventory.reduce((sum, i) => sum + Number(i.amount ?? 1), 0), [inventory]);

  const pricedItems = useMemo(
    () => inventory.reduce((sum, i) => { const k = getMarketKey(i); return k && itemPrices[k] ? sum + Number(i.amount ?? 1) : sum; }, 0),
    [inventory, itemPrices]
  );

  const parsePriceToNumber = (priceStr?: string) => {
    if (!priceStr) return 0;
    const num = parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  const filteredInv = useMemo(() => 
    inventory.filter(i => getItemDisplayName(i).toLowerCase().includes(searchQuery.toLowerCase())), 
    [inventory, searchQuery]
  );

  const sortedInv = useMemo(() => {
    const arr = [...filteredInv];
    arr.sort((a, b) => {
      // Always show non-tradable items first (then tradable), regardless of the selected sort mode.
      const ntA = isNonTradable(a) ? 0 : 1;
      const ntB = isNonTradable(b) ? 0 : 1;
      if (ntA !== ntB) return ntA - ntB;

      if (sortMode === 'name-asc') {
        return getItemDisplayName(a).localeCompare(getItemDisplayName(b));
      }

      const keyA = getMarketKey(a);
      const priceA = parsePriceToNumber(keyA ? itemPrices[keyA] : undefined);
      const keyB = getMarketKey(b);
      const priceB = parsePriceToNumber(keyB ? itemPrices[keyB] : undefined);

      if (sortMode === 'price-asc') {
        return priceA - priceB;
      }

      // price-desc
      return priceB - priceA;
    });
    return arr;
  }, [filteredInv, itemPrices, sortMode]);

  const topItems = useMemo(
    () =>
      inventory
        .map((item) => ({
          item,
          price: parsePriceToNumber((() => { const k = getMarketKey(item); return k ? itemPrices[k] : undefined; })())
        }))
        .filter((entry) => entry.price > 0)
        .sort((a, b) => b.price - a.price)
        .slice(0, 3),
    [inventory, itemPrices]
  );

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard && typeof window !== 'undefined' && (window as any).isSecureContext) {
        await (navigator as any).clipboard.writeText(shareUrl);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      toast.error('Could not copy link. Please copy it manually.');
    }
  };

  if (!viewedUser && loading) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-12 pb-32">
            <ProfileHeaderSkeleton />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <InventoryItemSkeleton key={i} />
              ))}
            </div>
          </div>
        </main>
    </div>
  );
  }

  return (
    <>
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        {viewedUser && (
          <div className="max-w-6xl mx-auto space-y-12 pb-32">
            <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8">
              <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                <img src={viewedUser.avatar} className="w-16 h-16 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-blue-600 shadow-2xl shrink-0" alt="avatar" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                    <h2 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none break-words">
                      {formatProfileName(viewedUser?.name || "User")}
                    </h2>
                    {isPro && (
                      <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[8px] md:text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400 shrink-0">
                        Pro
                      </span>
                    )}
                    {/* Discord Connection Status (Only show if Pro AND connected) */}
                    {isPro && discordStatus?.connected && (
                      <div className="flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-indigo-500/10 border border-indigo-500/40 shrink-0">
                        <MessageSquare size={10} className="text-indigo-400" />
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.25em] text-indigo-400">
                          Discord
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Action Buttons (only for own profile) */}
                  {loggedInUser?.steamId === viewedUser?.steamId && (
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap mt-3 md:mt-4">
                      {/* Connect/Disconnect Discord Button (Only show if Pro) */}
                      {isPro && (
                        !discordStatus?.connected ? (
                          <button
                            onClick={() => {
                              if (!loggedInUser?.steamId) return;
                              fetch(`/api/discord/auth?steamId=${loggedInUser.steamId}`)
                                .then(res => res.json())
                                .then(data => {
                                  if (data.authUrl) {
                                    window.location.href = data.authUrl;
                                  }
                                })
                                .catch(console.error);
                            }}
                            className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            <MessageSquare size={12} />
                            Connect Discord
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              if (!loggedInUser?.steamId) return;
                              try {
                                const res = await fetch('/api/discord/disconnect', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ steamId: loggedInUser.steamId }),
                                });
                                if (res.ok) {
                                  setDiscordStatus({ connected: false });
                                  // Refresh page to update UI
                                  window.location.reload();
                                }
                              } catch (error) {
                                console.error('Failed to disconnect Discord:', error);
                              }
                            }}
                            className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-red-600 hover:bg-red-500 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            <MessageSquare size={12} />
                            Disconnect Discord
                          </button>
                        )
                      )}
                      {/* Manage Trackers Button */}
                      <button
                        onClick={() => setShowManageTrackers(true)}
                        className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-blue-600 hover:bg-blue-500 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        <Settings size={12} />
                        Manage Trackers
                      </button>
                    </div>
                  )}
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mt-3 md:mt-4 w-fit">
                    <button
                      onClick={() => {
                        setCurrency({ code: '3', symbol: '€' });
                        try {
                          if (typeof window !== 'undefined') window.localStorage.setItem('sv_currency', '3');
                        } catch {
                          /* ignore */
                        }
                      }}
                      className={`px-3 md:px-4 py-1 md:py-1.5 rounded-lg text-[8px] md:text-[9px] font-black transition-all ${currency.code === '3' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
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
                      className={`px-3 md:px-4 py-1 md:py-1.5 rounded-lg text-[8px] md:text-[9px] font-black transition-all ${currency.code === '1' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                    >
                      USD
                    </button>
                  </div>
                  {shareUrl && (
                    <div className="mt-3 space-y-2 max-w-full md:max-w-xs">
                      <ShareButton
                        url={shareUrl}
                        title={`${viewedUser?.name || 'User'}'s Vault - SkinVault`}
                        text={`Check out ${viewedUser?.name || 'this user'}'s CS2 inventory on SkinVault`}
                        variant="button"
                        className="text-[8px] md:text-[9px]"
                      />
                      <p className="text-[8px] md:text-[9px] text-gray-600 break-all bg-black/40 px-2 md:px-3 py-1.5 md:py-2 rounded-xl border border-white/5 select-all cursor-text">
                        {shareUrl}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 md:px-10 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center gap-4 md:gap-6 shadow-inner w-full md:w-auto">
                <TrendingUp className="text-emerald-500 shrink-0" size={24} />
                <div className="min-w-0">
                  <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Vault Value</p>
                  <p className="text-2xl md:text-4xl font-black text-white italic tracking-tighter break-words">{currency.symbol}{"\u00A0"}{totalVaultValue}</p>
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

            {topItems.length > 0 && (
              <section className="space-y-3 md:space-y-4">
                <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                    Top Items
                  </h3>
                  <span className="text-[9px] md:text-[10px] text-gray-500">
                    Most valuable skins in this vault
                  </span>
                </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {topItems.map(({ item, price }, idx) => (
                  <Link
                    key={(item.assetid || getItemDisplayName(item)) + idx}
                    href={`/item/${encodeURIComponent(getMarketKey(item) || getItemDisplayName(item))}`}
                    prefetch={false}
                    className="bg-[#11141d] p-3 md:p-4 rounded-[2rem] md:rounded-3xl border border-yellow-500/30 flex items-center gap-3 md:gap-4 shadow-xl hover:border-yellow-400/60 hover:-translate-y-1 transition-all"
                  >
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-black/40 flex items-center justify-center border border-yellow-500/30 overflow-hidden shrink-0">
                      <img
                        src={`https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`}
                        className="w-full h-full object-contain"
                        alt={getItemDisplayName(item)}
                      />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-[9px] md:text-[10px] font-black uppercase leading-tight text-white line-clamp-2">
                        {getItemDisplayName(item)}
                      </p>
                      <p className="text-[10px] md:text-xs font-black text-emerald-400 italic">
                        {currency.symbol}
                        {price.toLocaleString('nl-NL', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              </section>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              <StatCard label="K/D Ratio" icon={<Skull size={12}/>} val={playerStats?.kd} />
              <StatCard label="Total Kills" icon={<Swords size={12}/>} val={playerStats?.kills} color="text-blue-500" />
              <StatCard label="Wins" icon={<Award size={12}/>} val={playerStats?.wins} color="text-emerald-500" />
              <StatCard label="HS %" icon={<Target size={12}/>} val={playerStats?.hs} unit="%" />
              <StatCard label="Total Items" icon={<PackageOpen size={12}/>} val={totalItems} />
              <StatCard label="Priced Items" icon={<TrendingUp size={12}/>} val={pricedItems} />
            </div>
            
            {/* Pro Performance Indicator */}
            {isPro && (
              <div className="mt-4 flex items-center gap-2 px-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-1.5">
                  <span className="text-[10px]">⚡</span>
                  Pro Performance Active
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
              </div>
            )}
            
            {/* Pro-only Advanced Stats */}
            {playerStats && (isPro ? (
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[8px]">PRO</span>
                    Advanced Stats
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                  <StatCard label="ADR" icon={<TrendingUp size={12}/>} val={playerStats?.adr} color="text-purple-400" />
                  <StatCard label="MVPs" icon={<Award size={12}/>} val={playerStats?.mvps} color="text-amber-400" />
                  <StatCard label="Accuracy" icon={<Target size={12}/>} val={playerStats?.accuracy} unit="%" color="text-cyan-400" />
                  <StatCard label="Rounds Played" icon={<PackageOpen size={12}/>} val={playerStats?.roundsPlayed} color="text-indigo-400" />
                  <StatCard label="Total Damage" icon={<Swords size={12}/>} val={playerStats?.totalDamage} color="text-red-400" />
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600/30 to-transparent" />
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-gray-500 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-gray-600/10 border border-gray-600/40 text-[8px]">LOCKED</span>
                    Advanced Stats
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600/30 to-transparent" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                  <div className="bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 opacity-50 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Link href="/pro" className="text-[8px] md:text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors">
                        Upgrade to Pro
                      </Link>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3 text-[8px] md:text-[9px] font-black uppercase text-gray-500 tracking-widest">
                      <TrendingUp size={12}/> ADR
                    </div>
                    <div className="text-lg md:text-xl font-black italic tracking-tighter text-gray-600">
                      ---
                    </div>
                  </div>
                  <div className="bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 opacity-50 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Link href="/pro" className="text-[8px] md:text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors">
                        Upgrade to Pro
                      </Link>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3 text-[8px] md:text-[9px] font-black uppercase text-gray-500 tracking-widest">
                      <Award size={12}/> MVPs
                    </div>
                    <div className="text-lg md:text-xl font-black italic tracking-tighter text-gray-600">
                      ---
                    </div>
                  </div>
                  <div className="bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 opacity-50 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Link href="/pro" className="text-[8px] md:text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors">
                        Upgrade to Pro
                      </Link>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3 text-[8px] md:text-[9px] font-black uppercase text-gray-500 tracking-widest">
                      <Target size={12}/> Accuracy
                    </div>
                    <div className="text-lg md:text-xl font-black italic tracking-tighter text-gray-600">
                      ---
                    </div>
                  </div>
                  <div className="bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 opacity-50 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Link href="/pro" className="text-[8px] md:text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors">
                        Upgrade to Pro
                      </Link>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3 text-[8px] md:text-[9px] font-black uppercase text-gray-500 tracking-widest">
                      <PackageOpen size={12}/> Rounds
                    </div>
                    <div className="text-lg md:text-xl font-black italic tracking-tighter text-gray-600">
                      ---
                    </div>
                  </div>
                  <div className="bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 opacity-50 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Link href="/pro" className="text-[8px] md:text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors">
                        Upgrade to Pro
                      </Link>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3 text-[8px] md:text-[9px] font-black uppercase text-gray-500 tracking-widest">
                      <Swords size={12}/> Damage
                    </div>
                    <div className="text-lg md:text-xl font-black italic tracking-tighter text-gray-600">
                      ---
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <section className="space-y-6 md:space-y-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-2 md:px-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <PackageOpen className="text-blue-500 shrink-0" size={24} />
                  <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">Secured Items</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <input 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="bg-[#11141d] border border-white/5 rounded-2xl py-2.5 md:py-3 px-4 md:px-6 text-[10px] md:text-[11px] outline-none font-black uppercase tracking-widest focus:border-blue-500/50 w-full sm:w-72 transition-all shadow-xl" 
                    placeholder="SEARCH VAULT..." 
                  />
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                    className="bg-[#11141d] border border-white/5 rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 focus:border-blue-500/50 outline-none shadow-xl"
                  >
                    <option value="price-desc">Sort: Price High → Low</option>
                    <option value="price-asc">Sort: Price Low → High</option>
                    <option value="name-asc">Sort: Name A → Z</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {sortedInv.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/10 rounded-[2.5rem] bg-black/20">
                    <PackageOpen className="text-gray-600 mb-4" size={32} />
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
                      No items match your search
                    </p>
                    <p className="text-[10px] text-gray-600 mt-2">
                      Try clearing your search or adjusting the sort order.
                    </p>
                  </div>
                ) : (
                  sortedInv.map((item, idx) => {
                    const itemKey = getMarketKey(item) || getItemDisplayName(item);
                    const isWishlisted = wishlist.some(w => w.market_hash_name === itemKey || w.key === itemKey);
                    const wishlistKey = itemKey;
                    
                    return (
                      <div key={idx} className="group relative">
                        <Link
                          href={`/item/${encodeURIComponent(getMarketKey(item) || getItemDisplayName(item))}`}
                          prefetch={false}
                          className="block"
                        >
                          <div className="bg-[#11141d] p-4 md:p-7 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/5 flex flex-col group-hover:border-blue-500/40 transition-all group-hover:-translate-y-1 md:group-hover:-translate-y-2 relative overflow-hidden shadow-xl">
                            <img 
                              src={`https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`} 
                              className="w-full h-24 md:h-32 object-contain mb-4 md:mb-6 z-10 drop-shadow-2xl group-hover:scale-110 transition-transform duration-500" 
                              alt="skin" 
                            />
                            <div className="mt-auto space-y-1.5 md:space-y-2">
                              <p className="text-[9px] md:text-[10px] font-black uppercase leading-tight text-white/90 line-clamp-2">{getItemDisplayName(item)}</p>
                              <p className="text-[10px] md:text-[11px] font-black text-emerald-500 italic">
                                {getPriceForItem(item, itemPrices) 
                                  ? getPriceForItem(item, itemPrices) 
                                  : priceScanDone 
                                    ? ((item.marketable === 0 || item.marketable === false) ? <span className="text-gray-500 text-[8px] md:text-[9px]">NOT MARKETABLE</span> : <span className="text-gray-500 text-[8px] md:text-[9px]">NO PRICE</span>)
                                    : <span className="text-gray-600 animate-pulse text-[8px] md:text-[9px]">
                                        {isPro ? '⚡ FAST SCAN...' : 'SCANNING...'}
                                      </span>}
                              </p>
                            </div>
                          </div>
                        </Link>
                        
                        {/* Action Buttons - Only show for logged-in user */}
                        {loggedInUser?.steamId && (
                          <div className="absolute top-2 right-2 z-20 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Compare Button */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCompareModalItem({
                                    id: itemKey,
                                    name: getItemDisplayName(item),
                                    image: `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`,
                                    market_hash_name: itemKey,
                                });
                                setShowCompareModal(true);
                              }}
                              className="p-2 rounded-lg border border-white/10 bg-black/60 hover:border-blue-500 hover:bg-blue-500/10 transition-all"
                              title="Add to Compare"
                            >
                              <Scale size={12} className="text-blue-400" />
                            </button>
                            
                            {/* Price Tracker Button */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTrackerModalItem({
                                  id: itemKey,
                                  name: getItemDisplayName(item),
                                  image: `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`,
                                  market_hash_name: itemKey,
                                });
                                setShowTrackerModal(true);
                              }}
                              className="p-2 rounded-lg border border-white/10 bg-black/60 hover:border-purple-500 hover:bg-purple-500/10 transition-all"
                              title="Price Tracker"
                            >
                              <Bell size={12} className="text-purple-400" />
                            </button>
                            
                            {/* Wishlist Button */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const result = toggleWishlistEntry(
                                  {
                                    key: wishlistKey,
                                    name: getItemDisplayName(item),
                                    image: `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`,
                                    market_hash_name: itemKey,
                                  },
                                  loggedInUser.steamId,
                                  loggedInUserPro,
                                );
                                if (result.success) {
                                  setWishlist(result.newList);
                                } else if (result.reason === 'limit_reached') {
                                  setShowUpgradeModal(true);
                                }
                              }}
                              className={`p-2 rounded-lg border border-white/10 bg-black/60 transition-all ${
                                isWishlisted 
                                  ? 'border-rose-500 bg-rose-500/20 hover:bg-rose-500/30' 
                                  : 'hover:border-rose-500 hover:bg-rose-500/10'
                              }`}
                              title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                            >
                              <Heart 
                                size={12} 
                                className={isWishlisted ? 'text-rose-500 fill-rose-500' : 'text-gray-400'} 
                              />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}
        </main>
      </div>
      
      {showManageTrackers && loggedInUser?.steamId && (
        <ManagePriceTrackers
          isOpen={showManageTrackers}
          onClose={() => setShowManageTrackers(false)}
          steamId={loggedInUser.steamId}
          isPro={loggedInUserPro}
        />
      )}
      
      {showTrackerModal && trackerModalItem && loggedInUser && (
        <PriceTrackerModal
          isOpen={showTrackerModal}
          onClose={() => {
            setShowTrackerModal(false);
            setTrackerModalItem(null);
          }}
          item={trackerModalItem}
          user={loggedInUser}
          isPro={loggedInUserPro}
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
      
      {showCompareModal && compareModalItem && (
        <CompareModal
          isOpen={showCompareModal}
          onClose={() => {
            setShowCompareModal(false);
            setCompareModalItem(null);
          }}
          currentItem={compareModalItem}
        />
      )}
    </>
  );
}

export default function InventoryPage() { 
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#08090d] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Loading...</p>
      </div>
    }>
      <InventoryContent />
    </Suspense>
  ); 
}