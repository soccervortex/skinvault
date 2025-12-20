"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { Crown, CheckCircle2, Loader2, CreditCard, Gift, Sparkles } from 'lucide-react';

export default function ProInfoPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [freeMonthEligible, setFreeMonthEligible] = useState(false);
  const [claimingFreeMonth, setClaimingFreeMonth] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);
      
      // Check for promo code in URL
      const promo = searchParams.get('promo');
      const discount = searchParams.get('discount');
      if (promo) {
        setPromoCode(promo);
        setPromoDiscount(discount ? parseInt(discount) : 0);
      }
      
      // Check if eligible for free month (only if not Pro)
      const userIsPro = parsedUser?.proUntil && new Date(parsedUser.proUntil) > new Date();
      if (parsedUser?.steamId && !userIsPro) {
        fetch(`/api/user/free-month?id=${parsedUser.steamId}`)
          .then(res => res.json())
          .then(data => {
            if (data.eligible) {
              setFreeMonthEligible(true);
            }
          })
          .catch(() => {
            // ignore errors
          });
      }
    } catch {
      setUser(null);
    }
  }, [searchParams]);

  const isPro = user?.proUntil && new Date(user.proUntil) > new Date();

  const handleClaimFreeMonth = async () => {
    if (!user?.steamId) {
      alert('You must be signed in with Steam to claim the free month.');
      window.location.href = '/inventory';
      return;
    }

    setClaimingFreeMonth(true);
    try {
      const res = await fetch('/api/user/free-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: user.steamId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to claim free month');
        setClaimingFreeMonth(false);
        return;
      }

      // Update user in localStorage
      if (data.proUntil) {
        const updatedUser = { ...user, proUntil: data.proUntil };
        localStorage.setItem('steam_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        window.dispatchEvent(new Event('storage'));
        setFreeMonthEligible(false);
        alert(data.message || 'Free month claimed successfully!');
      }
      setClaimingFreeMonth(false);
    } catch (error) {
      alert('Failed to claim free month. Please try again.');
      setClaimingFreeMonth(false);
    }
  };

  const handleCheckout = async (plan: '1month' | '3months' | '6months') => {
    // Double-check user is signed in
    if (!user?.steamId) {
      alert('You must be signed in with Steam to purchase Pro. Please sign in first.');
      window.location.href = '/inventory';
      return;
    }

    setLoading(plan);
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan, 
          steamId: user.steamId,
          promoCode: promoCode || undefined,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        // Handle authentication errors
        if (res.status === 401) {
          alert(data.error || 'You must be signed in with Steam to purchase Pro.');
          // Clear potentially stale user data
          localStorage.removeItem('steam_user');
          window.location.href = '/inventory';
        } else {
          alert(data.error || 'Failed to start checkout');
        }
        setLoading(null);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start checkout');
        setLoading(null);
      }
    } catch (error) {
      alert('Payment system error. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar flex items-center justify-center">
        <div className="w-full max-w-4xl bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6 md:space-y-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-blue-600/20 border border-blue-500/40 shrink-0">
              <Crown className="text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Premium tier</p>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black italic uppercase tracking-tighter">SkinVault Pro</h1>
            </div>
          </div>

        {user && (
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <span className="font-black uppercase tracking-[0.3em] text-gray-500">Status:</span>
            {isPro ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={14} /> Active until {new Date(user.proUntil).toLocaleDateString()}
              </span>
            ) : (
              <span className="text-gray-300">Free tier</span>
            )}
          </div>
        )}

        {/* First Week Free Promotion Banner */}
        {user && !isPro && freeMonthEligible && (
          <div className="bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 border-2 border-emerald-500/40 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5 animate-pulse" />
            <div className="relative z-10">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 shrink-0">
                  <Gift className="text-emerald-400" size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="text-amber-400" size={16} />
                    <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-white">
                      Limited Time Offer
                    </h3>
                  </div>
                  <p className="text-[11px] md:text-[12px] text-gray-300 mb-4 leading-relaxed">
                    Claim <span className="font-black text-emerald-400">1 month FREE</span> of Pro! 
                    This special offer is available for new users in their first week. 
                    Unlock unlimited wishlist, advanced stats, and all Pro features.
                  </p>
                  <button
                    onClick={handleClaimFreeMonth}
                    disabled={claimingFreeMonth}
                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white py-3 md:py-4 px-6 md:px-8 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {claimingFreeMonth ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Claiming...
                      </>
                    ) : (
                      <>
                        <Gift size={16} /> Claim Free Month Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-[10px] md:text-[11px]">
          <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5 space-y-2">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500">What you unlock</p>
            <ul className="space-y-1 text-gray-300 text-[10px]">
              <li>– Unlimited wishlist size</li>
              <li>– ⚡ Faster price scanning (10x speed)</li>
              <li>– ⚡ Priority API requests</li>
              <li>– ⚡ Better caching (2x longer)</li>
              <li>– ⚡ Fast wishlist updates</li>
              <li>– Faster, priority price scanning</li>
              <li>– Advanced compare stats & value breakdown</li>
              <li>– Early access to new tools</li>
              <li>– Price alerts via Discord</li>
              <li>– Unlimited price trackers</li>
            </ul>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5 space-y-2">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500">Coming soon</p>
            <ul className="space-y-1 text-gray-300 text-[10px]">
              <li>– Multi-account portfolio overview</li>
              <li>– ROI & flip-helper suggestions</li>
            </ul>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5 space-y-2">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500">How to get Pro</p>
            <p className="text-gray-300 text-[10px]">
              Pro is currently granted manually by the site owner. Contact the owner with your SteamID64
              and payment proof; your account will be upgraded for the agreed number of months.
            </p>
          </div>
        </div>

        {user && (
          <div className="pt-4 border-t border-white/5">
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4 md:mb-6 text-center">
              {isPro ? 'Extend Your Pro Subscription' : 'Choose Your Plan'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-3 md:space-y-4">
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-1">1 Month</p>
                  {promoCode && promoDiscount > 0 ? (
                    <>
                      <p className="text-xl md:text-2xl font-black text-white line-through opacity-50">€9.99</p>
                      <p className="text-xl md:text-2xl font-black text-green-400">€{((999 - promoDiscount) / 100).toFixed(2)}</p>
                      <p className="text-[8px] md:text-[9px] text-green-400 mt-1">Promo korting!</p>
                    </>
                  ) : (
                    <p className="text-xl md:text-2xl font-black text-white">€9.99</p>
                  )}
                </div>
                <button
                  onClick={() => handleCheckout('1month')}
                  disabled={loading !== null || !user?.steamId}
                  className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading === '1month' ? (
                    <>
                      <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard size={12} /> Buy Now
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/40 border border-blue-500/40 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-3 md:space-y-4 relative">
                <div className="absolute -top-2 md:-top-3 left-1/2 -translate-x-1/2 px-2 md:px-3 py-0.5 rounded-full bg-blue-600 text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em]">
                  Popular
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-1">3 Months</p>
                  <p className="text-xl md:text-2xl font-black text-white">€24.99</p>
                  <p className="text-[8px] md:text-[9px] text-emerald-400 mt-1">Save €5</p>
                </div>
                <button
                  onClick={() => handleCheckout('3months')}
                  disabled={loading !== null || !user?.steamId}
                  className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading === '3months' ? (
                    <>
                      <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard size={12} /> Buy Now
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-3 md:space-y-4">
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-1">6 Months</p>
                  <p className="text-xl md:text-2xl font-black text-white">€44.99</p>
                  <p className="text-[8px] md:text-[9px] text-emerald-400 mt-1">Save €15</p>
                </div>
                <button
                  onClick={() => handleCheckout('6months')}
                  disabled={loading !== null || !user?.steamId}
                  className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading === '6months' ? (
                    <>
                      <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard size={12} /> Buy Now
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-[8px] md:text-[9px] text-gray-500 text-center mt-3 md:mt-4">
              Secure payment via Stripe. No card details stored on our servers.
            </p>
          </div>
        )}

        {!user && (
          <div className="pt-4 border-t border-white/5 text-center space-y-4">
            <p className="text-[11px] text-gray-400">
              Sign in with Steam to purchase Pro
            </p>
            <Link
              href="/inventory"
              className="inline-block bg-blue-600 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all"
            >
              Sign In with Steam
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-[10px] md:text-[11px] pt-4 border-t border-white/5">
          <div className="space-y-2 md:space-y-3">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500">Manual payment (alternative)</p>
            <p className="text-gray-400 text-[10px]">
              Prefer to pay manually? Share your Steam profile, SteamID64 and payment proof with the owner.
              They will grant you the correct number of months from the admin panel.
            </p>
          </div>

          <div className="space-y-2 md:space-y-3">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500">Secure checkout</p>
            <p className="text-gray-400 text-[10px]">
              Payments are processed securely through Stripe. Your card details are never stored on our servers.
              Pro is activated automatically after successful payment.
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
