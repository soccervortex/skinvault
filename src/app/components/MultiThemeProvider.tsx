"use client";

import { useEffect, useState, useCallback } from 'react';
import { ThemeType } from '@/app/utils/theme-storage';
import ThemeParticles from './ThemeParticles';
import PromoManager from './PromoManager';

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
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    
    // Clear any existing theme classes first
    updateBodyClass(null);
    
    const loadActiveTheme = async () => {
      try {
        const url = `/api/themes/active${steamId ? `?steamId=${steamId}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
          setActiveTheme(null);
          updateBodyClass(null);
          return;
        }
        
        const data = await response.json();
        let theme = data.theme || null;
        
        // For non-logged-in users, check localStorage
        if (theme && !steamId && typeof window !== 'undefined') {
          const userDisabled = localStorage.getItem('sv_theme_disabled') === 'true';
          if (userDisabled) {
            theme = null;
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
      loadActiveTheme();
    };

    window.addEventListener('themeChanged', handleThemeChange);
    
    // Listen for storage changes (for localStorage updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sv_theme_disabled') {
        loadActiveTheme();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also poll periodically to catch admin changes (every 3 seconds)
    const interval = setInterval(loadActiveTheme, 3000);
    
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
      <PromoManager theme={activeTheme} steamId={steamId} />
    </>
  );
}

