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
  const [purchaseType, setPurchaseType] = useState<'pro' | 'consumable' | 'credits' | 'spins' | null>(null);
  const [purchaseDetails, setPurchaseDetails] = useState<any>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const steamId = searchParams.get('steamId');
    const type = searchParams.get('type'); // 'pro' or 'consumable' or 'credits'
    const months = searchParams.get('months');
    const consumableType = searchParams.get('consumableType');
    const quantity = searchParams.get('quantity');
    const credits = searchParams.get('credits');
    const pack = searchParams.get('pack');
    const spins = searchParams.get('spins');

    if (!sessionId || !steamId || !type) {
      setError('Missing payment information');
      setLoading(false);
      return;
    }

    // Validate required fields based on type
    if (type === 'pro' && !months) {
      setError('Missing payment information (months)');
      setLoading(false);
      return;
    }

    if (type === 'consumable' && (!consumableType || !quantity)) {
      setError('Missing payment information (consumable details)');
      setLoading(false);
      return;
    }

    if (type === 'credits' && (!credits || !pack)) {
      setError('Missing payment information (credits details)');
      setLoading(false);
      return;
    }

    if (type === 'spins' && (!spins || !pack)) {
      setError('Missing payment information (spins details)');
      setLoading(false);
      return;
    }

    setPurchaseType(type as 'pro' | 'consumable' | 'credits' | 'spins');

    // Give webhook a moment to process, then verify and refresh user data
    const verifyAndRefresh = async (retries = 5) => {
      try {
        // First, check if purchase was fulfilled
        const verifyRes = await fetch(`/api/payment/verify-purchase?session_id=${sessionId}&steamId=${steamId}`);
        const verifyData = await verifyRes.json();
        
        // If purchase is already fulfilled, use that data
        if (verifyData.fulfilled && verifyData.purchase) {
          console.log('✅ Purchase already fulfilled');
          setPurchaseDetails(verifyData.purchase);
        } else {
          // If not fulfilled, try to fulfill it now (manual verification)
          console.log('Purchase not fulfilled yet, attempting manual fulfillment...');
          const fulfillRes = await fetch('/api/payment/verify-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, steamId }),
          });
          
          if (!fulfillRes.ok) {
            const errorData = await fulfillRes.json();
            throw new Error(errorData.error || 'Fulfillment request failed');
          }
          
          const fulfillData = await fulfillRes.json();
          
          if (fulfillData.fulfilled) {
            console.log('✅ Purchase manually fulfilled:', fulfillData.message);
            setPurchaseDetails({
              type: fulfillData.type,
              consumableType: fulfillData.consumableType,
              quantity: fulfillData.quantity,
              months: fulfillData.months,
              proUntil: fulfillData.proUntil,
              credits: fulfillData.credits,
              spins: fulfillData.spins,
              pack: fulfillData.pack,
              receiptUrl: fulfillData.receiptUrl,
              customerEmail: fulfillData.customerEmail,
              invoiceId: fulfillData.invoiceId,
              invoiceUrl: fulfillData.invoiceUrl,
              invoicePdf: fulfillData.invoicePdf,
              invoiceNumber: fulfillData.invoiceNumber,
            });
          } else {
            throw new Error(fulfillData.error || 'Fulfillment failed');
          }
        }

        // For Pro subscriptions, refresh Pro status
        if (type === 'pro') {
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
            setTimeout(() => verifyAndRefresh(retries - 1), 1000);
            return;
          }
        } else if (type === 'consumable') {
          // For consumables, refresh rewards cache
          const stored = localStorage.getItem('steam_user');
          if (stored) {
            const user = JSON.parse(stored);
            if (user.steamId === steamId) {
              // Clear rewards cache to force refresh
              const { clearRewardsCache } = await import('@/app/utils/pro-limits');
              clearRewardsCache();
              // Force reload rewards by fetching from API
              try {
                await fetch(`/api/user/rewards?steamId=${steamId}`);
              } catch (e) {
                // Ignore errors
              }
            }
          }
        } else if (type === 'credits') {
          // For credits purchases, refresh credits balance (sidebar / profile etc.)
          const stored = localStorage.getItem('steam_user');
          if (stored) {
            const user = JSON.parse(stored);
            if (user.steamId === steamId) {
              try {
                await fetch('/api/credits/balance');
              } catch (e) {
                // Ignore errors
              }
            }
          }
        } else if (type === 'spins') {
          // For spins purchases, refresh spin eligibility/balance
          try {
            await fetch('/api/spins', { cache: 'no-store' });
          } catch (e) {
            // Ignore errors
          }
        }

        setLoading(false);
      } catch (e: any) {
        if (retries > 0) {
          setTimeout(() => verifyAndRefresh(retries - 1), 1000);
        } else {
          const errorMsg = type === 'pro' 
            ? 'Failed to verify payment. Your Pro status may take a few moments to activate. If it doesn\'t appear, please contact support with your session ID: ' + sessionId
            : type === 'consumable'
              ? 'Failed to verify payment. Your consumable may take a few moments to activate. If it doesn\'t appear, please contact support with your session ID: ' + sessionId
              : 'Failed to verify payment. Your credits may take a few moments to appear. If they don\'t appear, please contact support with your session ID: ' + sessionId;
          setError(errorMsg);
          setLoading(false);
        }
      }
    };

    // Start checking after 2 seconds
    setTimeout(() => verifyAndRefresh(), 2000);
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
          {purchaseType === 'pro'
            ? 'Your Pro subscription has been activated. You can now enjoy all premium features.'
            : purchaseType === 'credits'
              ? purchaseDetails?.credits
                ? `Your ${purchaseDetails.credits} credits have been added to your account.`
                : 'Your purchase has been processed successfully. Your credits will appear shortly.'
              : purchaseType === 'spins'
                ? purchaseDetails?.spins
                  ? `Your ${purchaseDetails.spins} spins have been added to your account.`
                  : 'Your purchase has been processed successfully. Your spins will appear shortly.'
              : purchaseDetails?.consumableType
                ? `Your ${purchaseDetails.consumableType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}${purchaseDetails.quantity > 1 ? ` (x${purchaseDetails.quantity})` : ''} has been added to your account.`
                : 'Your purchase has been processed successfully. Your consumable has been added to your account.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <Link
            href="/inventory"
            className="bg-blue-600 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all"
          >
            Go to My Vault
          </Link>
          {(() => {
            const href = String(purchaseDetails?.receiptUrl || purchaseDetails?.invoiceUrl || purchaseDetails?.invoicePdf || '').trim();
            if (!href) return null;
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="bg-black/40 border border-white/10 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:border-white/20 transition-all"
              >
                Download Receipt
              </a>
            );
          })()}
          {purchaseType === 'pro' ? (
            <Link
              href="/pro"
              className="bg-black/40 border border-white/10 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:border-white/20 transition-all"
            >
              View Pro Info
            </Link>
          ) : (
            <Link
              href="/shop"
              className="bg-black/40 border border-white/10 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:border-white/20 transition-all"
            >
              Back to Shop
            </Link>
          )}
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









