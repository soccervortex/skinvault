"use client";

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay (better UX)
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('installPromptDismissed', 'true');
    }
  };

  // Don't show if dismissed in this session
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('installPromptDismissed')) {
      setShowPrompt(false);
    }
  }, []);

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
              Install SkinVault
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
