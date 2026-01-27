"use client";

import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { Loader2, PackageOpen, Target, Skull, Award, Swords, TrendingUp, Lock, MessageSquare, CheckCircle2, Settings, Bell, Heart, Scale, Trophy, HelpCircle, User, Mail, X, Wallet, Trash2 } from 'lucide-react';
import { getPriceScanConcurrencySync, getWishlistLimitSync } from '@/app/utils/pro-limits';
import { fetchWithProxyRotation, checkProStatus } from '@/app/utils/proxy-utils';
import dynamic from 'next/dynamic';
import HelpTooltip from '@/app/components/HelpTooltip';

// Dynamic imports for modals to reduce initial bundle size
const ManagePriceTrackers = dynamic(() => import('@/app/components/ManagePriceTrackers'), {
  ssr: false,
});
const PriceTrackerModal = dynamic(() => import('@/app/components/PriceTrackerModal'), {
  ssr: false,
});
const ProUpgradeModal = dynamic(() => import('@/app/components/ProUpgradeModal'), {
  ssr: false,
});
const CompareModal = dynamic(() => import('@/app/components/CompareModal'), {
  ssr: false,
});
import { InventoryItemSkeleton, ProfileHeaderSkeleton, StatCardSkeleton } from '@/app/components/LoadingSkeleton';
import ShareButton from '@/app/components/ShareButton';
import { copyToClipboard } from '@/app/utils/clipboard';
import { useToast } from '@/app/components/Toast';
import { isBanned } from '@/app/utils/ban-check';
import { fetchWishlistFromServer, loadWishlist, saveWishlist, toggleWishlistEntryServer } from '@/app/utils/wishlist';
import { getRankForValue } from '@/app/utils/rank-tiers';
import { isOwner } from '@/app/utils/owner-ids';

// STEAM_API_KEYS removed - using environment variables instead

const STEAM_CURRENCY_TO_ISO: Record<string, string> = {
  '1': 'USD',
  '2': 'GBP',
  '3': 'EUR',
  '5': 'RUB',
  '6': 'PLN',
  '7': 'BRL',
  '8': 'JPY',
  '9': 'NOK',
  '10': 'IDR',
  '11': 'MYR',
  '12': 'PHP',
  '13': 'SGD',
  '14': 'THB',
  '15': 'VND',
  '16': 'KRW',
  '17': 'TRY',
  '18': 'UAH',
  '19': 'MXN',
  '20': 'CAD',
  '21': 'AUD',
  '22': 'NZD',
  '23': 'CNY',
  '24': 'INR',
  '29': 'HKD',
  '30': 'TWD',
  '33': 'SEK',
  '35': 'ILS',
  '28': 'ZAR',
};

const ISO_TO_STEAM_CURRENCY: Record<string, string> = {
  USD: '1',
  GBP: '2',
  EUR: '3',
  RUB: '5',
  PLN: '6',
  BRL: '7',
  JPY: '8',
  NOK: '9',
  IDR: '10',
  MYR: '11',
  PHP: '12',
  SGD: '13',
  THB: '14',
  VND: '15',
  KRW: '16',
  TRY: '17',
  UAH: '18',
  MXN: '19',
  CAD: '20',
  AUD: '21',
  NZD: '22',
  CNY: '23',
  INR: '24',
  HKD: '29',
  TWD: '30',
  SEK: '33',
  ILS: '35',
  ZAR: '28',
};

function getCurrencyMetaFromSteamCode(code: string): { iso: string; locale: string; symbol: string } {
  const iso = STEAM_CURRENCY_TO_ISO[String(code)] || 'USD';
  const locale = (() => {
    if (iso === 'EUR') return 'en-US';
    if (iso === 'GBP') return 'en-GB';
    if (iso === 'JPY') return 'ja-JP';
    if (iso === 'KRW') return 'ko-KR';
    if (iso === 'TRY') return 'tr-TR';
    if (iso === 'PLN') return 'pl-PL';
    return 'en-US';
  })();
  const symbol = (() => {
    if (iso === 'EUR') return '€';
    if (iso === 'GBP') return '£';
    if (iso === 'JPY') return '¥';
    if (iso === 'KRW') return '₩';
    if (iso === 'TRY') return '₺';
    if (iso === 'RUB') return '₽';
    if (iso === 'PLN') return 'zł';
    return '$';
  })();
  return { iso, locale, symbol };
}

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

type PublicCoupon = {
  code: string;
  name: string | null;
  kind: 'percent' | 'amount';
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  startsAt: string | null;
  expiresAt: string | null;
};

function formatCouponValue(c: PublicCoupon): string {
  if (c.kind === 'percent') {
    const p = Number(c.percentOff);
    return Number.isFinite(p) && p > 0 ? `${p}%` : 'Discount';
  }

  const cents = Number(c.amountOff);
  if (!Number.isFinite(cents) || cents <= 0) return 'Discount';

  const iso = String(c.currency || '').trim().toUpperCase();
  const symbol = (() => {
    if (iso === 'EUR') return '€';
    if (iso === 'USD') return '$';
    if (iso === 'GBP') return '£';
    return '';
  })();

  const amount = cents / 100;
  const decimals = Math.abs(amount - Math.round(amount)) < 0.000001 ? 0 : 2;
  const formatted = amount.toFixed(decimals);
  if (symbol) return `${symbol}${formatted}`;
  return iso ? `${formatted} ${iso}` : formatted;
}

function hexToRgba(hex: string, alpha: number) {
  try {
    const h = String(hex || '').trim().replace('#', '');
    const a = Math.max(0, Math.min(1, Number(alpha)));
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  } catch {
  }
  return `rgba(255, 255, 255, ${Math.max(0, Math.min(1, Number(alpha)))})`;
}

function formatProfileName(name: string): string {
  const normalized = String(name || '')
    .replace(/\s+/g, ' ')
    .trim();

  const withoutSiteSuffix = normalized
    .replace(/\s*\|\s*(?:www\.)?skinvaults\.online\s*$/i, '')
    .trim();

  return withoutSiteSuffix
    .replace(/\s*\|\s*/g, ' | ')
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

function isNonMarketable(item: InventoryItem): boolean {
  return item.marketable === 0 || item.marketable === false;
}

function stripWearFromMarketName(name: string): string {
  return String(name || '')
    .replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWeaponAndSkinLabels(item: InventoryItem): { weaponName: string; skinName: string } {
  const mhnRaw = String(item.market_hash_name || item.market_name || item.name || item.display_name || '').trim();
  const mhn = stripWearFromMarketName(mhnRaw);
  const weaponName = mhn.includes('|') ? mhn.split('|')[0].trim() : '';
  const skinName = mhn.includes('|') ? mhn.split('|').slice(1).join('|').trim() : '';
  return { weaponName: weaponName || '—', skinName: skinName || '' };
}

function StatCard({ label, icon, val, unit = "", color = "text-white" }: any) {
  const hasValue = (() => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'number') return Number.isFinite(val);
    if (typeof val === 'string') return val.trim().length > 0;
    return true;
  })();
  if (!hasValue) return null;

  return (
    <div className="bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/5">
      <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3 text-[8px] md:text-[9px] font-black uppercase text-gray-500 tracking-widest">
        {icon} {label}
      </div>
      <div className={`text-lg md:text-xl font-black italic tracking-tighter ${color}`}>
        {val}{unit}
      </div>
    </div>
  );
}

type PublicProfileStatus = {
  ok?: boolean;
  steamId?: string;
  creditsBalance?: number;
  banned?: boolean;
  banReason?: string | null;
  timeoutUntil?: string | null;
  timeoutActive?: boolean;
  timeoutMinutesRemaining?: number;
  timeoutReason?: string | null;
  creditsBanned?: boolean;
  creditsTimeoutUntil?: string | null;
  creditsTimeoutActive?: boolean;
  creditsTimeoutMinutesRemaining?: number;
};

type NotificationRow = {
  id: string;
  steamId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string | null;
  readAt: string | null;
  meta: any;
};

function InventoryContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  const [websiteProfilePrivate, setWebsiteProfilePrivate] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [itemPrices, setItemPrices] = useState<{ [key: string]: string }>({});
  const [currency, setCurrency] = useState({ code: '3', symbol: '€' });
  const [inventoryCacheState, setInventoryCacheState] = useState<string | null>(null);
  const [inventoryFetchedAt, setInventoryFetchedAt] = useState<number | null>(null);
  const [refreshingInventory, setRefreshingInventory] = useState(false);
  const [viewedUser, setViewedUser] = useState<any>(null);
  const [cs2Overview, setCs2Overview] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [faceitStats, setFaceitStats] = useState<any>(null);
  const [statsPrivate, setStatsPrivate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceScanDone, setPriceScanDone] = useState(false);
  const [sortMode, setSortMode] = useState<'name-asc' | 'price-desc' | 'price-asc'>('price-desc');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<any>(null);
  const [hasDiscordAccess, setHasDiscordAccess] = useState(false);
  const [showManageTrackers, setShowManageTrackers] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackerModalItem, setTrackerModalItem] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loggedInUserPro, setLoggedInUserPro] = useState(false);
  const [tradeUrl, setTradeUrl] = useState<string>('');
  const [tradeUrlInput, setTradeUrlInput] = useState<string>('');
  const [tradeUrlLoading, setTradeUrlLoading] = useState(false);
  const [tradeUrlSaving, setTradeUrlSaving] = useState(false);
  const [viewAsOthers, setViewAsOthers] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [isPrime, setIsPrime] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareModalItem, setCompareModalItem] = useState<any>(null);

  const [publicCoupons, setPublicCoupons] = useState<PublicCoupon[]>([]);

  const [publicStatusLoading, setPublicStatusLoading] = useState(false);
  const [publicStatus, setPublicStatus] = useState<PublicProfileStatus | null>(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsRows, setNotificationsRows] = useState<NotificationRow[]>([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null);
  const [actorProfilesBySteamId, setActorProfilesBySteamId] = useState<Record<string, { name?: string; avatar?: string }>>({});
  const [notificationPreview, setNotificationPreview] = useState<{ title?: string; imageUrl: string } | null>(null);

  const priceCacheRef = useRef<{ [key: string]: string }>({});
  const toast = useToast();

  const [discordIdInput, setDiscordIdInput] = useState<string>('');
  const [discordIdLoading, setDiscordIdLoading] = useState(false);
  const [discordIdSaving, setDiscordIdSaving] = useState(false);
  const [showDiscordIdModal, setShowDiscordIdModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const onUserUpdated = () => {
      try {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
        const parsed = stored ? JSON.parse(stored) : null;
        const sid = String(parsed?.steamId || '').trim();

        if (sid && /^\d{17}$/.test(sid)) {
          setLoggedInUser(parsed);
          fetchWishlistFromServer()
            .then((server) => {
              if (cancelled) return;
              if (!server.ok) return;
              setWishlist(server.wishlist);
              saveWishlist(server.wishlist, sid);
            })
            .catch(() => {});
          checkProStatus(sid).then(setLoggedInUserPro).catch(() => setLoggedInUserPro(false));
          return;
        }

        setLoggedInUser(null);
        setWishlist([]);
        setLoggedInUserPro(false);
      } catch {
        setLoggedInUser(null);
        setWishlist([]);
        setLoggedInUserPro(false);
      }
    };

    onUserUpdated();
    window.addEventListener('userUpdated', onUserUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('userUpdated', onUserUpdated);
    };
  }, []);

  const cacheKey = useMemo(() => `sv_price_cache_${currency.code}`, [currency.code]);
  const isPro = useMemo(() => {
    if (!loggedInUser?.steamId) return false;
    if (loggedInUserPro) return true;
    const until = loggedInUser?.proUntil;
    return !!(until && new Date(until) > new Date());
  }, [loggedInUser?.steamId, loggedInUser?.proUntil, loggedInUserPro]);

  const loggedInIsOwner = useMemo(() => isOwner(loggedInUser?.steamId), [loggedInUser?.steamId]);
  const viewingOwnProfile = useMemo(
    () => !!(loggedInUser?.steamId && viewedUser?.steamId && String(loggedInUser.steamId) === String(viewedUser.steamId)),
    [loggedInUser?.steamId, viewedUser?.steamId]
  );
  const effectiveIsOwner = useMemo(() => viewingOwnProfile && !viewAsOthers, [viewingOwnProfile, viewAsOthers]);

  useEffect(() => {
    if (viewAsOthers) {
      setIsEditingProfile(false);
    }
  }, [viewAsOthers]);

  useEffect(() => {
    let cancelled = false;
    const sid = String(loggedInUser?.steamId || '').trim();
    const qs = /^\d{17}$/.test(sid) ? `?steamId=${encodeURIComponent(sid)}` : '';
    fetch(`/api/coupons/public${qs}`, { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) {
          setPublicCoupons([]);
          return;
        }
        const rows = Array.isArray(j?.coupons) ? (j.coupons as PublicCoupon[]) : [];
        setPublicCoupons(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setPublicCoupons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedInUser?.steamId]);

  const notificationsTargetSteamId = useMemo(() => {
    const loggedInSteamId = String(loggedInUser?.steamId || '').trim();
    const viewedSteamId = String(viewedUser?.steamId || '').trim();
    if (!loggedInSteamId || !/^\d{17}$/.test(loggedInSteamId)) return null;
    if (loggedInIsOwner && viewedSteamId && /^\d{17}$/.test(viewedSteamId)) return viewedSteamId;
    return loggedInSteamId;
  }, [loggedInIsOwner, loggedInUser?.steamId, viewedUser?.steamId]);

  const canOpenNotifications = useMemo(() => {
    const loggedInSteamId = String(loggedInUser?.steamId || '').trim();
    const viewedSteamId = String(viewedUser?.steamId || '').trim();
    if (!loggedInSteamId || !/^\d{17}$/.test(loggedInSteamId)) return false;
    if (loggedInIsOwner) return true;
    return !!(viewedSteamId && loggedInSteamId === viewedSteamId);
  }, [loggedInIsOwner, loggedInUser?.steamId, viewedUser?.steamId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const steamId = String(viewedUser?.steamId || '').trim();
        if (!steamId || !/^\d{17}$/.test(steamId)) {
          if (!cancelled) setPublicStatus(null);
          if (!cancelled) setPublicStatusLoading(false);
          return;
        }

        setPublicStatusLoading(true);
        try {
          const res = await fetch(`/api/user/profile-public?steamId=${encodeURIComponent(steamId)}`, { cache: 'no-store' });
          const json = await res.json().catch(() => null);
          if (!res.ok) throw new Error(json?.error || 'Failed to load profile status');
          if (!cancelled) setPublicStatus(json as any);
        } catch {
          if (!cancelled) setPublicStatus(null);
        } finally {
          if (!cancelled) setPublicStatusLoading(false);
        }
      } catch {
        if (!cancelled) setPublicStatus(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [viewedUser?.steamId]);

  useEffect(() => {
    if (!viewedUser?.steamId) return;
    try {
      if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        setShareUrl(`${origin}/inventory/${viewedUser.steamId}?currency=${encodeURIComponent(currency.code)}`);
      }
    } catch {
      setShareUrl(null);
    }
  }, [viewedUser, currency.code]);

  useEffect(() => {
    if (!viewedUser?.steamId || !loggedInUser?.steamId || loggedInUser.steamId !== viewedUser.steamId) {
      setDiscordIdInput('');
      return;
    }

    let cancelled = false;
    setDiscordIdLoading(true);
    fetch('/api/user/discord-id', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const d = String(j?.discordId || '').trim();
        setDiscordIdInput(d);
      })
      .catch(() => {
        if (cancelled) return;
        setDiscordIdInput('');
      })
      .finally(() => {
        if (cancelled) return;
        setDiscordIdLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewedUser?.steamId, loggedInUser?.steamId]);

  useEffect(() => {
    if (!isEditingProfile) return;
    if (!effectiveIsOwner) return;
    if (!(isPro || hasDiscordAccess)) return;
    if (discordIdLoading) return;

    const connected = !!discordStatus?.connected;
    const hasManual = /^\d{17,20}$/.test(String(discordIdInput || '').trim());
    if (!connected && !hasManual) {
      setShowDiscordIdModal(true);
    }
  }, [isEditingProfile, effectiveIsOwner, isPro, hasDiscordAccess, discordIdLoading, discordStatus?.connected, discordIdInput]);

  const handleSaveDiscordId = async () => {
    if (!loggedInUser?.steamId || loggedInUser.steamId !== viewedUser?.steamId) {
      toast.error('Sign in to update your Discord ID');
      return;
    }

    setDiscordIdSaving(true);
    try {
      const res = await fetch('/api/user/discord-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: discordIdInput }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(String(json?.error || 'Failed to save Discord ID'));
        return;
      }
      const d = String(json?.discordId || '').trim();
      setDiscordIdInput(d);
      toast.success('Discord ID saved');
      setShowDiscordIdModal(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save Discord ID');
    } finally {
      setDiscordIdSaving(false);
    }
  };

  const loadNotifications = async () => {
    if (!notificationsTargetSteamId) return;
    setNotificationsLoading(true);
    try {
      const url = `/api/user/notifications?limit=100&steamId=${encodeURIComponent(String(notificationsTargetSteamId))}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed to load notifications');
      const rows = Array.isArray(json?.notifications) ? (json.notifications as NotificationRow[]) : [];
      setNotificationsRows(rows);
      setNotificationsUnreadCount(Number(json?.unreadCount || 0));

      const nextActorIds = Array.from(
        new Set(
          rows
            .map((r) => String(r?.meta?.bySteamId || '').trim())
            .filter((x) => /^\d{17}$/.test(x))
        )
      );

      const missing = nextActorIds.filter((id) => !actorProfilesBySteamId[id]);
      if (missing.length > 0) {
        const fetched: Record<string, { name?: string; avatar?: string }> = {};
        await Promise.all(
          missing.slice(0, 25).map(async (id) => {
            try {
              const pr = await fetch(`/api/steam/profile?steamId=${encodeURIComponent(id)}`, { cache: 'no-store' });
              if (!pr.ok) return;
              const pj = await pr.json().catch(() => null);
              fetched[id] = { name: String(pj?.name || ''), avatar: String(pj?.avatar || '') };
            } catch {
            }
          })
        );
        setActorProfilesBySteamId((prev) => ({ ...prev, ...fetched }));
      }
    } catch (e: any) {
      setNotificationsRows([]);
      setNotificationsUnreadCount(0);
      toast.error(e?.message || 'Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationsRead = async (ids: string[], markAll?: boolean) => {
    if (!notificationsTargetSteamId) return;
    try {
      const res = await fetch('/api/user/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: String(notificationsTargetSteamId), ids, markAll: !!markAll }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('user-notifications-updated'));
      }
      await loadNotifications();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update notifications');
    }
  };

  const deleteNotifications = async (ids: string[]) => {
    if (!notificationsTargetSteamId) return;
    const list = (Array.isArray(ids) ? ids : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 200);
    if (list.length === 0) return;
    try {
      const res = await fetch('/api/user/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: String(notificationsTargetSteamId), ids: list }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Failed');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('user-notifications-updated'));
      }
      await loadNotifications();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete notification');
    }
  };

  useEffect(() => {
    let alive = true;

    const updateUnread = async () => {
      if (!canOpenNotifications || !notificationsTargetSteamId) {
        setNotificationsUnreadCount(0);
        return;
      }
      try {
        const res = await fetch(`/api/user/notifications?limit=1&unreadOnly=true&steamId=${encodeURIComponent(String(notificationsTargetSteamId))}`, { cache: 'no-store' });
        if (!res.ok) {
          if (alive) setNotificationsUnreadCount(0);
          return;
        }
        const json = await res.json().catch(() => null);
        const c = Number(json?.unreadCount || 0);
        if (alive) setNotificationsUnreadCount(Number.isFinite(c) ? c : 0);
      } catch {
        if (alive) setNotificationsUnreadCount(0);
      }
    };

    void updateUnread();

    const handleUpdated = () => {
      void updateUnread();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('user-notifications-updated', handleUpdated);
    }

    const interval = setInterval(updateUnread, 15000);
    return () => {
      alive = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('user-notifications-updated', handleUpdated);
      }
      clearInterval(interval);
    };
  }, [canOpenNotifications, notificationsTargetSteamId]);

  const viewedIsPro = useMemo(
    () => !!(viewedUser?.proUntil && new Date(viewedUser.proUntil) > new Date()),
    [viewedUser?.proUntil]
  );

  const formatHours = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return null;
    const hours = minutes / 60;
    if (!Number.isFinite(hours)) return null;
    return hours;
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!viewedUser?.steamId) {
          if (!cancelled) setIsPartner(false);
          return;
        }
        const res = await fetch('/api/creators');
        if (!res.ok) {
          if (!cancelled) setIsPartner(false);
          return;
        }
        const json = await res.json();
        const creators = Array.isArray(json?.creators) ? json.creators : [];
        const match = creators.some((c: any) => String(c?.partnerSteamId || '') === String(viewedUser.steamId));
        if (!cancelled) setIsPartner(!!match);
      } catch {
        if (!cancelled) setIsPartner(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [viewedUser?.steamId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!viewedUser?.steamId) {
          if (!cancelled) setIsPrime(false);
          return;
        }
        const steamId = String(viewedUser.steamId);
        const res = await fetch(`/api/steam/prime?steamId=${encodeURIComponent(steamId)}`);
        if (!res.ok) {
          if (!cancelled) setIsPrime(false);
          return;
        }
        const json = await res.json();
        const prime = !!json?.isPrime;
        if (!cancelled) setIsPrime(prime);

        // If we got a cached/false result, retry once with refresh=1 to pick up
        // XP coins / medals that indicate Prime.
        if (!prime) {
          const res2 = await fetch(`/api/steam/prime?steamId=${encodeURIComponent(steamId)}&refresh=1`, {
            cache: 'no-store',
          });
          if (res2.ok) {
            const json2 = await res2.json();
            if (!cancelled) setIsPrime(!!json2?.isPrime);
          }
        }
      } catch {
        if (!cancelled) setIsPrime(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [viewedUser?.steamId]);

  // Proxy rotation will use Pro status to determine proxy count

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      // Test localStorage accessibility first
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);

      const currencyParamRaw = searchParams.get('currency');
      if (currencyParamRaw) {
        const raw = String(currencyParamRaw).trim();
        const steamCode = /^\d+$/.test(raw) ? raw : (ISO_TO_STEAM_CURRENCY[raw.toUpperCase()] || raw);
        const meta = getCurrencyMetaFromSteamCode(steamCode);
        setCurrency({ code: steamCode, symbol: meta.symbol });
        try {
          window.localStorage.setItem('sv_currency', String(steamCode));
        } catch {
          /* ignore */
        }
        return;
      }
      
      const stored = window.localStorage.getItem('sv_currency');
      if (stored) {
        const meta = getCurrencyMetaFromSteamCode(stored);
        setCurrency({ code: stored, symbol: meta.symbol });
      }
    } catch {
      // Ignore localStorage errors (browser privacy settings, sandboxed iframe, etc.)
    }
  }, [searchParams]);

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

  const formatMoney = (amount: number) => {
    const safe = Number.isFinite(amount) ? amount : 0;
    const meta = getCurrencyMetaFromSteamCode(currency.code);
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.iso,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  };

  const fetchViewedProfile = async (id: string) => {
    try {
      // Use server-side API route instead of proxies
      const res = await fetch(`/api/steam/profile?steamId=${encodeURIComponent(id)}`, {
        cache: 'force-cache', // Cache profile data for faster subsequent loads
      });

      if (res.ok) {
        const data = await res.json();
        return { steamId: id, name: data.name || "User", avatar: data.avatar || "" };
      } else {
        if (res.status === 403) {
          setWebsiteProfilePrivate(true);
        }
        // Silently return null for expected errors (404, 408, etc.)
        return null;
      }
    } catch (e: any) { 
      // Silently fail - don't log expected errors
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
        // Don't log 404s or 502s (expected errors - stats might not be available or API might be down)
        if (res.status !== 404 && res.status !== 502) {
          console.warn("Stats API error", await res.text());
        }
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
    } catch (e: any) { 
      // Don't log AbortErrors (intentional timeouts)
      if (e?.name !== 'AbortError') {
        console.error("Stats failed", e);
      }
    }
  };

  const fetchFaceitStats = async (id: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const res = await fetch(`/api/faceit/stats?id=${id}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        if (res.status === 404) {
          // Player not found on Faceit - this is normal, not an error
          // Silently set to null without logging
          setFaceitStats(null);
          return;
        }
        // Suppress all Faceit API errors - they're not critical
        // Don't log to console to reduce noise
        setFaceitStats(null);
        return;
      }
      
      const data = await res.json();
      const player = data?.player;
      const stats = data?.stats;
      
      if (player) {
        // Even if stats are not available, show basic player info (ELO, level)
        if (!stats) {
          const elo = player?.games?.cs2?.faceit_elo || 0;
          const level = player?.games?.cs2?.skill_level || 0;
          
          if (elo > 0 || level > 0) {
            setFaceitStats({
              elo: elo.toLocaleString(),
              level: level.toString(),
              playerId: player?.player_id,
              nickname: player?.nickname,
            });
          }
          return;
        }
        // Extract relevant stats from Faceit API response
        const lifetime = stats?.lifetime || {};
        const segments = stats?.segments || [];
        const currentSegment = segments.find((s: any) => s.mode === '5v5') || segments[0] || {};
        
        // Get ELO and level from player data
        const elo = player?.games?.cs2?.faceit_elo || 0;
        const level = player?.games?.cs2?.skill_level || 0;
        
        // Calculate stats
        const matches = Number(lifetime?.Matches || currentSegment?.stats?.Matches || 0);
        const wins = Number(lifetime?.Wins || currentSegment?.stats?.Wins || 0);
        const losses = Number(lifetime?.Losses || currentSegment?.stats?.Losses || 0);
        const kills = Number(lifetime?.Kills || currentSegment?.stats?.Kills || 0);
        const deaths = Number(lifetime?.Deaths || currentSegment?.stats?.Deaths || 0);
        const assists = Number(lifetime?.Assists || currentSegment?.stats?.Assists || 0);
        const headshots = Number(lifetime?.Headshots || currentSegment?.stats?.Headshots || 0);
        const mvps = Number(lifetime?.MVPs || currentSegment?.stats?.MVPs || 0);
        const tripleKills = Number(lifetime?.['Triple Kills'] || currentSegment?.stats?.['Triple Kills'] || 0);
        const quadKills = Number(lifetime?.['Quadro Kills'] || currentSegment?.stats?.['Quadro Kills'] || 0);
        const aceKills = Number(lifetime?.['Penta Kills'] || currentSegment?.stats?.['Penta Kills'] || 0);
        
        const kd = deaths > 0 ? (kills / deaths) : kills > 0 ? kills : 0;
        const winRate = matches > 0 ? (wins / matches) * 100 : 0;
        const hsPercent = kills > 0 ? (headshots / kills) * 100 : 0;
        const kast = matches > 0 ? Number(lifetime?.KAST || currentSegment?.stats?.KAST || 0) : 0;
        const avgKills = matches > 0 ? (kills / matches) : 0;
        const avgDeaths = matches > 0 ? (deaths / matches) : 0;
        const avgAssists = matches > 0 ? (assists / matches) : 0;
        
        setFaceitStats({
          elo: elo.toLocaleString(),
          level: level.toString(),
          kd: kd.toFixed(2),
          winRate: winRate.toFixed(1),
          hsPercent: hsPercent.toFixed(1),
          kast: kast.toFixed(1),
          matches: matches.toLocaleString(),
          wins: wins.toLocaleString(),
          losses: losses.toLocaleString(),
          kills: kills.toLocaleString(),
          deaths: deaths.toLocaleString(),
          assists: assists.toLocaleString(),
          headshots: headshots.toLocaleString(),
          mvps: mvps.toLocaleString(),
          tripleKills: tripleKills.toLocaleString(),
          quadKills: quadKills.toLocaleString(),
          aceKills: aceKills.toLocaleString(),
          avgKills: avgKills.toFixed(2),
          avgDeaths: avgDeaths.toFixed(2),
          avgAssists: avgAssists.toFixed(2),
          playerId: player?.player_id,
          nickname: player?.nickname,
        });
      }
    } catch (e: any) { 
      // Don't log AbortErrors (intentional timeouts) or 404s (player not on Faceit)
      // Suppress all Faceit errors - they're not critical
      setFaceitStats(null);
    }
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
    const CONCURRENCY = getPriceScanConcurrencySync(isPro, loggedInUser?.steamId);

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

  const fetchInventory = async (id: string, proStatus?: boolean, options?: { force?: boolean }) => {
    try {
      // Pro status here is for the viewer (affects proxy/scan performance). Never infer from the viewed profile.
      const actualProStatus = !!proStatus;
      const force = !!options?.force;
      
      let allItems: InventoryItem[] = [];
      let startAssetId: string | null = null;
      let hasMore = true;
      
      let attempts = 0;
      const maxAttempts = 20; // Prevent infinite loops

      while (hasMore && attempts < maxAttempts) {
        attempts++;
        
        try {
          // Use server-side API route to avoid CORS issues
          const apiUrl: string = `/api/steam/inventory?steamId=${id}&isPro=${actualProStatus}&currency=${encodeURIComponent(currency.code)}${startAssetId ? `&start_assetid=${startAssetId}` : ''}${force ? '&refresh=1&force=1' : ''}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // Reduced to 15 seconds for faster loading
          
          const res: Response = await fetch(apiUrl, {
            signal: controller.signal,
            cache: 'no-store',
          });
          
          clearTimeout(timeoutId);

          if (!startAssetId) {
            setInventoryCacheState(res.headers.get('x-sv-cache'));
            setInventoryFetchedAt(Date.now());
          }
          
          if (!res.ok) {
            if (res.status === 403) {
              setWebsiteProfilePrivate(true);
              hasMore = false;
              break;
            }
            // Don't log 404s, 502s, or 503s (expected errors - inventory might not be available or API might be down)
            if (res.status !== 404 && res.status !== 502 && res.status !== 503) {
              const errorText = await res.text();
              console.error(`Inventory API error (${res.status}):`, errorText);
            }
            throw new Error(`API returned ${res.status}`);
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
        } catch (e: any) {
          // Don't log AbortErrors (intentional timeouts) or expected network errors
          if (e?.name !== 'AbortError' && 
              !e?.message?.includes('502') && 
              !e?.message?.includes('503') &&
              !e?.message?.includes('404') &&
              !e?.message?.includes('Bad Gateway') &&
              !e?.message?.includes('Failed to fetch')) {
            console.error(`Inventory fetch attempt ${attempts} failed:`, e);
          }
          hasMore = false; // Stop trying if we get an error
        }
      }

      setInventory(allItems);
    } catch (e: any) { 
      // Don't log AbortErrors (intentional timeouts) or expected network errors
      if (e?.name !== 'AbortError' && 
          !e?.message?.includes('502') && 
          !e?.message?.includes('503') &&
          !e?.message?.includes('404') &&
          !e?.message?.includes('Bad Gateway') &&
          !e?.message?.includes('Failed to fetch')) {
        console.error("Inventory failed", e);
      }
      setInventory([]); // Set empty array so page can still render
    }
  };

  const handleForceRefreshInventory = async () => {
    if (!viewedUser?.steamId) return;
    try {
      setRefreshingInventory(true);
      await fetchInventory(String(viewedUser.steamId), isPro, { force: true });
    } finally {
      setRefreshingInventory(false);
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

    const extractSteamIdFromPath = (path: string | null) => {
      const p = String(path || '');
      const parts = p.split('/').filter(Boolean);
      const invIdx = parts.indexOf('inventory');
      const after = invIdx >= 0 ? parts[invIdx + 1] : null;
      if (!after) return null;
      return extractSteamId(after);
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

    const fromPath = extractSteamIdFromPath(pathname);

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
      checkProStatus(storedLoggedInUser.steamId).then(setLoggedInUserPro).catch(() => setLoggedInUserPro(false));
    } else {
      setLoggedInUser(null);
      setWishlist([]);
      setLoggedInUserPro(false);
    }

    // Determine which profile to view
    // Priority: query param > OpenID callback > logged-in user's own profile
    const viewedSteamId =
      extractSteamId(fromQuery) ||
      extractSteamId(fromPath) ||
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
      setWebsiteProfilePrivate(false);
      
      // Check if user is banned (only for login callbacks)
      if (isLoginCallback) {
        const banned = await isBanned(viewedSteamId);
        if (banned) {
          setLoading(false);
          // Clear any stored user data
          try {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('steam_user');
              // Store banned notification state with timestamp (30 seconds) and steamId
              const bannedNotification = {
                message: 'Your account has been banned from this service. Please contact support if you believe this is an error.',
                timestamp: Date.now(),
                duration: 30000, // 30 seconds
                steamId: viewedSteamId, // Store steamId to check ban status later
                shown: false, // Flag to prevent duplicate notifications
              };
              window.localStorage.setItem('sv_banned_notification', JSON.stringify(bannedNotification));
              // Don't show notification here - let the ToastProvider handle it on the contact page
              // Clean up URL (remove OpenID params) and redirect to contact page immediately
              window.history.replaceState({}, '', '/contact');
              window.location.href = '/contact';
            }
          } catch {}
          return;
        }
      }

      // Fetch Pro status of the VIEWED profile (only used for displaying badges, not gating features)
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

      // Viewer Pro status for inventory fetch (performance-only)
      let proStatusForInventory = false;
      if (storedLoggedInUser?.steamId) {
        try {
          proStatusForInventory = await checkProStatus(storedLoggedInUser.steamId);
        } catch {
          proStatusForInventory = false;
        }
      }
      
      // Start all requests in parallel - show content progressively
      const profilePromise = fetchViewedProfile(viewedSteamId);
      
      // These can load in background - use correct Pro status for inventory
      // Don't wait for these - they'll update when ready
      Promise.all([
        fetchPlayerStats(viewedSteamId).catch(() => {}),
        fetchFaceitStats(viewedSteamId).catch(() => {}),
        fetchInventory(viewedSteamId, proStatusForInventory).catch(() => {}),
      ]).catch(() => {
        // Ignore errors - already handled in individual functions
      });

      // Wait for profile with timeout - Pro info already fetched above
      // Reduced timeout to 5 seconds for faster initial load
      try {
        const profile = await Promise.race([
          profilePromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]) as any;

        const combinedUser = profile
          ? { ...profile, proUntil: proInfo?.proUntil || null }
          : null;

        setViewedUser(combinedUser);
        // Set loading to false once profile is loaded - don't wait for inventory
        setLoading(false);
        
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
                  // Notify sidebar and other components of user update
                  window.dispatchEvent(new CustomEvent('userUpdated'));
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
              let sessionOk = false;
              try {
                const sessionRes = await fetch('/api/auth/steam/session', { cache: 'no-store' });
                const sessionJson = await sessionRes.json().catch(() => null);
                const sessionSteamId = String(sessionJson?.steamId || '').trim();
                sessionOk = sessionRes.ok && sessionSteamId === String(viewedSteamId);
              } catch {
                sessionOk = false;
              }

              if (!sessionOk) {
                try {
                  window.localStorage.setItem('sv_logout_ts', String(Date.now()));
                  window.localStorage.removeItem('steam_user');
                  window.localStorage.removeItem('user_inventory');
                } catch {
                }
                toast.error('Steam session could not be verified. Please sign in again.');
                return;
              }

              // This is your actual login - record first login date (don't block on this)
              fetch('/api/user/first-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steamId: viewedSteamId }),
              }).catch(() => {}); // Silently fail if this doesn't work
              
              // This is your actual login - update the logged-in user completely
              window.localStorage.setItem('steam_user', JSON.stringify(combinedUser));
              setLoggedInUser(combinedUser);
              setWishlist(loadWishlist(String(combinedUser.steamId)));
              checkProStatus(String(combinedUser.steamId)).then(setLoggedInUserPro).catch(() => setLoggedInUserPro(false));
              // Trigger 'userUpdated' event so sidebar updates
              window.dispatchEvent(new CustomEvent('userUpdated'));
            } else if (isViewingOwnProfile && loggedInUser) {
              // Viewing your own profile - only update Pro status, keep your account info
              const updatedUser = {
                ...loggedInUser,
                proUntil: combinedUser.proUntil, // Update Pro status
              };
              window.localStorage.setItem('steam_user', JSON.stringify(updatedUser));
              // Trigger 'userUpdated' event so sidebar updates
              window.dispatchEvent(new CustomEvent('userUpdated'));
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
            // Preserve Pro status we already fetched earlier
            proUntil: proInfo?.proUntil || null 
          };
        }
        
        setViewedUser(fallbackUser);
        
        // Don't update localStorage on timeout - keep existing data
      }

      setLoading(false);
    };
    loadAll();
  }, [searchParams, pathname]);

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
    const sid = String(viewedUser?.steamId || '').trim();
    if (!/^\d{17}$/.test(sid)) {
      setTradeUrl('');
      setTradeUrlInput('');
      return;
    }

    let cancelled = false;
    setTradeUrlLoading(true);
    fetch(`/api/user/trade-url?steamId=${encodeURIComponent(sid)}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (cancelled) return;
        const t = String(j?.tradeUrl || '').trim();
        setTradeUrl(t);
        setTradeUrlInput(t);
      })
      .catch(() => {
        if (cancelled) return;
        setTradeUrl('');
        setTradeUrlInput('');
      })
      .finally(() => {
        if (cancelled) return;
        setTradeUrlLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewedUser?.steamId]);

  const handleSaveTradeUrl = async () => {
    if (!loggedInUser?.steamId || loggedInUser.steamId !== viewedUser?.steamId) {
      toast.error('Sign in to update your trade URL');
      return;
    }

    setTradeUrlSaving(true);
    try {
      const res = await fetch('/api/user/trade-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeUrl: tradeUrlInput }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(String(json?.error || 'Failed to save trade URL'));
        return;
      }
      const t = String(json?.tradeUrl || '').trim();
      setTradeUrl(t);
      setTradeUrlInput(t);
      toast.success('Trade URL saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save trade URL');
    } finally {
      setTradeUrlSaving(false);
    }
  };

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
      if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        setShareUrl(`${origin}/inventory/${viewedUser.steamId}?currency=${encodeURIComponent(currency.code)}`);
      }
    } catch {
      setShareUrl(null);
    }
  }, [viewedUser, currency.code]);

  // Load Discord status for viewed user (only show if Pro)
  useEffect(() => {
    if (!viewedUser?.steamId || !loggedInUser?.steamId || loggedInUser.steamId !== viewedUser.steamId) {
      setDiscordStatus(null);
      setHasDiscordAccess(false);
      return;
    }
    
    // Check if user has Discord access (Pro or Discord access consumable)
    const checkDiscordAccess = async () => {
      if (isPro) {
        // Pro users always have access
        setHasDiscordAccess(true);
        fetch(`/api/discord/status?steamId=${viewedUser.steamId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            setDiscordStatus(data?.connected ? data : { connected: false, requiresPro: false });
          })
          .catch(() => setDiscordStatus({ connected: false, requiresPro: false }));
      } else {
        // Check if free user has Discord access consumable
        try {
          const rewardsRes = await fetch(`/api/user/rewards?steamId=${viewedUser.steamId}`);
          if (rewardsRes.ok) {
            const rewardsData = await rewardsRes.json();
            const userHasAccess = (rewardsData.rewards || []).some((r: any) => 
              r.reward?.type === 'discord_access'
            );
            setHasDiscordAccess(userHasAccess);
            
            if (userHasAccess) {
              // Free user with Discord access - check connection status
              fetch(`/api/discord/status?steamId=${viewedUser.steamId}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                  setDiscordStatus(data?.connected ? data : { connected: false, requiresPro: false });
                })
                .catch(() => setDiscordStatus({ connected: false, requiresPro: false }));
            } else {
              setDiscordStatus({ connected: false, requiresPro: true });
            }
          } else {
            setHasDiscordAccess(false);
            setDiscordStatus({ connected: false, requiresPro: true });
          }
        } catch {
          setHasDiscordAccess(false);
          setDiscordStatus({ connected: false, requiresPro: true });
        }
      }
    };
    
    checkDiscordAccess();
  }, [viewedUser?.steamId, isPro]);

  // Public CS2 overview (playtime/last played). Cached server-side.
  useEffect(() => {
    if (!viewedUser?.steamId) {
      setCs2Overview(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/steam/cs2/overview?steamId=${encodeURIComponent(viewedUser.steamId)}`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setCs2Overview(null);
          return;
        }
        setCs2Overview(json);
      } catch {
        if (!cancelled) setCs2Overview(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [viewedUser?.steamId]);

  // Handle discord=connected URL parameter (refresh status after OAuth callback)
  useEffect(() => {
    const discordParam = searchParams.get('discord');
    if (discordParam === 'connected' && viewedUser?.steamId) {
      // Force refresh Discord status when coming back from OAuth
      const refreshDiscordStatus = async () => {
        try {
          const res = await fetch(`/api/discord/status?steamId=${viewedUser.steamId}`);
          if (res.ok) {
            const data = await res.json();
            setDiscordStatus(data?.connected ? data : { connected: false, requiresPro: false });
            
            // Remove the parameter from URL without reload
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('discord');
              window.history.replaceState({}, '', url.toString());
            }
          }
        } catch (error) {
          console.error('Failed to refresh Discord status:', error);
        }
      };
      
      // Small delay to ensure connection is saved
      setTimeout(refreshDiscordStatus, 500);
    }
  }, [searchParams, viewedUser?.steamId]);

  const totalVaultValueNumber = useMemo(() => {
    let total = 0;
    inventory.forEach(item => {
      const key = getMarketKey(item);
      const priceStr = key ? itemPrices[key] : undefined;
      if (priceStr) {
        const num = parsePriceToNumber(priceStr);
        if (!isNaN(num) && isFinite(num)) {
          total += num * Number(item.amount ?? 1);
        }
      }
    });
    // Ensure total is always a finite number (not Infinity)
    if (!isFinite(total) || isNaN(total)) {
      total = 0;
    }
    return total;
  }, [inventory, itemPrices, currency.code]);

  const totalVaultValue = useMemo(() => formatMoney(totalVaultValueNumber), [totalVaultValueNumber, currency.code]);

  const vaultRank = useMemo(() => getRankForValue(totalVaultValueNumber), [totalVaultValueNumber]);

  const totalItems = useMemo(() => inventory.reduce((sum, i) => sum + Number(i.amount ?? 1), 0), [inventory]);

  const pricedItems = useMemo(
    () => inventory.reduce((sum, i) => { const k = getMarketKey(i); return k && itemPrices[k] ? sum + Number(i.amount ?? 1) : sum; }, 0),
    [inventory, itemPrices]
  );

  // Parse price strings correctly (handles EUR/USD formats)
  function parsePriceToNumber(priceStr?: string) {
    if (!priceStr) return 0;
    
    // Remove currency symbols and whitespace
    let clean = priceStr.replace(/[€$£¥]/g, '').trim();
    
    // Handle European format: "70.991,00" -> 70991.00 (wrong) should be 70.991
    // Handle US format: "70.99" -> 70.99
    if (clean.includes(',') && clean.includes('.')) {
      // European format: remove dots, replace comma with dot
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      // Could be European "70,99" or US "70,991"
      // If comma is the last separator, it's likely European decimal
      const parts = clean.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Likely "70,99" format
        clean = clean.replace(',', '.');
      } else {
        // Likely "70,991" format (US thousand separator)
        clean = clean.replace(/,/g, '');
      }
    }
    
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  const filteredInv = useMemo(() => 
    inventory.filter((i) => {
      if (!i) return false;
      const name = String(getItemDisplayName(i) || '');
      const q = String(searchQuery || '');
      return name.toLowerCase().includes(q.toLowerCase());
    }), 
    [inventory, searchQuery]
  );

  const sortedInv = useMemo(() => {
    const arr = [...filteredInv];
    arr.sort((a, b) => {
      // Always show tradable items first, then non-tradable.
      // And within that, show marketable items first, then non-marketable.
      const tA = isNonTradable(a) ? 0 : 1;
      const tB = isNonTradable(b) ? 0 : 1;
      if (tA !== tB) return tB - tA;

      const mA = isNonMarketable(a) ? 0 : 1;
      const mB = isNonMarketable(b) ? 0 : 1;
      if (mA !== mB) return mB - mA;

      if (sortMode === 'name-asc') {
        return getItemDisplayName(a).localeCompare(getItemDisplayName(b));
      }

      const keyA = getMarketKey(a);
      const priceA = parsePriceToNumber(keyA ? itemPrices[keyA] : undefined);
      const keyB = getMarketKey(b);
      const priceB = parsePriceToNumber(keyB ? itemPrices[keyB] : undefined);

      // When sorting by price, always push items with no price to the bottom.
      const hasPriceA = !!(keyA && itemPrices[keyA]);
      const hasPriceB = !!(keyB && itemPrices[keyB]);
      if (hasPriceA !== hasPriceB) return hasPriceA ? -1 : 1;

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
      const ok = await copyToClipboard(shareUrl);
      if (ok) {
        setCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopied(false), 1500);
      } else {
        setCopied(false);
        toast.error('Please copy the link manually.');
      }
    } catch {
      setCopied(false);
      toast.error('Could not copy link. Please copy it manually.');
    }
  };

  if (!viewedUser && loading) {
    return (
      <div className="flex h-dvh bg-[#08090d] text-white font-sans">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
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

  if (!viewedUser && !loading) {
    return (
      <div className="flex h-dvh bg-[#08090d] text-white font-sans">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-10 pb-32">
            <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none">
                    Inventory Vault
                  </h1>
                  <p className="mt-3 text-[10px] md:text-xs text-gray-400 max-w-2xl">
                    Search any Steam profile to view a read-only CS2 inventory breakdown.
                    Sign in to unlock personal features like trackers, wishlist, and compare.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') window.location.href = '/api/auth/steam';
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  <User size={14} />
                  Sign In with Steam
                </button>
              </div>
            </header>

            <section className="bg-[#11141d] p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-white/5 shadow-xl">
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">What you can do here</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
                      <TrendingUp size={12} />
                      Vault value
                    </div>
                    <div className="mt-2 text-[10px] md:text-xs text-gray-400">
                      Total inventory value with live market pricing.
                    </div>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
                      <PackageOpen size={12} />
                      Top items
                    </div>
                    <div className="mt-2 text-[10px] md:text-xs text-gray-400">
                      Quickly spot your most valuable skins.
                    </div>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
                      <Trophy size={12} />
                      CS2 overview
                    </div>
                    <div className="mt-2 text-[10px] md:text-xs text-gray-400">
                      Public playtime data (Steam).
                    </div>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
                      <Scale size={12} />
                      Compare
                    </div>
                    <div className="mt-2 text-[10px] md:text-xs text-gray-400">
                      Compare items side-by-side (requires sign-in).
                    </div>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
                      <Bell size={12} />
                      Price trackers
                    </div>
                    <div className="mt-2 text-[10px] md:text-xs text-gray-400">
                      Track price changes and alerts (requires sign-in).
                    </div>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
                      <Heart size={12} />
                      Wishlist
                    </div>
                    <div className="mt-2 text-[10px] md:text-xs text-gray-400">
                      Save items and monitor prices (requires sign-in).
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-[10px] md:text-xs text-gray-500">
                  Use the sidebar Search to open any profile by SteamID64 or username.
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      {showDiscordIdModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-[#0b0d12] border border-white/10 rounded-[1.5rem] p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-widest text-white">Add your Discord ID</div>
              <button
                onClick={() => setShowDiscordIdModal(false)}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center"
                aria-label="Close"
              >
                <X size={16} className="text-gray-200" />
              </button>
            </div>
            <div className="mt-3 text-[10px] text-gray-400">
              This helps us match your website account to your Discord account so the bot can assign roles.
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">
                Discord ID
                <span
                  className="inline-flex items-center gap-1 text-gray-500"
                  title="Enable Developer Mode in Discord, then right-click your profile and click Copy User ID"
                >
                  <HelpCircle size={12} />
                </span>
              </div>
              <input
                value={discordIdInput}
                onChange={(e) => setDiscordIdInput(e.target.value)}
                placeholder="123456789012345678"
                className="mt-2 w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black"
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDiscordIdModal(false)}
                className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10"
              >
                Later
              </button>
              <button
                onClick={handleSaveDiscordId}
                disabled={discordIdSaving}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${discordIdSaving ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
              >
                {discordIdSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex h-dvh bg-[#08090d] text-white font-sans">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 custom-scrollbar">
        {websiteProfilePrivate && (
          <div className="max-w-6xl mx-auto space-y-10 pb-32">
            <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
              <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none">
                Profile is private
              </h1>
              <p className="mt-3 text-[10px] md:text-xs text-gray-400 max-w-2xl">
                You can’t look up this profile.
                Sign in as the account owner to view it.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') window.location.href = '/api/auth/steam';
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  <User size={14} />
                  Sign In with Steam
                </button>
              </div>
            </header>
          </div>
        )}

        {!websiteProfilePrivate && viewedUser && (
          <div className="max-w-6xl mx-auto space-y-12 pb-32">
            <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8">
              <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                <img src={viewedUser.avatar} className="w-16 h-16 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-blue-600 shadow-2xl shrink-0" alt="avatar" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h1 className="flex-1 min-w-0 font-black italic leading-none whitespace-normal break-words">
                      {(() => {
                        const n = String(viewedUser?.name || 'User');
                        const len = n.length;
                        const reduce = Math.max(0, len - 12) * 0.07;
                        const tracking = len > 20 ? 'tracking-tight' : 'tracking-tighter';
                        return (
                          <span
                            className={tracking}
                            style={{ fontSize: `clamp(1.25rem, calc(4.2vw - ${reduce}rem), 2.5rem)` }}
                          >
                            {n}
                          </span>
                        );
                      })()}
                    </h1>

                    {vaultRank && (
                      <span
                        className="px-2 md:px-3 py-0.5 md:py-1 rounded-full border text-[8px] md:text-[9px] font-black uppercase tracking-[0.25em] shrink-0"
                        style={{
                          color: vaultRank.color,
                          borderColor: hexToRgba(vaultRank.color, 0.5),
                          backgroundColor: hexToRgba(vaultRank.color, 0.12),
                        }}
                      >
                        {vaultRank.name}
                      </span>
                    )}
                    {viewedIsPro && (
                      <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[8px] md:text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400 shrink-0">
                        Pro
                      </span>
                    )}
                    {isPrime && (
                      <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-blue-500/15 border border-blue-500/50 text-[8px] md:text-[9px] font-black uppercase tracking-[0.12em] text-blue-400 shrink-0">
                        Prime
                      </span>
                    )}
                    {isPartner && (
                      <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-yellow-500/10 border border-yellow-500/40 text-[8px] md:text-[9px] font-black uppercase tracking-[0.25em] text-yellow-300 shrink-0">
                        Partner
                      </span>
                    )}
                    {/* Discord Connection Status (Show if Pro or has Discord access AND connected) */}
                    {(isPro || hasDiscordAccess) && discordStatus?.connected && (
                      <div className="flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-indigo-500/10 border border-indigo-500/40 shrink-0">
                        <MessageSquare size={10} className="text-indigo-400" />
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.25em] text-indigo-400">
                          Discord
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Action Buttons (only for own profile) */}
                  {effectiveIsOwner && (
                    <div className="mt-5 md:mt-6 flex flex-col sm:flex-row gap-2 w-full flex-wrap">
                      <button
                        onClick={() => setIsEditingProfile((v) => !v)}
                        className={`w-full xl:w-auto flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${isEditingProfile ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 text-white'}`}
                        title={isEditingProfile ? 'Exit edit mode' : 'Edit your profile'}
                      >
                        {isEditingProfile ? 'Editing' : 'Edit profile'}
                      </button>

                      <button
                        onClick={() => setViewAsOthers(true)}
                        className="w-full xl:w-auto flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all"
                        title="Preview your profile as other users see it"
                      >
                        View as others
                      </button>

                      <button
                        onClick={handleForceRefreshInventory}
                        disabled={refreshingInventory}
                        className={`w-full sm:col-span-2 xl:col-span-1 xl:flex-1 xl:min-w-[220px] flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${refreshingInventory ? 'bg-white/10 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                      >
                        {refreshingInventory ? 'Refreshing...' : 'Refresh Inventory'}
                      </button>

                      {isEditingProfile && (isPro || hasDiscordAccess) && (
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
                            className="w-full flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg md:rounded-xl text-[9px] font-black uppercase tracking-widest"
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
                                  window.location.reload();
                                }
                              } catch (error) {
                                console.error('Failed to disconnect Discord:', error);
                              }
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-red-600 hover:bg-red-500 rounded-lg md:rounded-xl text-[9px] font-black uppercase tracking-widest"
                          >
                            <MessageSquare size={12} />
                            Disconnect Discord
                          </button>
                        )
                      )}

                      {isEditingProfile && (
                        <>
                          <button
                            onClick={() => setShowManageTrackers(true)}
                            className="w-full flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gray-700 hover:bg-gray-600 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest"
                          >
                            <Settings size={12} />
                            Manage Trackers
                          </button>

                          <div className="w-full mt-2 bg-black/40 border border-white/5 rounded-[1.5rem] p-4">
                            <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">
                              Trade URL
                              <HelpTooltip
                                title="Where to find your Trade URL"
                                content="Open Steam → Inventory → Trade Offers → Who can send me Trade Offers? → Copy your Trade URL"
                                className="ml-1"
                              />
                            </div>
                            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                              <input
                                value={tradeUrlInput}
                                onChange={(e) => setTradeUrlInput(e.target.value)}
                                placeholder="https://steamcommunity.com/tradeoffer/new/?partner=...&token=..."
                                className="w-full md:flex-1 md:min-w-[240px] bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] md:text-[11px] font-black"
                              />
                              <button
                                onClick={handleSaveTradeUrl}
                                disabled={tradeUrlSaving}
                                className={`px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${tradeUrlSaving ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                              >
                                {tradeUrlSaving ? 'Saving...' : 'Save'}
                              </button>
                              {tradeUrl && (
                                <button
                                  onClick={async () => {
                                    const ok = await copyToClipboard(tradeUrl);
                                    if (ok) toast.success('Trade URL copied');
                                  }}
                                  className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition-all"
                                >
                                  Copy
                                </button>
                              )}
                            </div>
                            <div className="mt-2 text-[9px] text-gray-500">
                              This is visible to visitors on your inventory.
                            </div>
                          </div>

                          <div className="w-full mt-2 bg-black/40 border border-white/5 rounded-[1.5rem] p-4">
                            <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">
                              Discord ID
                              <span
                                className="inline-flex items-center gap-1 text-gray-500"
                                title="Enable Developer Mode in Discord, then right-click your profile and click Copy User ID"
                              >
                                <HelpCircle size={12} />
                              </span>
                            </div>
                            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                              <input
                                value={discordIdInput}
                                onChange={(e) => setDiscordIdInput(e.target.value)}
                                placeholder="123456789012345678"
                                className="w-full md:flex-1 md:min-w-[240px] bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] md:text-[11px] font-black"
                                disabled={discordIdLoading}
                              />
                              <button
                                onClick={handleSaveDiscordId}
                                disabled={discordIdSaving}
                                className={`px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${discordIdSaving ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                              >
                                {discordIdSaving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                            <div className="mt-2 text-[9px] text-gray-500">
                              Used for Discord role syncing if you can’t connect via OAuth.
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {viewingOwnProfile && viewAsOthers && (
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap mt-5 md:mt-6">
                      <button
                        onClick={() => setViewAsOthers(false)}
                        className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all"
                        title="Return to editing your own profile"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                  {!tradeUrlLoading && tradeUrl && !effectiveIsOwner && (
                    <div className="mt-3 space-y-2 max-w-full md:max-w-xs">
                      <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Trade URL
                        <HelpTooltip
                          title="What is a Trade URL?"
                          content="This is the link you use to receive Steam trade offers. You can find yours in Steam → Inventory → Trade Offers → Who can send me Trade Offers? → Copy your Trade URL."
                          className="ml-1"
                        />
                      </div>
                      <p className="text-[8px] md:text-[9px] text-gray-600 break-all bg-black/40 px-2 md:px-3 py-1.5 md:py-2 rounded-xl border border-white/5 select-all cursor-text">
                        {tradeUrl}
                      </p>
                      <button
                        onClick={async () => {
                          const ok = await copyToClipboard(tradeUrl);
                          if (ok) {
                            toast.success('Trade URL copied');
                            if (loggedInUser?.steamId && viewedUser?.steamId && loggedInUser.steamId !== viewedUser.steamId) {
                              fetch('/api/user/trade-url/copy', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ steamId: viewedUser.steamId }),
                              }).catch(() => {});
                            }
                          }
                        }}
                        className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition-all"
                      >
                        Copy Trade URL
                      </button>
                    </div>
                  )}
              </div>
            </div>
            <div className="w-full xl:w-auto flex flex-col items-start xl:items-end gap-3">
              <div className="flex items-center gap-2 flex-wrap justify-start xl:justify-end">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/10">
                  <Wallet size={16} className="text-blue-400" />
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Credits</div>
                  <div className="text-[11px] font-black text-white">
                    {publicStatusLoading ? '—' : (Number.isFinite(Number(publicStatus?.creditsBalance)) ? Number(publicStatus?.creditsBalance || 0).toLocaleString('en-US') : '—')}
                  </div>
                </div>

                {!!publicStatus?.banned && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30"
                    title={publicStatus?.banReason ? `Banned: ${String(publicStatus.banReason)}` : 'Banned'}
                  >
                    <Skull size={16} className="text-red-400" />
                    <div className="text-[9px] font-black uppercase tracking-widest text-red-300">Banned</div>
                  </div>
                )}

                {!!publicStatus?.timeoutActive && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30"
                    title={(() => {
                      const until = publicStatus?.timeoutUntil ? String(publicStatus.timeoutUntil) : '';
                      const reason = publicStatus?.timeoutReason ? String(publicStatus.timeoutReason) : '';
                      if (reason && until) return `Timeout: ${reason} (until ${until})`;
                      if (reason) return `Timeout: ${reason}`;
                      if (until) return `Timeout until ${until}`;
                      return 'Timeout active';
                    })()}
                  >
                    <Lock size={16} className="text-amber-300" />
                    <div className="text-[9px] font-black uppercase tracking-widest text-amber-200">
                      Timeout{Number.isFinite(Number(publicStatus?.timeoutMinutesRemaining)) ? ` (${Number(publicStatus?.timeoutMinutesRemaining || 0)}m)` : ''}
                    </div>
                  </div>
                )}

                {!!publicStatus?.creditsBanned && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30"
                    title="Credits restricted: banned"
                  >
                    <Skull size={16} className="text-fuchsia-300" />
                    <div className="text-[9px] font-black uppercase tracking-widest text-fuchsia-200">Credits Banned</div>
                  </div>
                )}

                {!!publicStatus?.creditsTimeoutActive && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30"
                    title={(() => {
                      const until = publicStatus?.creditsTimeoutUntil ? String(publicStatus.creditsTimeoutUntil) : '';
                      if (until) return `Credits timeout until ${until}`;
                      return 'Credits timeout active';
                    })()}
                  >
                    <Lock size={16} className="text-fuchsia-200" />
                    <div className="text-[9px] font-black uppercase tracking-widest text-fuchsia-200">
                      Credits Timeout{Number.isFinite(Number(publicStatus?.creditsTimeoutMinutesRemaining)) ? ` (${Number(publicStatus?.creditsTimeoutMinutesRemaining || 0)}m)` : ''}
                    </div>
                  </div>
                )}
                {canOpenNotifications && (
                  <button
                    onClick={() => {
                      setNotificationsOpen(true);
                      void loadNotifications();
                    }}
                    className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 transition-all"
                    aria-label="Notifications"
                    title={loggedInIsOwner && String(loggedInUser?.steamId || '').trim() !== String(viewedUser?.steamId || '').trim() ? 'View user notifications' : 'Your notifications'}
                  >
                    <Mail size={16} className="text-gray-300" />
                    {notificationsUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                        {notificationsUnreadCount > 99 ? '99+' : notificationsUnreadCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

                {(() => {
                  const sid = String(loggedInUser?.steamId || '').trim();
                  const c = sid && /^\d{17}$/.test(sid)
                    ? publicCoupons.reduce<PublicCoupon | null>((best, cur) => {
                        if (!cur) return best;
                        if (!best) return cur;

                        if (cur.kind === 'percent' && best.kind === 'percent') {
                          const a = Number(cur.percentOff);
                          const b = Number(best.percentOff);
                          return (Number.isFinite(a) ? a : 0) > (Number.isFinite(b) ? b : 0) ? cur : best;
                        }
                        if (cur.kind === 'percent' && best.kind !== 'percent') return cur;
                        if (cur.kind !== 'percent' && best.kind === 'percent') return best;

                        const a = Number(cur.amountOff);
                        const b = Number(best.amountOff);
                        return (Number.isFinite(a) ? a : 0) > (Number.isFinite(b) ? b : 0) ? cur : best;
                      }, null)
                    : null;
                  if (!c) return null;
                  return (
                    <div className="w-full flex justify-start xl:justify-end">
                      <div className="text-[10px] font-black text-emerald-300">
                        Coupon Available: <span className="text-emerald-200">{c.code}</span> ({formatCouponValue(c)})
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 md:px-10 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center gap-4 md:gap-6 shadow-inner w-full xl:w-auto">
                  <TrendingUp className="text-emerald-500 shrink-0" size={24} />
                  <div className="min-w-0">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Vault Value</p>
                    <p className="text-2xl md:text-4xl font-black text-white italic tracking-tighter break-words">{totalVaultValue}</p>
                  </div>
                </div>
              </div>

            </header>

            <section className="bg-[#11141d] p-5 md:p-7 rounded-[2rem] md:rounded-[3rem] border border-white/5 shadow-xl">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">CS2 Overview</div>
                <div className="text-[9px] md:text-[10px] text-gray-500">Public playtime data (Steam)</div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                  <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-500">
                    <Trophy size={12} /> Hours Played
                  </div>
                  <div className="mt-2 text-xl md:text-2xl font-black italic tracking-tighter text-white">
                    {(() => {
                      const hours = formatHours(cs2Overview?.playtimeForeverMinutes ?? null);
                      if (hours === null) return '—';
                      return hours.toLocaleString('en-US', { maximumFractionDigits: 0 });
                    })()}
                  </div>
                  <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">All time</div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                  <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-500">
                    <TrendingUp size={12} /> CS2 Owned
                  </div>
                  <div className="mt-2 text-xl md:text-2xl font-black italic tracking-tighter text-white">
                    {cs2Overview ? (cs2Overview?.hasCs2 ? 'Yes' : 'No') : '—'}
                  </div>
                  <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">AppID 730</div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                  <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-500">
                    <MessageSquare size={12} /> Last Seen
                  </div>
                  <div className="mt-2 text-xl md:text-2xl font-black italic tracking-tighter text-white">
                    {(() => {
                      const ts = cs2Overview?.lastLogoff;
                      if (!ts) return '–';
                      const d = new Date(Number(ts) * 1000);
                      if (isNaN(d.getTime())) return '–';
                      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
                    })()}
                  </div>
                  <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">Steam last logoff</div>
                </div>

                {isPro ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5">
                    <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-emerald-300">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[8px]">PRO</span>
                      2 Weeks
                    </div>
                    <div className="mt-2 text-xl md:text-2xl font-black italic tracking-tighter text-white">
                      {(() => {
                        const hours = formatHours(cs2Overview?.playtime2WeeksMinutes ?? null);
                        if (hours === null) return '–';
                        return hours.toLocaleString('en-US', { maximumFractionDigits: 1 });
                      })()}
                    </div>
                    <div className="mt-1 text-[9px] md:text-[10px] text-emerald-200/70">Hours last 2 weeks</div>
                  </div>
                ) : (
                  <div className="bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Link href="/pro" className="text-[8px] md:text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors">
                        Upgrade to Pro
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-500 opacity-60">
                      <Lock size={12} /> 2 Weeks
                    </div>
                    <div className="mt-2 text-xl md:text-2xl font-black italic tracking-tighter text-gray-600 opacity-60">–</div>
                    <div className="mt-1 text-[9px] md:text-[10px] text-gray-600 opacity-60">Hours last 2 weeks</div>
                  </div>
                )}
              </div>

              {cs2Overview && cs2Overview?.hasCs2 === false && (
                <div className="mt-4 text-[10px] md:text-xs text-gray-500">
                  This Steam account does not expose CS2 ownership/playtime publicly (or does not own CS2).
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-white/5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
                  <StatCard
                    label="Total Items"
                    icon={<PackageOpen size={12} />}
                    val={Number.isFinite(Number(totalItems)) ? Number(totalItems).toLocaleString('en-US') : null}
                  />

                  <StatCard
                    label="Priced"
                    icon={<TrendingUp size={12} />}
                    val={Number.isFinite(Number(pricedItems)) ? Number(pricedItems).toLocaleString('en-US') : null}
                  />

                  <StatCard
                    label="Unpriced"
                    icon={<Target size={12} />}
                    val={Number.isFinite(Number(totalItems - pricedItems)) ? Number(totalItems - pricedItems).toLocaleString('en-US') : null}
                  />

                  <StatCard
                    label="K/D"
                    icon={<Swords size={12} />}
                    val={playerStats?.kd ?? null}
                  />

                  <StatCard
                    label="HS%"
                    icon={<CheckCircle2 size={12} />}
                    val={playerStats?.hs ?? null}
                    unit={playerStats?.hs ? '%' : ''}
                  />

                  <StatCard
                    label="Wins"
                    icon={<Award size={12} />}
                    val={playerStats?.wins ?? null}
                  />
                </div>

                {isPro && (
                  <div className="mt-3 md:mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
                    <StatCard
                      label="ADR"
                      icon={<Target size={12} />}
                      val={playerStats?.adr ?? null}
                    />

                    <StatCard
                      label="Accuracy"
                      icon={<CheckCircle2 size={12} />}
                      val={playerStats?.accuracy ?? null}
                      unit={playerStats?.accuracy ? '%' : ''}
                    />

                    <StatCard
                      label="MVPs"
                      icon={<Award size={12} />}
                      val={playerStats?.mvps ?? null}
                    />

                    <StatCard
                      label="Faceit ELO"
                      icon={<TrendingUp size={12} />}
                      val={faceitStats?.elo ?? null}
                    />

                    <StatCard
                      label="Faceit Level"
                      icon={<Trophy size={12} />}
                      val={faceitStats?.level ?? null}
                    />

                    <StatCard
                      label="Faceit WR"
                      icon={<Swords size={12} />}
                      val={faceitStats?.winRate ?? null}
                      unit={faceitStats?.winRate ? '%' : ''}
                    />
                  </div>
                )}
              </div>
            </section>

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
                          {formatMoney(price)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-6 md:space-y-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-2 md:px-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <PackageOpen className="text-blue-500 shrink-0" size={24} />
                  <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">Secured Items</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <label htmlFor="inventory-search" className="sr-only">Search vault</label>
                  <input
                    id="inventory-search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#11141d] border border-white/5 rounded-2xl py-2.5 md:py-3 px-4 md:px-6 text-[10px] md:text-[11px] outline-none font-black uppercase tracking-widest focus:border-blue-500/50 w-full sm:w-72 transition-all shadow-xl"
                    placeholder="SEARCH VAULT..."
                  />
                  <label htmlFor="inventory-sort" className="sr-only">Sort items</label>
                  <select
                    id="inventory-sort"
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

                    const labels = getWeaponAndSkinLabels(item);
                    const nonMarketable = isNonMarketable(item);

                    return (
                      <div key={idx} className="group relative">
                        <Link
                          href={`/item/${encodeURIComponent(getMarketKey(item) || getItemDisplayName(item))}`}
                          prefetch={false}
                          className="block"
                        >
                          <div className="bg-[#11141d] p-3 md:p-4 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/5 flex flex-col h-48 md:h-64 group-hover:border-blue-500/40 transition-all group-hover:-translate-y-1 md:group-hover:-translate-y-2 relative overflow-hidden shadow-xl">
                            <div className="w-full h-24 md:h-32 mb-4 md:mb-6 z-10 flex items-center justify-center">
                              <img
                                src={`https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`}
                                className="w-full h-full object-contain"
                                alt="skin"
                              />
                            </div>
                            <div className="mt-auto space-y-1.5 md:space-y-2">
                              <p className="text-[9px] md:text-[10px] font-black uppercase leading-tight text-white/90 line-clamp-2">
                                {getItemDisplayName(item)}
                              </p>
                              {(labels.weaponName !== '—' || labels.skinName) && (
                                <div className="text-[9px] text-gray-500 truncate">
                                  {labels.weaponName !== '—' ? <span className="text-gray-400 font-black">{labels.weaponName}</span> : null}
                                  {labels.skinName ? <span> {labels.weaponName !== '—' ? '•' : ''} {labels.skinName}</span> : null}
                                </div>
                              )}
                              <div className="min-h-[14px] md:min-h-[16px] flex items-center">
                                <div className="text-[10px] md:text-[11px] font-black italic">
                                  {getPriceForItem(item, itemPrices)
                                    ? <span className="text-emerald-500">{getPriceForItem(item, itemPrices)}</span>
                                    : priceScanDone
                                      ? (nonMarketable ? <span className="text-gray-500">NOT MARKETABLE</span> : <span className="text-gray-500">NO PRICE</span>)
                                      : <span className="text-gray-600 animate-pulse">
                                          {isPro ? '⚡ FAST SCAN...' : 'SCANNING...'}
                                        </span>}
                                </div>
                              </div>
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
                                void (async () => {
                                  const sid = String(loggedInUser?.steamId || '').trim();
                                  const result = await toggleWishlistEntryServer(
                                    {
                                      key: wishlistKey,
                                      name: getItemDisplayName(item),
                                      image: `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`,
                                      market_hash_name: itemKey,
                                    },
                                    sid,
                                    loggedInUserPro,
                                  );
                                  if (result.success) {
                                    setWishlist(result.newList);
                                  } else if (result.reason === 'limit_reached') {
                                    setShowUpgradeModal(true);
                                  }
                                })();
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
      
      {notificationsOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setNotificationPreview(null);
            setNotificationsOpen(false);
          }}
        >
          <div
            className="w-full max-w-2xl bg-[#11141d] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 truncate">{notificationPreview?.title || 'Notification'}</div>
                <div className="text-[11px] text-gray-400 mt-1">
                  {loggedInIsOwner && String(loggedInUser?.steamId || '').trim() !== String(viewedUser?.steamId || '').trim()
                    ? `Viewing ${formatProfileName(viewedUser?.name || 'User')}`
                    : 'Your inbox'}
                  <span className="text-gray-600"> • Unread: </span>
                  <span className="text-white font-black">{Number(notificationsUnreadCount || 0)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setMarkingAllNotifications(true);
                    await markNotificationsRead([], true);
                    setMarkingAllNotifications(false);
                  }}
                  disabled={markingAllNotifications || notificationsLoading || notificationsRows.length === 0}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${markingAllNotifications || notificationsLoading || notificationsRows.length === 0 ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                >
                  {markingAllNotifications ? 'Marking…' : 'Mark all read'}
                </button>
                <button
                  onClick={() => {
                    setNotificationPreview(null);
                    setNotificationsOpen(false);
                  }}
                  className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 flex items-center justify-center"
                  aria-label="Close"
                >
                  <X size={16} className="text-gray-300" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
              {notificationsLoading ? (
                <div className="p-6 flex items-center gap-2 text-gray-500">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-[11px] uppercase tracking-widest font-black">Loading</span>
                </div>
              ) : notificationsRows.length === 0 ? (
                <div className="p-6 text-gray-500 text-[11px]">No notifications.</div>
              ) : (
                <div className="p-4 space-y-2">
                  {notificationsRows.map((r) => {
                    const bySteamId = String(r?.meta?.bySteamId || '').trim();
                    const actor = bySteamId && /^\d{17}$/.test(bySteamId) ? actorProfilesBySteamId[bySteamId] : null;
                    const img = String(r?.meta?.imageUrl || r?.meta?.image || actor?.avatar || '').trim();
                    const unread = !r.readAt;
                    return (
                      <div
                        key={r.id}
                        className={`p-4 rounded-[1.5rem] border ${unread ? 'bg-blue-500/5 border-blue-500/20' : 'bg-black/30 border-white/5'}`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (!img) return;
                              setNotificationPreview({ title: r.title || 'Notification', imageUrl: img });
                            }}
                            className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
                            disabled={!img}
                            aria-label={img ? 'Preview image' : 'No image'}
                          >
                            {img ? (
                              <img src={img} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Mail size={16} className="text-gray-500" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest truncate">{r.title || 'Notification'}</div>
                                <div className="mt-1 text-[11px] text-gray-400 whitespace-pre-wrap break-words">{r.message || ''}</div>
                                {actor?.name && (
                                  <div className="mt-2 text-[9px] text-gray-500">From: <span className="text-gray-300 font-black">{actor.name}</span></div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-[9px] text-gray-600">
                                  {r.createdAt ? new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: '2-digit' }) : ''}
                                </div>
                                {unread && (
                                  <button
                                    onClick={async () => {
                                      setMarkingNotificationId(r.id);
                                      await markNotificationsRead([r.id], false);
                                      setMarkingNotificationId(null);
                                    }}
                                    disabled={markingNotificationId === r.id}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${markingNotificationId === r.id ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/15 text-white'}`}
                                  >
                                    {markingNotificationId === r.id ? '…' : 'Read'}
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    setDeletingNotificationId(r.id);
                                    await deleteNotifications([r.id]);
                                    setDeletingNotificationId(null);
                                  }}
                                  disabled={deletingNotificationId === r.id}
                                  className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center ${deletingNotificationId === r.id ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed' : 'bg-black/40 border-white/10 hover:border-white/20 text-gray-300'}`}
                                  aria-label="Delete notification"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {notificationPreview && (
        <div
          className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setNotificationPreview(null)}
        >
          <div
            className="w-full max-w-3xl bg-[#11141d] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between gap-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 truncate">{notificationPreview.title || 'Notification'}</div>
              <button
                onClick={() => setNotificationPreview(null)}
                className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 flex items-center justify-center"
                aria-label="Close preview"
              >
                <X size={16} className="text-gray-300" />
              </button>
            </div>
            <div className="p-4 bg-black/20">
              <div className="w-full aspect-[16/9] bg-black/40 border border-white/10 rounded-[1.5rem] overflow-hidden flex items-center justify-center">
                <img src={notificationPreview.imageUrl} alt="" className="w-full h-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      )}

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
      <div className="h-dvh bg-[#08090d] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Loading...</p>
      </div>
    }>
      <InventoryContent />
    </Suspense>
  ); 
}
