"use client";

import { useEffect, useState } from 'react';
import { ThemeType } from '@/app/utils/theme-storage';
import ChristmasPromo from './ChristmasPromo';

interface PromoManagerProps {
  theme: ThemeType | null;
  steamId?: string | null;
}

export default function PromoManager({ theme, steamId }: PromoManagerProps) {
  const [showPromo, setShowPromo] = useState(false);
  const [promoShown, setPromoShown] = useState(false);

  useEffect(() => {
    if (!theme || promoShown) return;

    const checkPromo = async () => {
      try {
        // Get or create anonymous ID for non-logged-in users
        let anonId: string | undefined;
        if (!steamId && typeof window !== 'undefined') {
          anonId = localStorage.getItem('sv_anon_id') || undefined;
          if (!anonId) {
            anonId = 'anon_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('sv_anon_id', anonId);
          }
        }

        const url = `/api/promo/status?theme=${theme}${steamId ? `&steamId=${steamId}` : ''}${anonId ? `&anonId=${anonId}` : ''}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.shouldShow) {
            setShowPromo(true);
            setPromoShown(true);
            // Mark as seen
            await fetch('/api/promo/seen', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ theme, steamId, anonId }),
            });
          }
        }
      } catch (error) {
        console.error('Failed to check promo status:', error);
      }
    };

    checkPromo();
  }, [theme, steamId, promoShown]);

  const handleDismiss = async () => {
    setShowPromo(false);
    try {
      let anonId: string | undefined;
      if (!steamId && typeof window !== 'undefined') {
        anonId = localStorage.getItem('sv_anon_id') || undefined;
      }
      await fetch('/api/promo/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, steamId, anonId }),
      });
    } catch (error) {
      console.error('Failed to dismiss promo:', error);
    }
  };

  const handleClaim = async () => {
    setShowPromo(false);
    try {
      let anonId: string | undefined;
      if (!steamId && typeof window !== 'undefined') {
        anonId = localStorage.getItem('sv_anon_id') || undefined;
      }
      await fetch('/api/promo/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, steamId, anonId }),
      });
    } catch (error) {
      console.error('Failed to claim promo:', error);
    }
  };

  if (!showPromo || !theme) return null;

  // Render theme-specific promo
  if (theme === 'christmas') {
    return <ChristmasPromo steamId={steamId} onDismiss={handleDismiss} onClaim={handleClaim} />;
  }

  // Add other theme promos here
  return null;
}

