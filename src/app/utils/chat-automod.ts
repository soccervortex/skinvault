export type ChatAutomodSettings = {
  enabled: boolean;
  blockLinks: boolean;
  allowLinkDomains: string[];
  bannedWords: string[];
  bannedRegex: string[];
};

export const DEFAULT_CHAT_AUTOMOD_SETTINGS: ChatAutomodSettings = {
  enabled: false,
  blockLinks: false,
  allowLinkDomains: [],
  bannedWords: [],
  bannedRegex: [],
};

export type AutomodDecision = {
  allowed: boolean;
  reason: string | null;
};

function normalizeDomain(value: string): string {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  return v.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || '';
}

function extractUrls(text: string): string[] {
  const s = String(text || '');
  if (!s) return [];
  const matches = s.match(/\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/gi);
  return matches ? matches.map((m) => String(m).trim()).filter(Boolean) : [];
}

function urlHostname(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const withProto = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  try {
    return new URL(withProto).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    const noProto = raw.replace(/^www\./, '').toLowerCase();
    return noProto.split('/')[0] || '';
  }
}

export function coerceChatAutomodSettings(input: any): ChatAutomodSettings {
  const obj = (typeof input === 'object' && input) ? input : {};
  const allowLinkDomains = Array.isArray(obj.allowLinkDomains) ? obj.allowLinkDomains : [];
  const bannedWords = Array.isArray(obj.bannedWords) ? obj.bannedWords : [];
  const bannedRegex = Array.isArray(obj.bannedRegex) ? obj.bannedRegex : [];

  return {
    enabled: !!obj.enabled,
    blockLinks: !!obj.blockLinks,
    allowLinkDomains: allowLinkDomains.map((d: any) => normalizeDomain(String(d || ''))).filter(Boolean).slice(0, 200),
    bannedWords: bannedWords.map((w: any) => String(w || '').trim()).filter(Boolean).slice(0, 500),
    bannedRegex: bannedRegex.map((r: any) => String(r || '').trim()).filter(Boolean).slice(0, 200),
  };
}

export function checkAutomod(text: string, settings: ChatAutomodSettings): AutomodDecision {
  const s = String(text || '');
  const normalized = s.toLowerCase();

  if (!settings?.enabled) return { allowed: true, reason: null };

  if (settings.blockLinks) {
    const urls = extractUrls(s);
    if (urls.length) {
      const allow = new Set((settings.allowLinkDomains || []).map(normalizeDomain).filter(Boolean));
      for (const u of urls) {
        const host = urlHostname(u);
        if (!host) continue;
        if (!allow.has(host)) {
          return { allowed: false, reason: 'Links are not allowed' };
        }
      }
    }
  }

  for (const word of settings.bannedWords || []) {
    const w = String(word || '').trim().toLowerCase();
    if (!w) continue;
    if (normalized.includes(w)) {
      return { allowed: false, reason: 'Message contains a banned word' };
    }
  }

  for (const pattern of settings.bannedRegex || []) {
    const p = String(pattern || '').trim();
    if (!p) continue;
    try {
      const re = new RegExp(p, 'i');
      if (re.test(s)) {
        return { allowed: false, reason: 'Message matches a blocked pattern' };
      }
    } catch {
    }
  }

  return { allowed: true, reason: null };
}
