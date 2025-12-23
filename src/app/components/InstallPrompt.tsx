"use client";

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'installPromptDismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // Check if dismissed on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const dismissed = window.localStorage.getItem(DISMISS_KEY);
        if (dismissed === 'true') {
          return; // Don't show if dismissed
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if dismissed before showing
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const dismissed = window.localStorage.getItem(DISMISS_KEY);
        if (dismissed === 'true') {
          return; // Don't show if dismissed
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    const handler = (e: Event) => {
      e.preventDefault();
      
      // Check again before setting prompt (user might have dismissed while waiting)
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const dismissed = window.localStorage.getItem(DISMISS_KEY);
          if (dismissed === 'true') {
            return; // Don't set prompt if dismissed
          }
        }
      } catch {
        // Ignore localStorage errors
      }
      
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay (better UX)
      setTimeout(() => {
        // Final check before showing
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const dismissed = window.localStorage.getItem(DISMISS_KEY);
            if (dismissed !== 'true') {
              setShowPrompt(true);
            }
          } else {
            setShowPrompt(true);
          }
        } catch {
          setShowPrompt(true);
        }
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowPrompt(false);
        setDeferredPrompt(null);
        // Mark as dismissed even if installed (to prevent showing again)
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(DISMISS_KEY, 'true');
          }
        } catch {
          // Ignore localStorage errors
        }
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store dismissal in localStorage so it persists across sessions
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(DISMISS_KEY, 'true');
      }
    } catch {
      // Ignore localStorage errors
    }
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-[#11141d] border border-blue-500/40 rounded-2xl p-4 md:p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/40 shrink-0">
            <Download className="text-blue-400" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm md:text-base font-black uppercase tracking-tighter mb-1">
              Install SkinVaults
            </h3>
            <p className="text-[10px] md:text-[11px] text-gray-400 mb-3">
              Install as an app for faster access and a better experience
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 text-gray-500 hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
