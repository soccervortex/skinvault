"use client";

import React, { useEffect, useRef } from 'react';

type RuntimePlugin = {
  id: string;
  slug: string;
  type: 'tawkto' | 'external_script';
  config?: Record<string, any>;
};

function safeString(v: any): string {
  return String(v ?? '').trim();
}

function removeTawkArtifacts() {
  try {
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const s of scripts) {
      const src = safeString((s as HTMLScriptElement).src);
      if (src.includes('embed.tawk.to')) {
        s.parentNode?.removeChild(s);
      }
    }

    const ids = [
      'tawkchat-minified-wrapper',
      'tawkchat-maximized-wrapper',
      'tawkchat-container',
      'tawkchat-bubble',
      'tawkchat-widget',
      'tawkchat',
    ];

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.parentNode?.removeChild(el);
    }

    const iframes = Array.from(document.querySelectorAll('iframe'));
    for (const f of iframes) {
      const src = safeString((f as HTMLIFrameElement).src);
      if (src.includes('tawk.to')) {
        f.parentNode?.removeChild(f);
      }
    }

    const wrappers = Array.from(document.querySelectorAll('[id^="tawk"], [class*="tawk"]'));
    for (const el of wrappers) {
      const tag = safeString((el as any)?.tagName || '').toLowerCase();
      if (tag === 'script') continue;
      try {
        el.parentNode?.removeChild(el);
      } catch {
      }
    }

    try {
      (window as any).Tawk_API = undefined;
      (window as any).Tawk_LoadStart = undefined;
    } catch {
    }
  } catch {
  }
}

function ensureExternalScript(id: string, src: string) {
  const scriptId = `plugin-script-${id}`;
  const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (existing && safeString(existing.src) === src) return;

  if (existing) {
    existing.parentNode?.removeChild(existing);
  }

  const s = document.createElement('script');
  s.id = scriptId;
  s.src = src;
  s.async = true;
  s.setAttribute('data-plugin-managed', '1');
  document.body.appendChild(s);
}

function removeManagedExternalScripts(allowedIds: Set<string>) {
  const scripts = Array.from(document.querySelectorAll('script[data-plugin-managed="1"]'));
  for (const s of scripts) {
    const id = safeString((s as any)?.id || '');
    if (!id.startsWith('plugin-script-')) continue;
    const slug = id.slice('plugin-script-'.length);
    if (!allowedIds.has(slug)) {
      s.parentNode?.removeChild(s);
    }
  }
}

function ensureTawk(embedUrl: string) {
  const url = safeString(embedUrl);
  if (!url) return;

  try {
    (window as any).Tawk_API = (window as any).Tawk_API || {};
    (window as any).Tawk_LoadStart = new Date();
  } catch {
  }

  const existing = Array.from(document.querySelectorAll('script')).find((s) => safeString((s as HTMLScriptElement).src) === url);
  if (existing) return;

  const s = document.createElement('script');
  s.id = 'plugin-tawk';
  s.src = url;
  s.async = true;
  s.charset = 'UTF-8';
  s.setAttribute('crossorigin', '*');
  s.setAttribute('data-plugin-managed', '1');
  document.body.appendChild(s);
}

async function fetchEnabledPlugins(): Promise<RuntimePlugin[]> {
  const res = await fetch(`/api/plugins/enabled?_t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const plugins = Array.isArray((data as any)?.plugins) ? (data as any).plugins : [];
  return plugins as RuntimePlugin[];
}

export default function PluginRuntimeLoader() {
  const lastJsonRef = useRef<string>('');
  const loadingRef = useRef(false);

  const applyPlugins = (plugins: RuntimePlugin[]) => {
    const external = plugins
      .filter((p) => p && p.type === 'external_script')
      .map((p) => ({ id: safeString(p.slug || p.id), src: safeString(p?.config?.src) }))
      .filter((p) => !!p.id && !!p.src);

    const allowed = new Set<string>(external.map((p) => p.id));

    for (const p of external) {
      ensureExternalScript(p.id, p.src);
    }

    removeManagedExternalScripts(allowed);

    const tawk = plugins.find((p) => p && p.type === 'tawkto' && safeString(p.slug || p.id) === 'tawk');
    const tawkUrl = safeString((tawk as any)?.config?.embedUrl);

    if (tawkUrl) {
      ensureTawk(tawkUrl);
    } else {
      removeTawkArtifacts();
    }
  };

  const refresh = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const plugins = await fetchEnabledPlugins();
      const json = JSON.stringify(plugins);
      if (json !== lastJsonRef.current) {
        lastJsonRef.current = json;
        applyPlugins(plugins);
      }
    } catch {
    } finally {
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    void refresh();

    const onPluginsChanged = () => {
      void refresh();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'sv_plugins_changed') {
        void refresh();
      }
    };

    window.addEventListener('pluginsChanged', onPluginsChanged as any);
    window.addEventListener('storage', onStorage);

    const interval = window.setInterval(() => {
      void refresh();
    }, 30000);

    return () => {
      window.removeEventListener('pluginsChanged', onPluginsChanged as any);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
