"use client";

import { useEffect, useState } from 'react';
import { ThemeType } from '@/app/utils/theme-storage';
import ThemeParticles from './ThemeParticles';

export default function MultiThemeProvider({ steamId }: { steamId?: string | null }) {
  const [activeTheme, setActiveTheme] = useState<ThemeType | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const loadActiveTheme = async () => {
      try {
        const response = await fetch(`/api/themes/active?steamId=${steamId || ''}`);
        const data = await response.json();
        if (response.ok) {
          setActiveTheme(data.theme);
          updateBodyClass(data.theme);
        }
      } catch (error) {
        console.error('Failed to load active theme:', error);
      }
    };

    loadActiveTheme();

    // Listen for theme changes
    const handleThemeChange = () => {
      loadActiveTheme();
    };

    window.addEventListener('themeChanged', handleThemeChange);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
    };
  }, [steamId]);

  const updateBodyClass = (theme: ThemeType | null) => {
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
  };

  useEffect(() => {
    if (activeTheme) {
      updateBodyClass(activeTheme);
    }
  }, [activeTheme]);

  // Don't render particles until mounted to avoid hydration issues
  if (!mounted || !activeTheme) return null;

  return <ThemeParticles theme={activeTheme} />;
}

