"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const steamId = searchParams.get('steamId');
    const months = searchParams.get('months');

    if (!sessionId || !steamId || !months) {
      setError('Missing payment information');
      setLoading(false);
      return;
    }

    // Give webhook a moment to process, then refresh user data
    const refreshProStatus = async (retries = 5) => {
      try {
        // Refresh Pro status
        const res = await fetch(`/api/user/pro?id=${steamId}`);
        const data = await res.json();
        
        // Update localStorage if this is the logged-in user
        const stored = localStorage.getItem('steam_user');
        if (stored) {
          const user = JSON.parse(stored);
          if (user.steamId === steamId) {
            user.proUntil = data.proUntil;
            localStorage.setItem('steam_user', JSON.stringify(user));
            // Trigger storage event so sidebar updates
            window.dispatchEvent(new Event('storage'));
          }
        }

        // If Pro status is still null and we have retries, wait and try again
        if (!data.proUntil && retries > 0) {
          setTimeout(() => refreshProStatus(retries - 1), 1000);
          return;
        }

        setLoading(false);
      } catch (e) {
        if (retries > 0) {
          setTimeout(() => refreshProStatus(retries - 1), 1000);
        } else {
          setError('Failed to verify payment. Your Pro status may take a few moments to activate.');
          setLoading(false);
        }
      }
    };

    // Start checking after 2 seconds
    setTimeout(() => refreshProStatus(), 2000);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-blue-500 mx-auto" size={32} />
          <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
            Verifying payment...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
        <div className="w-full max-w-lg bg-[#11141d] border border-red-500/30 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl text-center space-y-4 md:space-y-6">
          <p className="text-red-400 text-xs md:text-sm">{error}</p>
          <Link
            href="/pro"
            className="inline-block bg-blue-600 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all"
          >
            Back to Pro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
      <div className="w-full max-w-lg bg-[#11141d] border border-emerald-500/30 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl text-center space-y-4 md:space-y-6">
        <div className="flex justify-center">
          <div className="p-3 md:p-4 rounded-full bg-emerald-500/10 border border-emerald-500/40">
            <CheckCircle2 className="text-emerald-400" size={40} />
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
          Payment Successful!
        </h1>
        <p className="text-[10px] md:text-[11px] text-gray-400">
          Your Pro subscription has been activated. You can now enjoy all premium features.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <Link
            href="/inventory"
            className="bg-blue-600 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all"
          >
            Go to My Vault
          </Link>
          <Link
            href="/pro"
            className="bg-black/40 border border-white/10 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:border-white/20 transition-all"
          >
            View Pro Info
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-blue-500 mx-auto" size={32} />
          <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
            Loading...
          </p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}



