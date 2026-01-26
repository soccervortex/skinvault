export type CurrencyMeta = {
  code: string;
  iso: string;
  locale: string;
  symbol: string;
};

export const STEAM_CURRENCY_TO_ISO: Record<string, string> = {
  '1': 'USD',
  '2': 'GBP',
  '3': 'EUR',
  '5': 'RUB',
  '6': 'PLN',
  '7': 'BRL',
  '8': 'JPY',
  '9': 'NOK',
  '10': 'IDR',
  '11': 'MYR',
  '12': 'PHP',
  '13': 'SGD',
  '14': 'THB',
  '15': 'VND',
  '16': 'KRW',
  '17': 'TRY',
  '18': 'UAH',
  '19': 'MXN',
  '20': 'CAD',
  '21': 'AUD',
  '22': 'NZD',
  '23': 'CNY',
  '24': 'INR',
  '29': 'HKD',
  '30': 'TWD',
  '33': 'SEK',
  '35': 'ILS',
  '28': 'ZAR',
};

export const ISO_TO_STEAM_CURRENCY: Record<string, string> = {
  USD: '1',
  GBP: '2',
  EUR: '3',
  RUB: '5',
  PLN: '6',
  BRL: '7',
  JPY: '8',
  NOK: '9',
  IDR: '10',
  MYR: '11',
  PHP: '12',
  SGD: '13',
  THB: '14',
  VND: '15',
  KRW: '16',
  TRY: '17',
  UAH: '18',
  MXN: '19',
  CAD: '20',
  AUD: '21',
  NZD: '22',
  CNY: '23',
  INR: '24',
  HKD: '29',
  TWD: '30',
  SEK: '33',
  ILS: '35',
  ZAR: '28',
};

function inferLocaleFromISO(iso: string): string {
  const c = String(iso || '').toUpperCase();
  if (c === 'USD') return 'en-US';
  if (c === 'EUR') return 'nl-NL';
  if (c === 'GBP') return 'en-GB';
  if (c === 'RUB') return 'ru-RU';
  if (c === 'PLN') return 'pl-PL';
  if (c === 'BRL') return 'pt-BR';
  if (c === 'JPY') return 'ja-JP';
  if (c === 'NOK') return 'nb-NO';
  if (c === 'IDR') return 'id-ID';
  if (c === 'MYR') return 'ms-MY';
  if (c === 'PHP') return 'en-PH';
  if (c === 'SGD') return 'en-SG';
  if (c === 'THB') return 'th-TH';
  if (c === 'VND') return 'vi-VN';
  if (c === 'KRW') return 'ko-KR';
  if (c === 'TRY') return 'tr-TR';
  if (c === 'UAH') return 'uk-UA';
  if (c === 'MXN') return 'es-MX';
  if (c === 'CAD') return 'en-CA';
  if (c === 'AUD') return 'en-AU';
  if (c === 'NZD') return 'en-NZ';
  if (c === 'CNY') return 'zh-CN';
  if (c === 'INR') return 'en-IN';
  if (c === 'HKD') return 'zh-HK';
  if (c === 'TWD') return 'zh-TW';
  if (c === 'SEK') return 'sv-SE';
  if (c === 'ILS') return 'he-IL';
  if (c === 'ZAR') return 'en-ZA';
  return 'en-US';
}

function inferSymbolFromISO(iso: string, locale: string): string {
  const c = String(iso || '').toUpperCase();
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: c,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === 'currency')?.value;
    if (sym) return sym;
  } catch {
  }

  if (c === 'EUR') return '€';
  if (c === 'GBP') return '£';
  if (c === 'JPY') return '¥';
  if (c === 'KRW') return '₩';
  if (c === 'TRY') return '₺';
  if (c === 'RUB') return '₽';
  if (c === 'PLN') return 'zł';
  if (c === 'BRL') return 'R$';
  return '$';
}

export function getCurrencyMetaFromSteamCode(code: string): CurrencyMeta {
  const normalizedCode = String(code || '').trim();
  const iso = STEAM_CURRENCY_TO_ISO[normalizedCode] || 'USD';
  const locale = inferLocaleFromISO(iso);
  const symbol = inferSymbolFromISO(iso, locale);
  return { code: normalizedCode || ISO_TO_STEAM_CURRENCY[iso] || '1', iso, locale, symbol };
}

export function normalizeSteamCurrencyCode(input: string | null | undefined): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return STEAM_CURRENCY_TO_ISO[raw] ? raw : null;
  }

  const iso = raw.toUpperCase();
  const mapped = ISO_TO_STEAM_CURRENCY[iso];
  return mapped ? mapped : null;
}

export function readCurrencyPreference(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem('sv_currency');
    return normalizeSteamCurrencyCode(stored);
  } catch {
    return null;
  }
}

export function writeCurrencyPreference(code: string): void {
  const normalized = normalizeSteamCurrencyCode(code);
  if (!normalized) return;

  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sv_currency', normalized);
    window.dispatchEvent(new CustomEvent('sv-currency-changed', { detail: { code: normalized } }));
    try {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'sv_currency',
          newValue: normalized,
          storageArea: window.localStorage,
        })
      );
    } catch {
    }
  } catch {
  }
}

export function listSteamCurrencies(): Array<{ code: string; iso: string; label: string; symbol: string }> {
  const entries = Object.entries(STEAM_CURRENCY_TO_ISO).map(([code, iso]) => {
    const meta = getCurrencyMetaFromSteamCode(code);
    const label = `${iso} (${meta.symbol})`;
    return { code, iso, label, symbol: meta.symbol };
  });

  entries.sort((a, b) => {
    const ai = a.iso.localeCompare(b.iso);
    if (ai !== 0) return ai;
    return a.code.localeCompare(b.code);
  });

  return entries;
}
