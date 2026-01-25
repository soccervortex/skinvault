"use client";

import React, { useEffect, useRef } from 'react';

type RuntimePlugin = {
  id: string;
  slug: string;
  type: 'tawkto' | 'external_script' | 'inline_script';
  config?: Record<string, any>;
};

const inlineObservers = new Map<string, MutationObserver>();

function safeString(v: any): string {
  return String(v ?? '').trim();
}

function ensureTawkHiddenStyle() {
  try {
    const id = 'plugin-tawk-hidden-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.setAttribute('data-plugin-managed', '1');
    style.textContent = `
[id^="tawk"],
[class*="tawk"],
iframe[src*="tawk"],
iframe[name^="tawk"],
iframe[title*="Tawk"],
iframe[title*="tawk"] {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
`;
    document.head.appendChild(style);
  } catch {
  }
}

function removeTawkHiddenStyle() {
  try {
    const el = document.getElementById('plugin-tawk-hidden-style');
    if (el) el.parentNode?.removeChild(el);
  } catch {
  }
}

function removeTawkArtifacts() {
  try {
    try {
      const api = (window as any).Tawk_API;
      if (api?.hideWidget) api.hideWidget();
      if (api?.minimize) api.minimize();
    } catch {
    }

    const scripts = Array.from(document.querySelectorAll('script'));
    for (const s of scripts) {
      const src = safeString((s as HTMLScriptElement).src);
      if (src.includes('embed.tawk.to')) {
        s.parentNode?.removeChild(s);
      }
    }

    try {
      document.getElementById('plugin-tawk')?.parentNode?.removeChild(document.getElementById('plugin-tawk') as any);
      document.getElementById('tawkto')?.parentNode?.removeChild(document.getElementById('tawkto') as any);
    } catch {
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

    ensureTawkHiddenStyle();
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

function removeInlinePlugin(slug: string) {
  try {
    try {
      const obs = inlineObservers.get(slug);
      if (obs) obs.disconnect();
      inlineObservers.delete(slug);
    } catch {
    }

    const id = `plugin-inline-${slug}`;
    const el = document.getElementById(id);
    if (el) el.parentNode?.removeChild(el);

    const scripts = Array.from(document.querySelectorAll(`script[data-plugin-inline="${CSS.escape(slug)}"]`));
    for (const s of scripts) {
      s.parentNode?.removeChild(s);
    }

    const iframes = Array.from(document.querySelectorAll(`iframe[data-plugin-inline="${CSS.escape(slug)}"]`));
    for (const f of iframes) {
      f.parentNode?.removeChild(f);
    }
  } catch {
  }
}

function ensureInlinePlugin(slug: string, html: string) {
  const cleanSlug = safeString(slug);
  const cleanHtml = String(html || '').trim();
  if (!cleanSlug) return;

  if (!cleanHtml) {
    removeInlinePlugin(cleanSlug);
    return;
  }

  try {
    const id = `plugin-inline-${cleanSlug}`;
    const existing = document.getElementById(id);
    const existingHash = safeString(existing?.getAttribute('data-inline-hash'));
    const nextHash = `${cleanHtml.length}:${cleanHtml.slice(0, 32)}:${cleanHtml.slice(-32)}`;

    if (existing && existingHash === nextHash) {
      return;
    }

    removeInlinePlugin(cleanSlug);

    try {
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          const nodes = Array.from(m.addedNodes || []);
          for (const n of nodes) {
            const el = n as any;
            const tag = safeString(el?.tagName || '').toLowerCase();
            if (tag === 'script' || tag === 'iframe') {
              try {
                el.setAttribute('data-plugin-managed', '1');
                el.setAttribute('data-plugin-inline', cleanSlug);
              } catch {
              }
            }
          }
        }
      });

      obs.observe(document.documentElement, { childList: true, subtree: true });
      inlineObservers.set(cleanSlug, obs);

      window.setTimeout(() => {
        try {
          const current = inlineObservers.get(cleanSlug);
          if (current === obs) {
            obs.disconnect();
            inlineObservers.delete(cleanSlug);
          }
        } catch {
        }
      }, 10000);
    } catch {
    }

    const tmp = document.createElement('div');
    tmp.innerHTML = cleanHtml;

    const scripts = Array.from(tmp.querySelectorAll('script'));
    for (const s of scripts) {
      const ns = document.createElement('script');
      const src = safeString((s as HTMLScriptElement).src);

      if (src) {
        ns.src = src;
        ns.async = (s as HTMLScriptElement).async;
      } else {
        ns.text = (s as HTMLScriptElement).text || s.textContent || '';
      }

      const type = safeString((s as HTMLScriptElement).type);
      if (type) ns.type = type;

      ns.setAttribute('data-plugin-managed', '1');
      ns.setAttribute('data-plugin-inline', cleanSlug);

      document.body.appendChild(ns);
      s.parentNode?.removeChild(s);
    }

    const container = document.createElement('div');
    container.id = id;
    container.setAttribute('data-plugin-managed', '1');
    container.setAttribute('data-inline-hash', nextHash);
    container.appendChild(tmp);
    document.body.appendChild(container);
  } catch {
  }
}

function removeManagedInlinePlugins(allowed: Set<string>) {
  try {
    const nodes = Array.from(document.querySelectorAll('div[id^="plugin-inline-"]'));
    for (const n of nodes) {
      const id = safeString((n as any)?.id || '');
      const slug = id.startsWith('plugin-inline-') ? id.slice('plugin-inline-'.length) : '';
      if (slug && !allowed.has(slug)) {
        removeInlinePlugin(slug);
      }
    }
  } catch {
  }
}

function ensureTawk(embedUrl: string) {
  const url = safeString(embedUrl);
  if (!url) return;

  removeTawkHiddenStyle();

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

    const inline = plugins
      .filter((p) => p && p.type === 'inline_script')
      .map((p) => ({ id: safeString(p.slug || p.id), html: String(p?.config?.html || '') }))
      .filter((p) => !!p.id);

    const allowed = new Set<string>(external.map((p) => p.id));

    for (const p of external) {
      ensureExternalScript(p.id, p.src);
    }

    removeManagedExternalScripts(allowed);

    const allowedInline = new Set<string>(inline.map((p) => p.id));
    for (const p of inline) {
      ensureInlinePlugin(p.id, p.html);
    }
    removeManagedInlinePlugins(allowedInline);

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
