"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { ShoppingCart, Package, Loader2, Heart, Download, Zap, Clock, MessageSquare, CheckCircle2, Coins } from 'lucide-react';
import { useToast } from '@/app/components/Toast';
import { checkProStatus } from '@/app/utils/proxy-utils';
import { preloadRewards } from '@/app/utils/pro-limits';
import CartAddedModal from '@/app/components/CartAddedModal';
import { addToCart } from '@/app/utils/cart-client';

export default function ShopPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [userRewards, setUserRewards] = useState<any[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [creditsRestriction, setCreditsRestriction] = useState<{ banned: boolean; timeoutActive: boolean; timeoutUntil: string | null } | null>(null);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cartModalMessage, setCartModalMessage] = useState<string>('');
  const toast = useToast();

  const handleCreditsCheckout = async (pack: 'starter' | 'value' | 'mega' | 'giant' | 'whale' | 'titan' | 'legend') => {
    if (!user?.steamId) {
      toast.error('You must be signed in with Steam to purchase. Please sign in first.');
      setTimeout(() => window.location.href = '/inventory', 2000);
      return;
    }

    if (creditsRestriction?.banned || creditsRestriction?.timeoutActive) {
      toast.error('Credits purchases are restricted for this account.');
      return;
    }

    setLoading(`credits_${pack}`);
    try {
      addToCart({ kind: 'credits', pack, quantity: 1 } as any);
      setCartModalMessage('Credits were added to your cart.');
      setCartModalOpen(true);
    } catch {
      toast.error('Failed to add item to cart.');
    }
    setLoading(null);
  };

  const handleSpinsCheckout = async (pack: 'starter' | 'value' | 'mega' | 'giant' | 'whale' | 'titan' | 'legend') => {
    if (!user?.steamId) {
      toast.error('You must be signed in with Steam to purchase. Please sign in first.');
      setTimeout(() => window.location.href = '/inventory', 2000);
      return;
    }

    setLoading(`spins_${pack}`);
    try {
      addToCart({ kind: 'spins', pack, quantity: 1 } as any);
      setCartModalMessage('Spins were added to your cart.');
      setCartModalOpen(true);
    } catch {
      toast.error('Failed to add item to cart.');
    }
    setLoading(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);
      
      // Check Pro status
      if (parsedUser?.steamId) {
        checkProStatus(parsedUser.steamId).then(setIsPro);

        fetch('/api/credits/restriction', { cache: 'no-store' })
          .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
          .then(({ ok, j }) => {
            if (!ok) return;
            setCreditsRestriction({
              banned: !!j?.banned,
              timeoutActive: !!j?.timeoutActive,
              timeoutUntil: j?.timeoutUntil ? String(j.timeoutUntil) : null,
            });
          })
          .catch(() => setCreditsRestriction(null));
        
        // Load user rewards to check what they already have
        setLoadingRewards(true);
        preloadRewards(parsedUser.steamId).then(async () => {
          try {
            const res = await fetch(`/api/user/rewards?steamId=${parsedUser.steamId}`);
            if (res.ok) {
              const data = await res.json();
              const rewards = (data.rewards || []).map((r: any) => r.reward).filter((r: any) => r != null);
              setUserRewards(rewards);
            }
          } catch (error) {
            console.error('Failed to load rewards:', error);
          } finally {
            setLoadingRewards(false);
          }
        }).catch(() => {
          setLoadingRewards(false);
        });
      } else {
        setLoadingRewards(false);
      }
    } catch {
      setUser(null);
      setLoadingRewards(false);
    }
  }, []);

  // Helper to check if user already has a consumable
  const hasConsumable = (type: string): boolean => {
    return userRewards.some((reward: any) => reward?.type === type);
  };

  const handleCheckout = async (type: 'wishlist_slot' | 'discord_access' | 'price_scan_boost' | 'cache_boost', quantity: number = 1) => {
    if (!user?.steamId) {
      toast.error('You must be signed in with Steam to purchase. Please sign in first.');
      setTimeout(() => window.location.href = '/inventory', 2000);
      return;
    }

    setLoading(`${type}_${quantity}`);
    try {
      addToCart({ kind: 'consumable', consumableType: type, quantity } as any);
      setCartModalMessage('Item was added to your cart.');
      setCartModalOpen(true);
    } catch {
      toast.error('Failed to add item to cart.');
    }
    setLoading(null);
  };

  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar />
      <CartAddedModal
        isOpen={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        title="Added to cart"
        message={cartModalMessage || 'Your item was added to your cart.'}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="w-full max-w-4xl mx-auto bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6 md:space-y-8">
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-blue-600/20 border border-blue-500/40 shrink-0">
              <ShoppingCart className="text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-1">Store</p>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black italic uppercase tracking-tighter">Shop</h1>
            </div>
          </div>

          <p className="text-[11px] md:text-[12px] text-gray-400 leading-relaxed mb-6 md:mb-8">
            Purchase credits, spins, and consumables to enhance your account. Perfect if you only need specific features without a full Pro subscription.
          </p>

          <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40">
                <Coins className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Credits</p>
                <p className="text-xl md:text-2xl font-black text-white">Buy Credits</p>
              </div>
            </div>
            <p className="text-[10px] md:text-[11px] text-gray-300 leading-relaxed">
              Credits can be used for giveaways and other credit-based features.
            </p>

            {(creditsRestriction?.banned || creditsRestriction?.timeoutActive) && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-[10px] text-red-200">
                <div className="font-black uppercase tracking-widest text-[9px] text-red-300">Credits purchases restricted</div>
                <div className="mt-1">
                  {creditsRestriction?.banned
                    ? 'Your account is banned from using credits.'
                    : `Your account is temporarily restricted from using credits${creditsRestriction?.timeoutUntil ? ` until ${creditsRestriction.timeoutUntil}` : ''}.`}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch">
              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Starter</p>
                  <p className="text-lg font-black">500 Credits</p>
                  <p className="text-[10px] text-gray-400">€1.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleCreditsCheckout('starter')}
                  disabled={loading === 'credits_starter' || !user?.steamId || !!creditsRestriction?.banned || !!creditsRestriction?.timeoutActive}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'credits_starter' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Value</p>
                  <p className="text-lg font-black">1500 Credits</p>
                  <p className="text-[10px] text-gray-400">€4.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleCreditsCheckout('value')}
                  disabled={loading === 'credits_value' || !user?.steamId || !!creditsRestriction?.banned || !!creditsRestriction?.timeoutActive}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'credits_value' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Mega</p>
                  <p className="text-lg font-black">4000 Credits</p>
                  <p className="text-[10px] text-gray-400">€9.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleCreditsCheckout('mega')}
                  disabled={loading === 'credits_mega' || !user?.steamId || !!creditsRestriction?.banned || !!creditsRestriction?.timeoutActive}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'credits_mega' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Giant</p>
                  <p className="text-lg font-black">10000 Credits</p>
                  <p className="text-[10px] text-gray-400">€19.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleCreditsCheckout('giant')}
                  disabled={loading === 'credits_giant' || !user?.steamId || !!creditsRestriction?.banned || !!creditsRestriction?.timeoutActive}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'credits_giant' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Whale</p>
                  <p className="text-lg font-black">30000 Credits</p>
                  <p className="text-[10px] text-gray-400">€49.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleCreditsCheckout('whale')}
                  disabled={loading === 'credits_whale' || !user?.steamId || !!creditsRestriction?.banned || !!creditsRestriction?.timeoutActive}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'credits_whale' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Titan</p>
                  <p className="text-lg font-black">50000 Credits</p>
                  <p className="text-[10px] text-gray-400">€74.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleCreditsCheckout('titan')}
                  disabled={loading === 'credits_titan' || !user?.steamId || !!creditsRestriction?.banned || !!creditsRestriction?.timeoutActive}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'credits_titan' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Legend</p>
                  <p className="text-lg font-black">75000 Credits</p>
                  <p className="text-[10px] text-gray-400">€99.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleCreditsCheckout('legend')}
                  disabled={loading === 'credits_legend' || !user?.steamId || !!creditsRestriction?.banned || !!creditsRestriction?.timeoutActive}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'credits_legend' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-yellow-600/20 border border-yellow-500/40">
                <Package className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Spins</p>
                <p className="text-xl md:text-2xl font-black text-white">Buy Spins</p>
              </div>
            </div>
            <p className="text-[10px] md:text-[11px] text-gray-300 leading-relaxed">
              Spins are added as bonus spins and can be used after your daily spin limit.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch">
              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Starter</p>
                  <p className="text-lg font-black">5 Spins</p>
                  <p className="text-[10px] text-gray-400">€1.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleSpinsCheckout('starter')}
                  disabled={loading === 'spins_starter' || !user?.steamId}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-yellow-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'spins_starter' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Value</p>
                  <p className="text-lg font-black">15 Spins</p>
                  <p className="text-[10px] text-gray-400">€4.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleSpinsCheckout('value')}
                  disabled={loading === 'spins_value' || !user?.steamId}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-yellow-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'spins_value' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Mega</p>
                  <p className="text-lg font-black">40 Spins</p>
                  <p className="text-[10px] text-gray-400">€9.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleSpinsCheckout('mega')}
                  disabled={loading === 'spins_mega' || !user?.steamId}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-yellow-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'spins_mega' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Giant</p>
                  <p className="text-lg font-black">100 Spins</p>
                  <p className="text-[10px] text-gray-400">€19.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleSpinsCheckout('giant')}
                  disabled={loading === 'spins_giant' || !user?.steamId}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-yellow-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'spins_giant' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Whale</p>
                  <p className="text-lg font-black">300 Spins</p>
                  <p className="text-[10px] text-gray-400">€49.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleSpinsCheckout('whale')}
                  disabled={loading === 'spins_whale' || !user?.steamId}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-yellow-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'spins_whale' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Titan</p>
                  <p className="text-lg font-black">500 Spins</p>
                  <p className="text-[10px] text-gray-400">€74.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleSpinsCheckout('titan')}
                  disabled={loading === 'spins_titan' || !user?.steamId}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-yellow-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'spins_titan' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/30 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col h-full transition-all">
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black">Legend</p>
                  <p className="text-lg font-black">750 Spins</p>
                  <p className="text-[10px] text-gray-400">€99.99</p>
                </div>
                <button
                  style={{ marginTop: 'auto' }}
                  onClick={() => handleSpinsCheckout('legend')}
                  disabled={loading === 'spins_legend' || !user?.steamId}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-yellow-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading === 'spins_legend' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={12} /> Buy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Wishlist Slots */}
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-pink-600/20 border border-pink-500/40">
                  <Heart className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Wishlist Slots</p>
                  <p className="text-xl md:text-2xl font-black text-white">€1.99</p>
                  <p className="text-[8px] md:text-[9px] text-gray-500">per slot</p>
                </div>
              </div>
              <p className="text-[10px] md:text-[11px] text-gray-300 leading-relaxed">
                Add extra items to your wishlist. Each slot allows you to add one additional item to your wishlist.
              </p>
              <p className="text-[8px] md:text-[9px] text-emerald-400 font-bold">
                ✓ Permanent slot - never expires
              </p>
              {isPro && (
                <p className="text-[8px] md:text-[9px] text-blue-400 font-bold">
                  ⚠ Pro users have unlimited wishlist slots
                </p>
              )}
              <button
                onClick={() => handleCheckout('wishlist_slot', 1)}
                disabled={loading === 'wishlist_slot_1' || !user?.steamId || isPro}
                className="w-full bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-pink-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === 'wishlist_slot_1' ? (
                  <>
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
                  </>
                ) : isPro ? (
                  <>
                    <CheckCircle2 size={12} /> Already Have (Pro)
                  </>
                ) : (
                  <>
                    <ShoppingCart size={12} /> Purchase Slot
                  </>
                )}
              </button>
            </div>

            {/* Discord Access */}
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Discord Access</p>
                  <p className="text-xl md:text-2xl font-black text-white">€4.99</p>
                  <p className="text-[8px] md:text-[9px] text-gray-500">one-time</p>
                </div>
              </div>
              <p className="text-[10px] md:text-[11px] text-gray-300 leading-relaxed">
                Get Discord bot access and create up to 3 price trackers. Receive price alerts directly in Discord for your favorite items.
              </p>
              <p className="text-[8px] md:text-[9px] text-emerald-400 font-bold">
                ✓ Permanent access - never expires
              </p>
              {isPro ? (
                <p className="text-[8px] md:text-[9px] text-blue-400 font-bold">
                  ⚠ Pro users already have unlimited trackers
                </p>
              ) : hasConsumable('discord_access') ? (
                <p className="text-[8px] md:text-[9px] text-emerald-400 font-bold">
                  ✓ You already have Discord access
                </p>
              ) : (
                <p className="text-[8px] md:text-[9px] text-orange-400 font-bold">
                  ⚠ Free users only - Pro users already have unlimited trackers
                </p>
              )}
              <button
                onClick={() => handleCheckout('discord_access', 1)}
                disabled={loading === 'discord_access_1' || !user?.steamId || isPro || hasConsumable('discord_access')}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === 'discord_access_1' ? (
                  <>
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
                  </>
                ) : isPro ? (
                  <>
                    <CheckCircle2 size={12} /> Already Have (Pro)
                  </>
                ) : hasConsumable('discord_access') ? (
                  <>
                    <CheckCircle2 size={12} /> Already Purchased
                  </>
                ) : (
                  <>
                    <ShoppingCart size={12} /> Purchase Access
                  </>
                )}
              </button>
            </div>

            {/* Price Scan Boost */}
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/40">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Scan Boost</p>
                  <p className="text-xl md:text-2xl font-black text-white">€2.49</p>
                  <p className="text-[8px] md:text-[9px] text-gray-500">one-time</p>
                </div>
              </div>
              <p className="text-[10px] md:text-[11px] text-gray-300 leading-relaxed">
                Increase concurrent price scans from 3 to 5. Scan prices faster for your inventory and wishlist.
              </p>
              <p className="text-[8px] md:text-[9px] text-emerald-400 font-bold">
                ✓ Permanent upgrade
              </p>
              {isPro ? (
                <p className="text-[8px] md:text-[9px] text-blue-400 font-bold">
                  ⚠ Pro users already have faster scanning (10 concurrent)
                </p>
              ) : hasConsumable('price_scan_boost') ? (
                <p className="text-[8px] md:text-[9px] text-emerald-400 font-bold">
                  ✓ You already have this boost
                </p>
              ) : null}
              <button
                onClick={() => handleCheckout('price_scan_boost', 1)}
                disabled={loading === 'price_scan_boost_1' || !user?.steamId || isPro || hasConsumable('price_scan_boost')}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-purple-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === 'price_scan_boost_1' ? (
                  <>
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
                  </>
                ) : isPro ? (
                  <>
                    <CheckCircle2 size={12} /> Already Have (Pro)
                  </>
                ) : hasConsumable('price_scan_boost') ? (
                  <>
                    <CheckCircle2 size={12} /> Already Purchased
                  </>
                ) : (
                  <>
                    <ShoppingCart size={12} /> Purchase Boost
                  </>
                )}
              </button>
            </div>

            {/* Cache Boost */}
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-amber-600/20 border border-amber-500/40">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Cache Boost</p>
                  <p className="text-xl md:text-2xl font-black text-white">€1.99</p>
                  <p className="text-[8px] md:text-[9px] text-gray-500">one-time</p>
                </div>
              </div>
              <p className="text-[10px] md:text-[11px] text-gray-300 leading-relaxed">
                Extend price cache duration from 30 minutes to 1 hour. Prices update less frequently, saving API requests.
              </p>
              <p className="text-[8px] md:text-[9px] text-emerald-400 font-bold">
                ✓ Permanent upgrade
              </p>
              {isPro ? (
                <p className="text-[8px] md:text-[9px] text-blue-400 font-bold">
                  ⚠ Pro users already have better cache (2 hours)
                </p>
              ) : hasConsumable('cache_boost') ? (
                <p className="text-[8px] md:text-[9px] text-emerald-400 font-bold">
                  ✓ You already have this boost
                </p>
              ) : null}
              <button
                onClick={() => handleCheckout('cache_boost', 1)}
                disabled={loading === 'cache_boost_1' || !user?.steamId || isPro || hasConsumable('cache_boost')}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-amber-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === 'cache_boost_1' ? (
                  <>
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
                  </>
                ) : isPro ? (
                  <>
                    <CheckCircle2 size={12} /> Already Have (Pro)
                  </>
                ) : hasConsumable('cache_boost') ? (
                  <>
                    <CheckCircle2 size={12} /> Already Purchased
                  </>
                ) : (
                  <>
                    <ShoppingCart size={12} /> Purchase Boost
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5 space-y-2">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500 text-[9px] md:text-[10px]">About Consumables</p>
            <ul className="space-y-1 text-gray-300 text-[10px] md:text-[11px]">
              <li>– Consumables are one-time purchases that enhance your free account</li>
              <li>– All consumables are permanent and never expire</li>
              <li>– Perfect if you only need specific features without a full Pro subscription</li>
              <li>– Pro users get all features automatically - no need to purchase consumables</li>
              <li>– Note: Price trackers are Pro-only features and not available as consumables</li>
            </ul>
          </div>

          {!user && (
            <div className="pt-4 border-t border-white/5 text-center space-y-4">
              <p className="text-[11px] text-gray-400">
                Sign in with Steam to purchase consumables
              </p>
              <Link
                href="/inventory"
                className="inline-block bg-blue-600 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all"
              >
                Sign In with Steam
              </Link>
            </div>
          )}

          <div className="pt-4 border-t border-white/5 text-center">
            <p className="text-[8px] md:text-[9px] text-gray-500 mb-2">
              Want a full Pro subscription instead?
            </p>
            <Link
              href="/pro"
              className="inline-block text-blue-400 hover:text-blue-300 text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all"
            >
              View Pro Plans →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

