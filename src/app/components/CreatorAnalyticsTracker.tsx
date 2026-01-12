'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function getSteamIdFromLocalStorage(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem('steam_user');
    const json = raw ? JSON.parse(raw) : null;
    const steamId = String(json?.steamId || '').trim();
    return /^\d{17}$/.test(steamId) ? steamId : null;
  } catch {
    return null;
  }
}

export default function CreatorAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSentRef = useRef<string>('');

  useEffect(() => {
    const qs = searchParams?.toString() || '';
    const key = `${pathname}?${qs}`;
    if (lastSentRef.current === key) return;
    lastSentRef.current = key;

    const steamId = getSteamIdFromLocalStorage();

    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'page_view',
        path: key,
        steamId,
        title: typeof document !== 'undefined' ? document.title : undefined,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, searchParams]);

  return null;
}
