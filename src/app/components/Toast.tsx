"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 5000) => {
      const id = Math.random().toString(36).substring(7);
      const newToast: Toast = { id, message, type, duration };
      
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  // Check for persisted banned notification on mount and page navigation
  useEffect(() => {
    const checkBannedNotification = () => {
      try {
        if (typeof window === 'undefined') return;
        
        const stored = window.localStorage.getItem('sv_banned_notification');
        if (!stored) return;

        const notification = JSON.parse(stored);
        const now = Date.now();
        const elapsed = now - notification.timestamp;
        const remaining = Math.max(0, notification.duration - elapsed);

        if (remaining > 0) {
          // Show the notification for the remaining time
          showToast(notification.message, 'error', remaining);
          
          // Clear the localStorage after the remaining time
          setTimeout(() => {
            try {
              window.localStorage.removeItem('sv_banned_notification');
            } catch {}
          }, remaining);
        } else {
          // Notification expired, remove it
          window.localStorage.removeItem('sv_banned_notification');
        }
      } catch (error) {
        // Ignore errors (invalid JSON, localStorage issues, etc.)
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('sv_banned_notification');
          }
        } catch {}
      }
    };

    // Check immediately on mount
    checkBannedNotification();

    // Also check on storage events (when localStorage changes from other tabs/pages)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sv_banned_notification') {
        checkBannedNotification();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Check periodically in case the notification was set in the same tab
    const interval = setInterval(checkBannedNotification, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [showToast]);

  const success = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration || 7000); // Errors stay longer
  }, [showToast]);

  const info = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-400" />,
    error: <AlertCircle size={18} className="text-red-400" />,
    info: <Info size={18} className="text-blue-400" />,
    warning: <AlertTriangle size={18} className="text-amber-400" />,
  };

  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/30',
    error: 'bg-red-500/10 border-red-500/30',
    info: 'bg-blue-500/10 border-blue-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
  };

  return (
    <div
      className={`
        ${colors[toast.type]}
        border rounded-[1.5rem] p-4 shadow-2xl backdrop-blur-xl
        pointer-events-auto
        transform transition-all duration-300
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
        <p className="flex-1 text-[10px] md:text-[11px] font-black uppercase tracking-wider text-white">
          {toast.message}
        </p>
        <button
          onClick={handleRemove}
          className="shrink-0 text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Close notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

