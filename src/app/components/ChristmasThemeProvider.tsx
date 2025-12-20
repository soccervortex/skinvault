"use client";

import { useEffect, useState } from 'react';
import { isChristmasThemeEnabled } from '@/app/utils/christmas-theme';
import ChristmasSnow from './ChristmasSnow';

export default function ChristmasThemeProvider() {
  const [enabled, setEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check initial state
    setEnabled(isChristmasThemeEnabled());
    
    // Listen for theme changes
    const handleThemeChange = (e: CustomEvent) => {
      setEnabled(e.detail);
      // Update body class
      if (e.detail) {
        document.body.classList.add('christmas-theme');
      } else {
        document.body.classList.remove('christmas-theme');
      }
    };

    window.addEventListener('christmasThemeChange', handleThemeChange as EventListener);
    
    // Initial class setup
    if (isChristmasThemeEnabled()) {
      document.body.classList.add('christmas-theme');
    }
    
    return () => {
      window.removeEventListener('christmasThemeChange', handleThemeChange as EventListener);
    };
  }, []);

  // Don't render snow until mounted to avoid hydration issues
  if (!mounted) return null;

  return enabled ? <ChristmasSnow /> : null;
}

