"use client";

import { useEffect, useState } from 'react';
import MultiThemeProvider from './MultiThemeProvider';

export default function ThemeProviderWrapper() {
  const [steamId, setSteamId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkUser = () => {
      try {
        if (typeof window === 'undefined') return;
        // Test localStorage accessibility first
        const testKey = '__localStorage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
        
        const storedUser = window.localStorage.getItem('steam_user');
        const user = storedUser ? JSON.parse(storedUser) : null;
        setSteamId(user?.steamId || null);
      } catch {
        // Ignore localStorage errors
        setSteamId(null);
      }
    };

    checkUser();
    window.addEventListener('storage', checkUser);
    
    // Also check on mount
    const interval = setInterval(checkUser, 1000);
    
    return () => {
      window.removeEventListener('storage', checkUser);
      clearInterval(interval);
    };
  }, []);

  return <MultiThemeProvider steamId={steamId} />;
}

