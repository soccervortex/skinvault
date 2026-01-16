"use client";

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

function FixPurchaseContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const steamId = searchParams.get('steamId');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFix = async () => {
    if (!sessionId || !steamId) {
      setError('Missing sessionId or steamId');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/payment/fix-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, steamId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fix purchase');
      } else {
        setResult(data);
        // Clear rewards cache
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user_rewards_cache');
          window.dispatchEvent(new Event('storage'));
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fix purchase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] bg-[#08090d] text-white font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar flex items-center justify-center">
        <div className="w-full max-w-2xl bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6">
          <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
            Fix Purchase
          </h1>

          {sessionId && steamId ? (
            <>
              <div className="space-y-2">
                <p className="text-[10px] md:text-[11px] text-gray-400">Session ID:</p>
                <p className="text-[11px] md:text-[12px] font-mono text-gray-300 break-all">{sessionId}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] md:text-[11px] text-gray-400">Steam ID:</p>
                <p className="text-[11px] md:text-[12px] font-mono text-gray-300">{steamId}</p>
              </div>

              <button
                onClick={handleFix}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[11px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Fixing Purchase...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Fix Purchase
                  </>
                )}
              </button>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-red-400 font-bold text-[11px] md:text-[12px] mb-1">Error</p>
                    <p className="text-gray-300 text-[10px] md:text-[11px]">{error}</p>
                  </div>
                </div>
              )}

              {result && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="text-emerald-400 font-bold text-[11px] md:text-[12px] mb-1">Success!</p>
                    <p className="text-gray-300 text-[10px] md:text-[11px] mb-2">{result.message}</p>
                    {result.consumableType && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] text-gray-400">Type: <span className="text-gray-300">{result.consumableType}</span></p>
                        <p className="text-[10px] text-gray-400">Quantity: <span className="text-gray-300">{result.quantity}</span></p>
                      </div>
                    )}
                    <p className="text-[9px] text-emerald-400 mt-3">
                      ✓ Your rewards have been granted. Please refresh the page to see them.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-yellow-400 text-[11px] md:text-[12px]">
                Missing sessionId or steamId. Please provide them as URL parameters:
              </p>
              <p className="text-gray-300 text-[10px] md:text-[11px] mt-2 font-mono">
                /fix-purchase?sessionId=cs_test_...&steamId=7656119...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FixPurchasePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[100dvh] bg-[#08090d] text-white font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="animate-spin text-blue-500 mx-auto" size={32} />
            <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">
              Loading...
            </p>
          </div>
        </div>
      </div>
    }>
      <FixPurchaseContent />
    </Suspense>
  );
}

