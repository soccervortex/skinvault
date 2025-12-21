"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';

export default function ProExpirationWarning() {
  const [user, setUser] = useState<any>(null);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      
      const stored = window.localStorage.getItem('steam_user');
      const parsedUser = stored ? JSON.parse(stored) : null;
      setUser(parsedUser);

      // Check if user has dismissed the warning
      const dismissedKey = `pro_expiry_warning_dismissed_${parsedUser?.steamId || 'global'}`;
      const isDismissed = window.localStorage.getItem(dismissedKey) === 'true';
      setDismissed(isDismissed);

      // Calculate days until expiry
      if (parsedUser?.proUntil) {
        const expiryDate = new Date(parsedUser.proUntil);
        const now = new Date();
        const diffTime = expiryDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Only show warning if Pro is active and expires within 7 days
        if (diffDays > 0 && diffDays <= 7) {
          setDaysUntilExpiry(diffDays);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleDismiss = () => {
    if (typeof window === 'undefined' || !user?.steamId) return;
    
    try {
      const dismissedKey = `pro_expiry_warning_dismissed_${user.steamId}`;
      window.localStorage.setItem(dismissedKey, 'true');
      setDismissed(true);
    } catch {
      // Ignore storage errors
    }
  };

  // Don't show if:
  // - User is not Pro
  // - Pro doesn't expire soon (more than 7 days)
  // - Warning has been dismissed
  // - Pro has already expired
  if (!user?.proUntil || !daysUntilExpiry || dismissed || daysUntilExpiry <= 0) {
    return null;
  }

  const isExpiringSoon = daysUntilExpiry <= 3;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9998] max-w-2xl w-full mx-4 ${
      isExpiringSoon ? 'animate-pulse' : ''
    }`}>
      <div className={`bg-gradient-to-r ${
        isExpiringSoon 
          ? 'from-red-500/20 via-amber-500/20 to-red-500/20 border-red-500/40' 
          : 'from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-amber-500/40'
      } border rounded-[2rem] p-4 md:p-6 shadow-2xl backdrop-blur-xl relative`}>
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Dismiss warning"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-3 md:gap-4 pr-8">
          <div className={`p-2 rounded-xl ${
            isExpiringSoon ? 'bg-red-500/20' : 'bg-amber-500/20'
          } shrink-0`}>
            <AlertTriangle 
              size={20} 
              className={isExpiringSoon ? 'text-red-400' : 'text-amber-400'} 
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] md:text-[12px] font-black uppercase tracking-wider text-white mb-1">
              {isExpiringSoon 
                ? `⚠️ Pro Expires in ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'Day' : 'Days'}!`
                : `Pro Expires in ${daysUntilExpiry} Days`
              }
            </h3>
            <p className="text-[9px] md:text-[10px] text-gray-300 mb-3">
              Your Pro subscription will expire soon. Renew now to continue enjoying all premium features.
            </p>
            <Link
              href="/pro"
              className="inline-block bg-blue-600 px-4 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest hover:bg-blue-500 transition-all"
            >
              Renew Pro Subscription
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

