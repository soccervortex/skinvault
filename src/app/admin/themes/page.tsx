"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { ThemeType } from '@/app/utils/theme-storage';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Shield, Sparkles } from 'lucide-react';

export default function AdminThemesPage() {
  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [themeSettings, setThemeSettings] = useState<Record<ThemeType, { enabled: boolean }>>({
    christmas: { enabled: false },
    halloween: { enabled: false },
    easter: { enabled: false },
    sinterklaas: { enabled: false },
    newyear: { enabled: false },
    oldyear: { enabled: false },
  });
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [themeMessage, setThemeMessage] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const themeLabels: Record<ThemeType, string> = {
    christmas: 'Kerst (Christmas)',
    halloween: 'Halloween',
    easter: 'Pasen (Easter)',
    sinterklaas: 'Sinterklaas',
    newyear: 'Nieuwjaar (New Year)',
    oldyear: 'Oudjaar (Old Year)',
  };

  const loadThemes = async () => {
    setLoadingThemes(true);
    try {
      const timestamp = Date.now();
      const res = await fetch(`/api/admin/themes?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setThemeSettings(data as any);
      }
    } catch (e: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load themes:', e);
      }
    } finally {
      setLoadingThemes(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void loadThemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const handleThemeToggle = async (theme: ThemeType, enabled: boolean) => {
    setThemeMessage(null);
    setThemeError(null);

    try {
      const res = await fetch('/api/admin/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ theme, enabled }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setThemeError(String((data as any)?.error || 'Failed to update theme.'));
        return;
      }

      setThemeSettings((data as any)?.settings || themeSettings);
      setThemeMessage(`${theme} theme ${enabled ? 'enabled' : 'disabled'}`);
      setTimeout(() => setThemeMessage(null), 3000);

      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('themeChanged'));
          const reloadKey = 'sv_theme_force_reload';
          const timestamp = Date.now().toString();
          window.localStorage.setItem(reloadKey, timestamp);
          window.localStorage.setItem('sv_theme_changed', `${theme}:${enabled}:${timestamp}`);
          window.dispatchEvent(new CustomEvent('localStorageChange'));
        }
      } catch {
      }
    } catch (e: any) {
      setThemeError(String(e?.message || 'Request failed.'));
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Sign in first.</div>
      </div>
    );
  }

  if (!userIsOwner) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Access denied.</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 pb-24">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>

          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Owner</p>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Themes</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Enable or disable holiday themes.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl md:rounded-2xl bg-purple-500/10 border border-purple-500/40 shrink-0">
                  <Sparkles className="text-purple-400" size={16} />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Theme Management</p>
                  <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Holiday Themes</h2>
                </div>
              </div>
              <button
                onClick={() => void loadThemes()}
                className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-black uppercase"
              >
                Refresh
              </button>
            </div>

            <p className="text-[10px] md:text-[11px] text-gray-400 mb-6">
              Enable or disable holiday themes. When enabled, themes are <span className="text-purple-400 font-bold">ON by default</span> for all users, but users can turn them off in their profile.
            </p>

            {themeMessage ? (
              <div className="mb-4 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
                <CheckCircle2 size={12} /> <span>{themeMessage}</span>
              </div>
            ) : null}
            {themeError ? (
              <div className="mb-4 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                <AlertTriangle size={12} /> <span>{themeError}</span>
              </div>
            ) : null}

            {loadingThemes ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading themes...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(themeLabels) as ThemeType[]).map((theme) => (
                  <div
                    key={theme}
                    className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 flex items-center justify-between"
                  >
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">{themeLabels[theme]}</span>
                    <button
                      onClick={() => handleThemeToggle(theme, !themeSettings[theme]?.enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${themeSettings[theme]?.enabled ? 'bg-purple-600' : 'bg-gray-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${themeSettings[theme]?.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
