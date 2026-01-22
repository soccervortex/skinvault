"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Shield, Sparkles, Wallet } from 'lucide-react';

export default function AdminStripePage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [testMode, setTestMode] = useState(false);
  const [loadingTestMode, setLoadingTestMode] = useState(true);
  const [testModeMessage, setTestModeMessage] = useState<string | null>(null);
  const [testModeError, setTestModeError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const loadTestMode = async () => {
    if (!userIsOwner) return;
    setLoadingTestMode(true);
    try {
      const res = await fetch(`/api/admin/stripe-test-mode?steamId=${encodeURIComponent(String(user?.steamId || ''))}`, {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setTestMode((data as any)?.testMode === true);
      }
    } catch {
    } finally {
      setLoadingTestMode(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadTestMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const handleTestModeToggle = async (enabled: boolean) => {
    setTestModeMessage(null);
    setTestModeError(null);

    try {
      const res = await fetch('/api/admin/stripe-test-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ testMode: enabled }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok) {
        setTestMode(enabled);
        setTestModeMessage(String((data as any)?.message || `Test mode ${enabled ? 'enabled' : 'disabled'}`));
        setTimeout(() => setTestModeMessage(null), 3000);
      } else {
        setTestModeError(String((data as any)?.error || 'Failed to update test mode'));
      }
    } catch (e: any) {
      setTestModeError(String(e?.message || 'Request failed.'));
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Sign in first.</div>
      </div>
    );
  }

  if (!userIsOwner) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Access denied.</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 pb-24">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>

          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Owner</p>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Stripe Settings</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Stripe test mode toggle and shortcuts.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl md:rounded-2xl bg-yellow-500/10 border border-yellow-500/40 shrink-0">
                <Sparkles className="text-yellow-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Payment Settings</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Stripe Test Mode</h2>
              </div>
            </div>

            <p className="text-[10px] md:text-[11px] text-gray-400 mb-6">
              Enable test mode to use Stripe test keys (<code className="text-yellow-400">STRIPE_TEST_SECRET_KEY</code>) instead of production keys.
              All payments will be marked as <span className="text-yellow-400 font-bold">[TEST]</span> and won't charge real money.
            </p>

            {testModeMessage ? (
              <div className="mb-4 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
                <CheckCircle2 size={12} /> <span>{testModeMessage}</span>
              </div>
            ) : null}
            {testModeError ? (
              <div className="mb-4 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                <AlertTriangle size={12} /> <span>{testModeError}</span>
              </div>
            ) : null}

            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/40 shrink-0">
                  <Wallet className="text-blue-400" size={16} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Payment Settings</p>
                  <h3 className="text-base md:text-lg font-black italic uppercase tracking-tighter">Payments Manager</h3>
                </div>
              </div>
              <p className="text-[10px] md:text-[11px] text-gray-400 mb-4">View payments, invoice/receipt links, and manage payment visibility.</p>
              <button
                onClick={() => router.push('/admin/payments')}
                className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <Wallet size={14} /> Open Payments Manager
              </button>
            </div>

            {loadingTestMode ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading test mode status...
              </div>
            ) : (
              <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">Test Mode</span>
                  <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">
                    {testMode ? 'Using test keys (STRIPE_TEST_SECRET_KEY)' : 'Using production keys (STRIPE_SECRET_KEY)'}
                  </p>
                </div>
                <button
                  onClick={() => handleTestModeToggle(!testMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${testMode ? 'bg-yellow-600' : 'bg-gray-600'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${testMode ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            )}

            {testMode ? (
              <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl md:rounded-2xl p-4">
                <p className="text-[9px] md:text-[10px] text-yellow-400 font-bold mb-2">⚠️ Test Mode Active</p>
                <ul className="text-[9px] md:text-[10px] text-gray-300 space-y-1">
                  <li>• All payments will use test keys</li>
                  <li>• Products will be marked with [TEST] prefix</li>
                  <li>
                    • Use test card: <code className="text-yellow-400">4242 4242 4242 4242</code>
                  </li>
                  <li>• No real charges will be made</li>
                  <li>
                    • Make sure <code className="text-yellow-400">STRIPE_TEST_SECRET_KEY</code> is set in environment variables
                  </li>
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
