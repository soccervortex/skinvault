import { dbGet, dbSet } from './database';

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

// Read theme settings (database abstraction)
async function readThemeSettings(useCache: boolean = true): Promise<ThemeSettingsMap> {
  try {
    // Use dbGet with cache control - when reading after a write, we want fresh data
    const data = await dbGet<ThemeSettingsMap>(THEME_SETTINGS_KEY, useCache);
    
    // If no data or empty object, return defaults
    if (!data || Object.keys(data).length === 0) {
      return { ...DEFAULT_THEME_SETTINGS };
    }
    
    // Ensure all theme keys exist (merge with defaults to fill missing keys)
    const merged: ThemeSettingsMap = { ...DEFAULT_THEME_SETTINGS };
    for (const theme of Object.keys(DEFAULT_THEME_SETTINGS) as ThemeType[]) {
      if (data[theme] !== undefined && data[theme] !== null) {
        merged[theme] = data[theme];
      }
    }
    
    return merged;
  } catch (error) {
    console.warn('Database read failed for theme settings, using fallback:', error);
  }
  return { ...fallbackThemeSettings };
}

// Write theme settings (database abstraction)
export async function setThemeSettings(settings: ThemeSettingsMap): Promise<void> {
  try {
    // Ensure all theme keys are present before writing
    const completeSettings: ThemeSettingsMap = { ...DEFAULT_THEME_SETTINGS };
    for (const theme of Object.keys(DEFAULT_THEME_SETTINGS) as ThemeType[]) {
      if (settings[theme] !== undefined) {
        completeSettings[theme] = settings[theme];
      }
    }
    
    // Write to database (both KV and MongoDB) - dbSet already clears cache
    const success = await dbSet(THEME_SETTINGS_KEY, completeSettings);
    
    if (success) {
      // Update fallback cache
      fallbackThemeSettings = { ...completeSettings };
      // Wait a bit to ensure write completes and propagates
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    } else {
      console.warn('Database write returned false for theme settings');
    }
  } catch (error) {
    console.warn('Database write failed for theme settings, using fallback:', error);
  }
  // Update fallback even if write failed
  fallbackThemeSettings = { ...settings };
}

// Get user's disabled themes preference (database abstraction)
async function readUserDisabledThemes(): Promise<Record<string, boolean>> {
  try {
    const data = await dbGet<Record<string, boolean>>(THEME_DISABLED_BY_USER_KEY);
    return data || {};
  } catch (error) {
    console.warn('Database read failed for user disabled themes, using fallback:', error);
  }
  return fallbackUserDisabled;
}

// Write user's disabled themes preference (database abstraction)
async function writeUserDisabledThemes(data: Record<string, boolean>): Promise<void> {
  try {
    await dbSet(THEME_DISABLED_BY_USER_KEY, data);
    return;
  } catch (error) {
    console.warn('Database write failed for user disabled themes, using fallback:', error);
  }
  fallbackUserDisabled = data;
}

// Get all theme settings (admin)
// This function ensures we always return a complete settings object
export async function getThemeSettings(): Promise<ThemeSettingsMap> {
  const settings = await readThemeSettings();
  
  // Ensure all keys exist (double-check)
  const complete: ThemeSettingsMap = { ...DEFAULT_THEME_SETTINGS };
  for (const theme of Object.keys(DEFAULT_THEME_SETTINGS) as ThemeType[]) {
    if (settings[theme] !== undefined) {
      complete[theme] = settings[theme];
    }
  }
  
  return complete;
}

// Update a specific theme setting (admin)
export async function setThemeEnabled(theme: ThemeType, enabled: boolean): Promise<void> {
  // Read current settings (bypass cache to get fresh data from database)
  const currentSettings = await readThemeSettings(false);
  
  // Create new settings object with the update
  const newSettings: ThemeSettingsMap = { ...DEFAULT_THEME_SETTINGS };
  
  // Copy all current settings (preserve existing state)
  for (const t of Object.keys(DEFAULT_THEME_SETTINGS) as ThemeType[]) {
    if (currentSettings[t] !== undefined) {
      newSettings[t] = currentSettings[t];
    }
  }
  
  // Update the specific theme
  newSettings[theme] = { enabled };
  
  // Write the complete settings (this will clear cache and write to both KV and MongoDB)
  await setThemeSettings(newSettings);
}

// Check if a theme is enabled (admin enabled it)
export async function isThemeEnabled(theme: ThemeType): Promise<boolean> {
  const settings = await readThemeSettings();
  return settings[theme]?.enabled ?? false;
}

// Theme priority order (higher priority = earlier in array)
// This determines which theme shows when multiple are enabled
const THEME_PRIORITY_ORDER: ThemeType[] = [
  'newyear',      // Highest priority (New Year)
  'oldyear',      // Second priority (Old Year)
  'christmas',    // Third priority (Christmas)
  'sinterklaas',  // Fourth priority (Sinterklaas)
  'halloween',    // Fifth priority (Halloween)
  'easter',       // Lowest priority (Easter)
];

// Get which theme should be active (check admin enabled + user preference)
export async function getActiveTheme(steamId?: string | null, bypassCache: boolean = false): Promise<ThemeType | null> {
  // Bypass cache if requested (e.g., after a theme change)
  const settings = await readThemeSettings(!bypassCache);
  
  // If user has disabled all themes, return null
  if (steamId) {
    const userDisabled = await readUserDisabledThemes();
    if (userDisabled[steamId] === true) return null;
  }
  
  // Find enabled themes in priority order
  // Only check themes that exist in settings and are explicitly enabled
  for (const theme of THEME_PRIORITY_ORDER) {
    const themeSetting = settings[theme];
    if (themeSetting && themeSetting.enabled === true) {
      return theme;
    }
  }
  
  return null;
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

