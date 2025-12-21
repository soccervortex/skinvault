"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Application error:', error);
    }
    
    // In production, you could send this to an error reporting service
    // Example: Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4">
      <div className="w-full max-w-lg bg-[#11141d] border border-red-500/30 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl text-center space-y-4 md:space-y-6">
        <div className="flex justify-center">
          <div className="p-3 md:p-4 rounded-full bg-red-500/10 border border-red-500/40">
            <AlertTriangle className="text-red-400" size={40} />
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
          Something Went Wrong
        </h1>
        <p className="text-[10px] md:text-[11px] text-gray-400">
          We encountered an unexpected error. Please try again or return to the home page.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="text-left bg-black/40 p-4 rounded-xl border border-white/5 text-[9px] text-red-400">
            <summary className="cursor-pointer font-black uppercase mb-2">Error Details (Dev Only)</summary>
            <pre className="whitespace-pre-wrap break-words mt-2">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
          <Link
            href="/"
            className="bg-black/40 border border-white/10 px-5 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <Home size={14} />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

