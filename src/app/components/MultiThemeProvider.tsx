"use client";

import { useEffect, useState, useCallback } from 'react';
import { ThemeType } from '@/app/utils/theme-storage';
import ThemeParticles from './ThemeParticles';
import ThemeGift from './ThemeGift';

export default function MultiThemeProvider({ steamId }: { steamId?: string | null }) {
  const [activeTheme, setActiveTheme] = useState<ThemeType | null>(null);
  const [mounted, setMounted] = useState(false);

  const updateBodyClass = useCallback((theme: ThemeType | null) => {
    if (typeof document === 'undefined') return;
    
    // Remove all theme classes
    document.body.classList.remove(
      'christmas-theme',
      'halloween-theme',
      'easter-theme',
      'sinterklaas-theme',
      'newyear-theme',
      'oldyear-theme'
    );
    
    // Add active theme class
    if (theme) {
      document.body.classList.add(`${theme}-theme`);
    } else {
      // When theme is disabled, clear theme promo and gift data so it can be used next year
      if (typeof window !== 'undefined') {
        try {
          // Test localStorage accessibility first
          const testKey = '__localStorage_test__';
          window.localStorage.setItem(testKey, 'test');
          window.localStorage.removeItem(testKey);
          
          const promoKeys = Object.keys(window.localStorage).filter(key => 
            key.startsWith('sv_christmas_promo_claimed_') || 
            key.startsWith('sv_christmas_gift_claimed_') ||
            key.startsWith('sv_christmas_rewards_') ||
            key.startsWith('sv_theme_rewards_') ||
            key.match(/sv_(christmas|halloween|easter|sinterklaas|newyear|oldyear)_(gift_claimed|rewards)_\d{4}/)
          );
          promoKeys.forEach(key => {
            try {
              window.localStorage.removeItem(key);
            } catch {
              // Skip if removal fails
            }
          });
        } catch {
          // Ignore localStorage errors
        }
      }
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    
    // Clear any existing theme classes first
    updateBodyClass(null);
    
    const loadActiveTheme = async () => {
      try {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = Date.now();
        const url = `/api/themes/active${steamId ? `?steamId=${steamId}` : ''}&_t=${timestamp}`;
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (!response.ok) {
          setActiveTheme(null);
          updateBodyClass(null);
          return;
        }
        
        const data = await response.json();
        let theme = data.theme || null;
        
        // For non-logged-in users, check localStorage
        if (theme && !steamId && typeof window !== 'undefined') {
          try {
            // Test localStorage accessibility first
            const testKey = '__localStorage_test__';
            window.localStorage.setItem(testKey, 'test');
            window.localStorage.removeItem(testKey);
            
            const userDisabled = window.localStorage.getItem('sv_theme_disabled') === 'true';
            if (userDisabled) {
              theme = null;
            }
          } catch {
            // Ignore localStorage errors - assume theme is enabled
          }
        }
        
        setActiveTheme(theme);
        updateBodyClass(theme);
      } catch (error) {
        console.error('Failed to load active theme:', error);
        setActiveTheme(null);
        updateBodyClass(null);
      }
    };

    // Load immediately
    loadActiveTheme();

    // Listen for theme changes
    const handleThemeChange = () => {
      // Small delay to ensure database write has propagated
      setTimeout(() => {
        loadActiveTheme();
      }, 400);
    };

    window.addEventListener('themeChanged', handleThemeChange);
    
    // Listen for storage changes (for localStorage updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sv_theme_disabled' || e.key === 'sv_theme_force_reload') {
        loadActiveTheme();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also poll periodically to catch admin changes (every 2 seconds for faster updates)
    const interval = setInterval(loadActiveTheme, 2000);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [steamId, updateBodyClass]);

  useEffect(() => {
    if (activeTheme !== null) {
      updateBodyClass(activeTheme);
    }
  }, [activeTheme, updateBodyClass]);

  // Don't render particles until mounted to avoid hydration issues
  if (!mounted || !activeTheme) return null;

  return (
    <>
      <ThemeParticles theme={activeTheme} />
      {activeTheme && <ThemeGift theme={activeTheme} steamId={steamId} />}
    </>
  );
}

