'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { useToast } from '@/app/components/Toast';
import { CreditCard, Loader2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';

type CheckoutType = 'pro' | 'credits' | 'spins' | 'consumable';

const CART_KEY = 'sv_cart_v1';

const PRO_PLANS: Record<string, { label: string; amount: number; months: number }> = {
  '1month': { label: '1 Month', amount: 999, months: 1 },
  '3months': { label: '3 Months', amount: 2499, months: 3 },
  '6months': { label: '6 Months', amount: 4499, months: 6 },
};

const CREDIT_PACKS: Record<string, { label: string; amount: number; credits: number }> = {
  starter: { credits: 500, amount: 199, label: 'Starter Pack' },
  value: { credits: 1500, amount: 499, label: 'Value Pack' },
  mega: { credits: 4000, amount: 999, label: 'Mega Pack' },
  giant: { credits: 10000, amount: 1999, label: 'Giant Pack' },
  whale: { credits: 30000, amount: 4999, label: 'Whale Pack' },
  titan: { credits: 50000, amount: 7499, label: 'Titan Pack' },
  legend: { credits: 75000, amount: 9999, label: 'Legend Pack' },
};

const SPIN_PACKS: Record<string, { label: string; amount: number; spins: number }> = {
  starter: { spins: 5, amount: 199, label: 'Starter Pack' },
  value: { spins: 15, amount: 499, label: 'Value Pack' },
  mega: { spins: 40, amount: 999, label: 'Mega Pack' },
  giant: { spins: 100, amount: 1999, label: 'Giant Pack' },
  whale: { spins: 300, amount: 4999, label: 'Whale Pack' },
  titan: { spins: 500, amount: 7499, label: 'Titan Pack' },
  legend: { spins: 750, amount: 9999, label: 'Legend Pack' },
};

const CONSUMABLES: Record<string, { label: string; amount: number }> = {
  price_tracker_slot: { label: 'Price Tracker Slot', amount: 299 },
  wishlist_slot: { label: 'Wishlist Slot', amount: 199 },
  discord_access: { label: 'Discord Access', amount: 499 },
  price_scan_boost: { label: 'Price Scan Boost', amount: 249 },
  cache_boost: { label: 'Price Cache Boost', amount: 199 },
};

type ProPlanId = '1month' | '3months' | '6months';
type CreditsPackId = keyof typeof CREDIT_PACKS;
type SpinsPackId = keyof typeof SPIN_PACKS;
type ConsumableId = keyof typeof CONSUMABLES;

type CartItem =
  | { kind: 'pro'; plan: ProPlanId }
  | { kind: 'credits'; pack: CreditsPackId; quantity: number }
  | { kind: 'spins'; pack: SpinsPackId; quantity: number }
  | { kind: 'consumable'; consumableType: ConsumableId; quantity: number };

function formatEurCents(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '€—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(n / 100);
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function readCart(): CartItem[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CART_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as any) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CART_KEY, JSON.stringify(Array.isArray(items) ? items : []));
  } catch {
  }
}

export default function CheckoutPage() {
  const toast = useToast();
  const params = useSearchParams();
  const router = useRouter();

  const [steamId, setSteamId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const type = (String(params.get('type') || '').trim().toLowerCase() as CheckoutType) || null;
  const plan = String(params.get('plan') || '').trim();
  const pack = String(params.get('pack') || '').trim();
  const consumableType = String(params.get('consumableType') || '').trim();
  const quantity = parsePositiveInt(params.get('quantity'), 1);

  const urlEmail = String(params.get('email') || '').trim();
  const urlPromo = String(params.get('promoCode') || params.get('promo') || '').trim();

  const cartSummary = useMemo(() => {
    const items = Array.isArray(cart) ? cart : [];
    const rows = items.map((it) => {
      if (it.kind === 'pro') {
        const info = PRO_PLANS[it.plan];
        const label = info ? `SkinVaults Pro - ${info.label}` : 'SkinVaults Pro';
        const amount = info ? info.amount : 0;
        return { key: `pro:${it.plan}`, label, detail: info ? `${info.months} months` : '', qty: 1, amount };
      }
      if (it.kind === 'credits') {
        const info = CREDIT_PACKS[it.pack];
        const qty = clampInt(it.quantity, 1, 99);
        const label = info ? `Credits - ${info.label}` : 'Credits';
        const amount = info ? info.amount * qty : 0;
        const detail = info ? `${(info.credits * qty).toLocaleString('en-US')} credits` : '';
        return { key: `credits:${it.pack}`, label, detail, qty, amount };
      }
      if (it.kind === 'spins') {
        const info = SPIN_PACKS[it.pack];
        const qty = clampInt(it.quantity, 1, 99);
        const label = info ? `Spins - ${info.label}` : 'Spins';
        const amount = info ? info.amount * qty : 0;
        const detail = info ? `${(info.spins * qty).toLocaleString('en-US')} spins` : '';
        return { key: `spins:${it.pack}`, label, detail, qty, amount };
      }
      const info = CONSUMABLES[it.consumableType];
      const qty = clampInt(it.quantity, 1, 100);
      const label = info ? info.label : 'Consumable';
      const amount = info ? info.amount * qty : 0;
      return { key: `consumable:${it.consumableType}`, label, detail: `Quantity: ${qty}`, qty, amount };
    });
    const total = rows.reduce((sum, r) => sum + (Number.isFinite(r.amount) ? r.amount : 0), 0);
    return { rows, total };
  }, [cart]);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
        const parsed = stored ? JSON.parse(stored) : null;
        const sidFromStorage = String(parsed?.steamId || '').trim();
        if (/^\d{17}$/.test(sidFromStorage)) {
          if (!cancelled) setSteamId(sidFromStorage);
          return;
        }

        const sessionRes = await fetch('/api/auth/steam/session', { cache: 'no-store' });
        if (!sessionRes.ok) return;
        const sessionJson = await sessionRes.json().catch(() => null);
        const sid = String(sessionJson?.steamId || '').trim();
        if (!/^\d{17}$/.test(sid)) return;

        if (!cancelled) setSteamId(sid);
        try {
          const prevRaw = window.localStorage.getItem('steam_user');
          const prev = prevRaw ? JSON.parse(prevRaw) : null;
          const next = prev && typeof prev === 'object' ? { ...prev, steamId: sid } : { steamId: sid };
          window.localStorage.setItem('steam_user', JSON.stringify(next));
        } catch {
        }
      } catch {
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };

    try {
      const storedEmail = typeof window !== 'undefined' ? window.localStorage.getItem('sv_checkout_email') : null;
      if (urlEmail) {
        setEmail(urlEmail);
      } else if (storedEmail) {
        setEmail(String(storedEmail));
      }
    } catch {
    }

    try {
      const storedPromo = typeof window !== 'undefined' ? window.localStorage.getItem('sv_checkout_promo') : null;
      if (urlPromo) {
        setPromoCode(urlPromo);
      } else if (storedPromo) {
        setPromoCode(String(storedPromo));
      }
    } catch {
    }

    try {
      setCart(readCart());
    } catch {
      setCart([]);
    }

    void initAuth();
    return () => {
      cancelled = true;
    };
  }, [urlEmail, urlPromo]);

  useEffect(() => {
    if (!type) return;

    const next = readCart();

    try {
      if (type === 'pro') {
        const planKey = String(plan || '').trim() as any;
        if (planKey && PRO_PLANS[planKey]) {
          const withPro: CartItem[] = [{ kind: 'pro', plan: planKey }, ...next.filter((i) => i.kind !== 'pro')];
          setCart(withPro);
          writeCart(withPro);
          router.replace('/checkout');
        }
        return;
      }

      if (type === 'credits') {
        const packKey = String(pack || '').trim() as any;
        if (packKey && CREDIT_PACKS[packKey]) {
          const existing = next.find((i) => i.kind === 'credits' && i.pack === packKey) as any;
          if (existing) {
            existing.quantity = clampInt(Number(existing.quantity || 1) + 1, 1, 99);
          } else {
            next.push({ kind: 'credits', pack: packKey, quantity: 1 });
          }
          setCart(next);
          writeCart(next);
          router.replace('/checkout');
        }
        return;
      }

      if (type === 'spins') {
        const packKey = String(pack || '').trim() as any;
        if (packKey && SPIN_PACKS[packKey]) {
          const existing = next.find((i) => i.kind === 'spins' && i.pack === packKey) as any;
          if (existing) {
            existing.quantity = clampInt(Number(existing.quantity || 1) + 1, 1, 99);
          } else {
            next.push({ kind: 'spins', pack: packKey, quantity: 1 });
          }
          setCart(next);
          writeCart(next);
          router.replace('/checkout');
        }
        return;
      }

      if (type === 'consumable') {
        const t = String(consumableType || '').trim() as any;
        if (t && CONSUMABLES[t]) {
          const q = clampInt(quantity, 1, 100);
          const existing = next.find((i) => i.kind === 'consumable' && i.consumableType === t) as any;
          if (existing) {
            existing.quantity = clampInt(Number(existing.quantity || 1) + q, 1, 100);
          } else {
            next.push({ kind: 'consumable', consumableType: t, quantity: q });
          }
          setCart(next);
          writeCart(next);
          router.replace('/checkout');
        }
        return;
      }
    } catch {
    }
  }, [consumableType, pack, plan, quantity, router, type]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('sv_checkout_email', String(email || '').trim());
    } catch {
    }
  }, [email]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('sv_checkout_promo', String(promoCode || '').trim());
    } catch {
    }
  }, [promoCode]);

  const submit = async () => {
    const items = Array.isArray(cart) ? cart : [];
    if (items.length === 0) {
      toast.error('Your cart is empty.');
      return;
    }

    const cleanEmail = String(email || '').trim();
    if (!cleanEmail) {
      toast.error('Please enter your email to receive your receipt.');
      return;
    }

    if (!steamId) {
      toast.error('Please sign in with Steam to continue.');
      return;
    }

    const cleanPromo = String(promoCode || '').trim();

    setSubmitting(true);
    try {
      const payload: any = { steamId, email: cleanEmail, items };
      if (cleanPromo) payload.promoCode = cleanPromo;

      const res = await fetch('/api/payment/checkout-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(String(data?.error || 'Failed to create checkout session'));
        setSubmitting(false);
        return;
      }

      if (data?.url) {
        window.location.href = String(data.url);
        return;
      }

      toast.error('Failed to redirect to checkout');
      setSubmitting(false);
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed to process checkout'));
      setSubmitting(false);
    }
  };

  const isEmpty = (cartSummary.rows || []).length === 0;
  if (isEmpty) {
    return (
      <div className="flex h-dvh bg-[#08090d] text-white font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
          <div className="w-full max-w-3xl mx-auto bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-blue-600/20 border border-blue-500/40 shrink-0">
                <ShoppingCart className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Checkout</p>
                <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">Your cart is empty</h1>
              </div>
            </div>
            <p className="text-[11px] md:text-[12px] text-gray-400">Add items from Shop or Pro, then come back here to pay.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/shop" className="bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all">
                Shop
              </Link>
              <Link href="/pro" className="bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 text-white py-2 px-4 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all">
                Pro
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="w-full max-w-3xl mx-auto bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6 md:space-y-8">
          <div className="flex items-center justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-blue-600/20 border border-blue-500/40 shrink-0">
                <ShoppingCart className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-1">Checkout</p>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-black italic uppercase tracking-tighter">Shopping Cart</h1>
              </div>
            </div>

            <Link
              href="/shop"
              className="hidden sm:inline-flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 text-white py-2 md:py-3 px-4 md:px-6 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all"
            >
              Shop
            </Link>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Items</div>
              <div className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Total</div>
            </div>

            <div className="space-y-2">
              {cartSummary.rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded-xl p-3">
                  <div className="min-w-0">
                    <div className="text-[10px] md:text-[11px] font-black text-white truncate">{row.label}</div>
                    <div className="text-[10px] text-gray-400 truncate">{row.detail}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-2 py-1">
                      <button
                        onClick={() => {
                          const next = (cart || []).map((i) => ({ ...i })) as any[];
                          if (row.key.startsWith('credits:')) {
                            const pack = row.key.split(':')[1] as any;
                            const it = next.find((x) => x.kind === 'credits' && x.pack === pack);
                            if (it) it.quantity = clampInt(Number(it.quantity || 1) - 1, 1, 99);
                          } else if (row.key.startsWith('spins:')) {
                            const pack = row.key.split(':')[1] as any;
                            const it = next.find((x) => x.kind === 'spins' && x.pack === pack);
                            if (it) it.quantity = clampInt(Number(it.quantity || 1) - 1, 1, 99);
                          } else if (row.key.startsWith('consumable:')) {
                            const t = row.key.split(':')[1] as any;
                            const it = next.find((x) => x.kind === 'consumable' && x.consumableType === t);
                            if (it) it.quantity = clampInt(Number(it.quantity || 1) - 1, 1, 100);
                          }
                          setCart(next as any);
                          writeCart(next as any);
                        }}
                        disabled={row.key.startsWith('pro:')}
                        className="p-1 disabled:opacity-40"
                        title="Decrease"
                      >
                        <Minus size={14} />
                      </button>
                      <div className="text-[10px] font-black text-white w-6 text-center">{row.qty}</div>
                      <button
                        onClick={() => {
                          const next = (cart || []).map((i) => ({ ...i })) as any[];
                          if (row.key.startsWith('credits:')) {
                            const pack = row.key.split(':')[1] as any;
                            const it = next.find((x) => x.kind === 'credits' && x.pack === pack);
                            if (it) it.quantity = clampInt(Number(it.quantity || 1) + 1, 1, 99);
                          } else if (row.key.startsWith('spins:')) {
                            const pack = row.key.split(':')[1] as any;
                            const it = next.find((x) => x.kind === 'spins' && x.pack === pack);
                            if (it) it.quantity = clampInt(Number(it.quantity || 1) + 1, 1, 99);
                          } else if (row.key.startsWith('consumable:')) {
                            const t = row.key.split(':')[1] as any;
                            const it = next.find((x) => x.kind === 'consumable' && x.consumableType === t);
                            if (it) it.quantity = clampInt(Number(it.quantity || 1) + 1, 1, 100);
                          }
                          setCart(next as any);
                          writeCart(next as any);
                        }}
                        disabled={row.key.startsWith('pro:')}
                        className="p-1 disabled:opacity-40"
                        title="Increase"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="text-[11px] font-black text-white w-[88px] text-right">{formatEurCents(row.amount)}</div>

                    <button
                      onClick={() => {
                        const next = (cart || []).filter((i) => {
                          if (row.key.startsWith('pro:')) return i.kind !== 'pro';
                          if (row.key.startsWith('credits:')) return !(i.kind === 'credits' && `credits:${i.pack}` === row.key);
                          if (row.key.startsWith('spins:')) return !(i.kind === 'spins' && `spins:${i.pack}` === row.key);
                          if (row.key.startsWith('consumable:')) return !(i.kind === 'consumable' && `consumable:${i.consumableType}` === row.key);
                          return true;
                        });
                        setCart(next);
                        writeCart(next);
                      }}
                      className="p-2 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 rounded-xl transition-all"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Subtotal</div>
              <div className="text-2xl font-black text-white leading-none">{formatEurCents(cartSummary.total)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5">
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Receipt email</p>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
              />
              <p className="mt-2 text-[10px] text-gray-400">We’ll send your receipt/invoice to this email after payment.</p>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5">
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Promo code (optional)</p>
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="WELCOME20"
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-emerald-300 outline-none focus:border-emerald-500 transition-all placeholder:text-gray-700"
              />
              <p className="mt-2 text-[10px] text-gray-400">Applied at checkout. Some codes are limited to one use per user.</p>
            </div>
          </div>

          <div className="pt-2">
            {authLoading ? (
              <button
                disabled
                className="w-full bg-white/5 text-gray-400 py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </button>
            ) : !steamId ? (
              <Link
                href="/inventory"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <CreditCard size={14} /> Sign in with Steam
              </Link>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <CreditCard size={14} /> Proceed to payment
                  </>
                )}
              </button>
            )}
          </div>

          <div className="text-center text-[10px] text-gray-500">
            Payments are processed securely through Stripe.
          </div>
        </div>
      </div>
    </div>
  );
}
