"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { ShoppingCart, Package, Loader2, Heart, Download, Zap, Clock } from 'lucide-react';
import { useToast } from '@/app/components/Toast';

export default function ShopPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);
    } catch {
      setUser(null);
    }
  }, []);

  const handleCheckout = async (type: 'wishlist_slot' | 'inventory_export_boost' | 'price_scan_boost' | 'cache_boost', quantity: number = 1) => {
    if (!user?.steamId) {
      toast.error('You must be signed in with Steam to purchase. Please sign in first.');
      setTimeout(() => window.location.href = '/inventory', 2000);
      return;
    }

    setLoading(`${type}_${quantity}`);
    try {
      const res = await fetch('/api/payment/checkout-consumable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity, steamId: user.steamId }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) {
          toast.error('You must be signed in with Steam to purchase. Please sign in first.');
          setTimeout(() => window.location.href = '/inventory', 2000);
        } else {
          toast.error(data.error || 'Failed to create checkout session');
        }
        setLoading(null);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to redirect to checkout');
        setLoading(null);
      }
    } catch (error) {
      toast.error('Failed to process purchase. Please try again.');
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
              <ShoppingCart className="text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Consumables</p>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black italic uppercase tracking-tighter">Shop</h1>
            </div>
          </div>

          <p className="text-[11px] md:text-[12px] text-gray-400 leading-relaxed">
            Purchase consumables to enhance your free account. Perfect if you only need specific features without a full Pro subscription.
          </p>

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
              <button
                onClick={() => handleCheckout('wishlist_slot', 1)}
                disabled={loading === 'wishlist_slot_1' || !user?.steamId}
                className="w-full bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-pink-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === 'wishlist_slot_1' ? (
                  <>
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={12} /> Purchase Slot
                  </>
                )}
              </button>
            </div>

            {/* Inventory Export Boost */}
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-5 md:p-6 space-y-3 md:space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/40">
                  <Download className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Export Boost</p>
                  <p className="text-xl md:text-2xl font-black text-white">€1.49</p>
                  <p className="text-[8px] md:text-[9px] text-gray-500">one-time</p>
                </div>
              </div>
              <p className="text-[10px] md:text-[11px] text-gray-300 leading-relaxed">
                Export your inventory data 10 more times. Perfect for backing up or analyzing your collection.
              </p>
              <p className="text-[8px] md:text-[9px] text-emerald-400 font-bold">
                ✓ 10 additional exports
              </p>
              <button
                onClick={() => handleCheckout('inventory_export_boost', 1)}
                disabled={loading === 'inventory_export_boost_1' || !user?.steamId}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === 'inventory_export_boost_1' ? (
                  <>
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={12} /> Purchase Boost
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
              <button
                onClick={() => handleCheckout('price_scan_boost', 1)}
                disabled={loading === 'price_scan_boost_1' || !user?.steamId}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-purple-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === 'price_scan_boost_1' ? (
                  <>
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
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
              <button
                onClick={() => handleCheckout('cache_boost', 1)}
                disabled={loading === 'cache_boost_1' || !user?.steamId}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-amber-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === 'cache_boost_1' ? (
                  <>
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Processing...
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

