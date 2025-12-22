"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { ShoppingCart, Package, Crown, Loader2, Sparkles, Bell, Heart } from 'lucide-react';
import { useToast } from '@/app/components/Toast';

export default function ShopPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
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

    // Load categories
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  const isPro = user?.proUntil && new Date(user.proUntil) > new Date();

  const handleCheckout = async (type: 'price_tracker_slot' | 'wishlist_slot', quantity: number = 1) => {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Sidebar categories={categories} activeCat={null} setActiveCat={() => {}} />
      
      <main className="ml-0 md:ml-64 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <ShoppingCart className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wider">Shop</h1>
            </div>
            <p className="text-slate-400 text-sm md:text-base">
              Purchase Pro subscriptions and consumables to enhance your SkinVault experience
            </p>
          </div>

          {/* Pro Subscriptions Section */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Crown className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl font-black uppercase tracking-wider">Pro Subscriptions</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* 1 Month */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">1 Month</h3>
                  <Crown className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-black">€9.99</span>
                  <span className="text-slate-400 text-sm ml-2">/month</span>
                </div>
                <ul className="text-sm text-slate-300 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Unlimited wishlist items
                  </li>
                  <li className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    Unlimited price alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Advanced stats
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Discord bot features
                  </li>
                </ul>
                <Link
                  href="/pro"
                  className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest py-3 px-4 rounded-lg text-center transition-all"
                >
                  View Details
                </Link>
              </div>

              {/* 3 Months */}
              <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-2 border-blue-500 rounded-xl p-6 hover:border-blue-400 transition-all relative">
                <div className="absolute top-4 right-4 bg-blue-500 text-white text-xs font-black uppercase px-2 py-1 rounded">
                  Best Value
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">3 Months</h3>
                  <Crown className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-black">€24.99</span>
                  <span className="text-slate-400 text-sm ml-2">/3 months</span>
                </div>
                <div className="mb-4">
                  <span className="text-green-400 text-sm font-bold">Save €4.98</span>
                </div>
                <ul className="text-sm text-slate-300 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Unlimited wishlist items
                  </li>
                  <li className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    Unlimited price alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Advanced stats
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Discord bot features
                  </li>
                </ul>
                <Link
                  href="/pro"
                  className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest py-3 px-4 rounded-lg text-center transition-all"
                >
                  View Details
                </Link>
              </div>

              {/* 6 Months */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">6 Months</h3>
                  <Crown className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-black">€44.99</span>
                  <span className="text-slate-400 text-sm ml-2">/6 months</span>
                </div>
                <div className="mb-4">
                  <span className="text-green-400 text-sm font-bold">Save €14.95</span>
                </div>
                <ul className="text-sm text-slate-300 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Unlimited wishlist items
                  </li>
                  <li className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    Unlimited price alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Advanced stats
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Discord bot features
                  </li>
                </ul>
                <Link
                  href="/pro"
                  className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest py-3 px-4 rounded-lg text-center transition-all"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>

          {/* Consumables Section */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Package className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-black uppercase tracking-wider">Consumables</h2>
            </div>
            
            <p className="text-slate-400 mb-6 text-sm">
              Purchase extra slots for price trackers and wishlist items. Perfect if you only need a few extra slots without a full Pro subscription.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Price Tracker Slots */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Bell className="w-6 h-6 text-blue-400" />
                  <h3 className="text-xl font-bold">Price Tracker Slots</h3>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                  Add extra price alerts to track more items. Each slot allows you to set one additional price alert.
                </p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-black">€2.99</span>
                    <span className="text-slate-400 text-sm">per slot</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Permanent slot - never expires
                  </div>
                </div>
                <button
                  onClick={() => handleCheckout('price_tracker_slot', 1)}
                  disabled={loading === 'price_tracker_slot_1' || !user?.steamId}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black uppercase text-xs tracking-widest py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {loading === 'price_tracker_slot_1' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Purchase Slot
                    </>
                  )}
                </button>
              </div>

              {/* Wishlist Slots */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Heart className="w-6 h-6 text-pink-400" />
                  <h3 className="text-xl font-bold">Wishlist Slots</h3>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                  Add extra items to your wishlist. Each slot allows you to add one additional item to your wishlist.
                </p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-black">€1.99</span>
                    <span className="text-slate-400 text-sm">per slot</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Permanent slot - never expires
                  </div>
                </div>
                <button
                  onClick={() => handleCheckout('wishlist_slot', 1)}
                  disabled={loading === 'wishlist_slot_1' || !user?.steamId}
                  className="w-full bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black uppercase text-xs tracking-widest py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {loading === 'wishlist_slot_1' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Purchase Slot
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              About Consumables
            </h3>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>• Consumables are one-time purchases that add permanent slots to your account</li>
              <li>• Slots are permanent and never expire</li>
              <li>• Perfect if you only need a few extra slots without a full Pro subscription</li>
              <li>• Pro users get unlimited slots automatically - no need to purchase consumables</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

