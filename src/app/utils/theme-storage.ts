import { kv } from '@vercel/kv';

export type ThemeType = 'christmas' | 'halloween' | 'easter' | 'sinterklaas' | 'newyear' | 'oldyear';

export interface ThemeSettings {
  enabled: boolean;
}

export type ThemeSettingsMap = Record<ThemeType, ThemeSettings>;

const THEME_SETTINGS_KEY = 'theme_settings';
const THEME_DISABLED_BY_USER_KEY = 'theme_disabled_by_user';

// Default: all themes disabled
const DEFAULT_THEME_SETTINGS: ThemeSettingsMap = {
  christmas: { enabled: false },
  halloween: { enabled: false },
  easter: { enabled: false },
  sinterklaas: { enabled: false },
  newyear: { enabled: false },
  oldyear: { enabled: false },
};

// Fallback for local dev
let fallbackThemeSettings: ThemeSettingsMap = { ...DEFAULT_THEME_SETTINGS };
let fallbackUserDisabled: Record<string, boolean> = {};

// Read theme settings from KV
async function readThemeSettings(): Promise<ThemeSettingsMap> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const data = await kv.get<ThemeSettingsMap>(THEME_SETTINGS_KEY);
      return data || { ...DEFAULT_THEME_SETTINGS };
    }
  } catch (error) {
    console.warn('KV read failed for theme settings, using fallback:', error);
  }
  return fallbackThemeSettings;
}

// Write theme settings to KV
async function writeThemeSettings(settings: ThemeSettingsMap): Promise<void> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(THEME_SETTINGS_KEY, settings);
      return;
    }
  } catch (error) {
    console.warn('KV write failed for theme settings, using fallback:', error);
  }
  fallbackThemeSettings = settings;
}

// Get user's disabled themes preference
async function readUserDisabledThemes(): Promise<Record<string, boolean>> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const data = await kv.get<Record<string, boolean>>(THEME_DISABLED_BY_USER_KEY);
      return data || {};
    }
  } catch (error) {
    console.warn('KV read failed for user disabled themes, using fallback:', error);
  }
  return fallbackUserDisabled;
}

// Write user's disabled themes preference
async function writeUserDisabledThemes(data: Record<string, boolean>): Promise<void> {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(THEME_DISABLED_BY_USER_KEY, data);
      return;
    }
  } catch (error) {
    console.warn('KV write failed for user disabled themes, using fallback:', error);
  }
  fallbackUserDisabled = data;
}

// Get all theme settings (admin)
export async function getThemeSettings(): Promise<ThemeSettingsMap> {
  return await readThemeSettings();
}

// Update a specific theme setting (admin)
export async function setThemeEnabled(theme: ThemeType, enabled: boolean): Promise<void> {
  const settings = await readThemeSettings();
  settings[theme] = { enabled };
  await writeThemeSettings(settings);
}

// Check if a theme is enabled (admin enabled it)
export async function isThemeEnabled(theme: ThemeType): Promise<boolean> {
  const settings = await readThemeSettings();
  return settings[theme]?.enabled ?? false;
}

// Get which theme should be active (check admin enabled + user preference)
export async function getActiveTheme(steamId?: string | null): Promise<ThemeType | null> {
  const settings = await readThemeSettings();
  
  // Find first enabled theme
  const enabledThemes = Object.entries(settings)
    .filter(([_, s]) => s.enabled)
    .map(([theme]) => theme as ThemeType);
  
  if (enabledThemes.length === 0) return null;
  
  // If user has disabled all themes, return null
  if (steamId) {
    const userDisabled = await readUserDisabledThemes();
    if (userDisabled[steamId] === true) return null;
  }
  
  // Return first enabled theme (priority order)
  return enabledThemes[0] || null;
}

// Check if user has disabled themes
export async function hasUserDisabledThemes(steamId: string): Promise<boolean> {
  const userDisabled = await readUserDisabledThemes();
  return userDisabled[steamId] === true;
}

// Set user's theme preference
export async function setUserThemePreference(steamId: string, disabled: boolean): Promise<void> {
  const userDisabled = await readUserDisabledThemes();
  if (disabled) {
    userDisabled[steamId] = true;
  } else {
    delete userDisabled[steamId];
  }
  await writeUserDisabledThemes(userDisabled);
}

