/**
 * Christmas Theme Utility
 * Manages the Christmas theme state with localStorage persistence
 * Default: ON
 */

const CHRISTMAS_THEME_KEY = 'sv_christmas_theme_enabled';

/**
 * Get the current Christmas theme state
 * Returns true by default (theme is on by default)
 */
export function isChristmasThemeEnabled(): boolean {
  if (typeof window === 'undefined') return true; // SSR default
  
  const stored = localStorage.getItem(CHRISTMAS_THEME_KEY);
  
  // If not set, default to true (theme ON)
  if (stored === null) return true;
  
  return stored === 'true';
}

/**
 * Set the Christmas theme state
 */
export function setChristmasThemeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(CHRISTMAS_THEME_KEY, String(enabled));
  
  // Trigger custom event for theme change
  window.dispatchEvent(new CustomEvent('christmasThemeChange', { detail: enabled }));
}

/**
 * Toggle the Christmas theme state
 */
export function toggleChristmasTheme(): boolean {
  const current = isChristmasThemeEnabled();
  const newValue = !current;
  setChristmasThemeEnabled(newValue);
  return newValue;
}

