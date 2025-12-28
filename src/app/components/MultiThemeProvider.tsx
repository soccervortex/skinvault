"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { ThemeType } from '@/app/utils/theme-storage';
import ThemeParticles from './ThemeParticles';
import ThemeGift from './ThemeGift';
import { getPusherClient } from '@/app/utils/pusher-client';

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
        const url = `/api/themes/active${steamId ? `?steamId=${steamId}&_t=${timestamp}` : `?_t=${timestamp}`}`;
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
      // Immediate reload, then retry after delay to ensure database write has propagated
      loadActiveTheme();
      setTimeout(() => {
        loadActiveTheme();
      }, 600);
      setTimeout(() => {
        loadActiveTheme();
      }, 1200);
    };

    window.addEventListener('themeChanged', handleThemeChange);
    
    // Listen for storage changes (for cross-tab communication)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sv_theme_disabled' || e.key === 'sv_theme_force_reload' || e.key === 'sv_theme_changed') {
        // Immediate reload when theme changes in another tab
        setTimeout(() => {
          loadActiveTheme();
        }, 100);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for same-tab localStorage changes (using a custom event)
    const handleLocalStorageChange = () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const changed = window.localStorage.getItem('sv_theme_changed');
          if (changed) {
            setTimeout(() => {
              loadActiveTheme();
            }, 100);
          }
        } catch {
          // Ignore errors
        }
      }
    };
    
    // Listen for custom storage event (for same-tab changes)
    window.addEventListener('localStorageChange', handleLocalStorageChange);
    
    // Listen to Pusher for real-time theme changes from admin
    let pusherChannel: any = null;
    let pusherSubscription: any = null;
    
    try {
      const pusher = getPusherClient();
      if (pusher) {
        pusherChannel = pusher.subscribe('global');
        
        pusherSubscription = pusherChannel.bind('theme_changed', (data: any) => {
          // Immediately update theme when admin changes it
          if (data && data.type === 'theme_changed') {
            let newTheme: ThemeType | null = data.theme || null;
            
            // If admin disabled all themes (newTheme is null), apply immediately for everyone
            if (!newTheme) {
              setActiveTheme(null);
              updateBodyClass(null);
              return;
            }
            
            // If a theme is enabled, check user preferences
            // For non-logged-in users, check localStorage preference
            if (!steamId && typeof window !== 'undefined') {
              try {
                const testKey = '__localStorage_test__';
                window.localStorage.setItem(testKey, 'test');
                window.localStorage.removeItem(testKey);
                
                const userDisabled = window.localStorage.getItem('sv_theme_disabled') === 'true';
                if (userDisabled) {
                  newTheme = null;
                }
              } catch {
                // Ignore localStorage errors
              }
            }
            
            // For logged-in users, reload to check their preference
            // For non-logged-in users, apply directly if not disabled
            if (steamId) {
              // Reload to check user preference
              loadActiveTheme();
            } else {
              // Directly update theme (already checked localStorage above)
              setActiveTheme(newTheme);
              updateBodyClass(newTheme);
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to subscribe to Pusher theme channel:', error);
    }
    
    // Also poll periodically as fallback (every 3 seconds - reduced since Pusher handles real-time)
    const interval = setInterval(loadActiveTheme, 3000);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleLocalStorageChange);
      clearInterval(interval);
      
      // Cleanup Pusher subscription
      if (pusherSubscription && pusherChannel) {
        try {
          pusherChannel.unbind('theme_changed', pusherSubscription);
        } catch (error) {
          console.error('Failed to unbind Pusher theme subscription:', error);
        }
      }
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

