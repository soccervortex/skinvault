"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Crown, Loader2 } from 'lucide-react';

export default function ProExpiredPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [proUntil, setProUntil] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Test localStorage accessibility first
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);

      // Fetch latest Pro status from server
      if (parsedUser?.steamId) {
        fetch(`/api/user/pro?id=${parsedUser.steamId}`)
          .then(res => res.json())
          .then(data => {
            setProUntil(data.proUntil || null);
            setLoading(false);
          })
          .catch(() => {
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    } catch {
      setUser(null);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-blue-500 mx-auto" size={32} />
          <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  const expiredDate = proUntil ? new Date(proUntil).toLocaleDateString() : null;

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
      <div className="w-full max-w-lg bg-[#11141d] border border-red-500/30 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl text-center space-y-4 md:space-y-6">
        <div className="flex justify-center">
          <div className="p-3 md:p-4 rounded-full bg-red-500/10 border border-red-500/40">
            <AlertCircle className="text-red-400" size={40} />
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Crown className="text-red-400" size={24} />
          <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
            Pro Subscription Expired
          </h1>
        </div>
        {expiredDate && (
          <p className="text-[10px] md:text-[11px] text-gray-400">
            Your Pro subscription expired on <span className="text-red-400 font-semibold">{expiredDate}</span>.
          </p>
        )}
        <p className="text-[10px] md:text-[11px] text-gray-400">
          Your premium features are no longer available. Renew your subscription to regain access to all Pro features.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <Link
            href="/pro"
            className="bg-blue-600 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all"
          >
            Renew Pro Subscription
          </Link>
          <Link
            href="/inventory"
            className="bg-black/40 border border-white/10 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:border-white/20 transition-all"
          >
            Back to My Vault
          </Link>
        </div>
      </div>
    </div>
  );
}

