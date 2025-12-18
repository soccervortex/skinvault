"use client";

import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-6">
      <div className="w-full max-w-lg bg-[#11141d] border border-amber-500/30 p-10 rounded-[3rem] shadow-2xl text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/40">
            <XCircle className="text-amber-400" size={48} />
          </div>
        </div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter">
          Payment Cancelled
        </h1>
        <p className="text-[11px] text-gray-400">
          Your payment was cancelled. No charges were made. You can try again anytime.
        </p>
        <Link
          href="/pro"
          className="inline-block bg-blue-600 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all"
        >
          Back to Pro
        </Link>
      </div>
    </div>
  );
}
