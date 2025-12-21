"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { XCircle, Clock, Loader2 } from 'lucide-react';
import Stripe from 'stripe';

function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Check if session expired or was manually cancelled
    const checkSessionStatus = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        // Check session status via API
        const res = await fetch(`/api/payment/session-status?session_id=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.expired) {
            setIsExpired(true);
            // Redirect to expired page
            router.replace('/payment/expired');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to check session status:', error);
      }
      
      setLoading(false);
    };

    checkSessionStatus();
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-blue-500 mx-auto" size={32} />
          <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
            Checking payment status...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
      <div className="w-full max-w-lg bg-[#11141d] border border-amber-500/30 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl text-center space-y-4 md:space-y-6">
        <div className="flex justify-center">
          <div className="p-3 md:p-4 rounded-full bg-amber-500/10 border border-amber-500/40">
            <XCircle className="text-amber-400" size={40} />
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
          Payment Cancelled
        </h1>
        <p className="text-[10px] md:text-[11px] text-gray-400">
          Your payment was cancelled. No charges were made. You can try again anytime.
        </p>
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

export default function PaymentCancelPage() {
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
      <PaymentCancelContent />
    </Suspense>
  );
}
