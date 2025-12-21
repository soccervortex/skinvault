"use client";

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useToast } from './Toast';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        toast.success('Connection restored!');
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      toast.warning('You are offline. Some features may not work.');
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline, toast]);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9997] bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center gap-2 shadow-2xl backdrop-blur-xl">
      <WifiOff size={16} className="text-amber-400" />
      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
        Offline
      </span>
    </div>
  );
}

