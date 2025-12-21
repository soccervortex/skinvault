/**
 * Input sanitization utilities
 */

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .slice(0, 10000); // Limit length
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  
  // Basic email validation and sanitization
  const sanitized = email.trim().toLowerCase().slice(0, 254);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
}

/**
 * Validate SteamID64 format
 */
export function validateSteamId(steamId: string | null | undefined): boolean {
  if (!steamId || typeof steamId !== 'string') return false;
  return /^\d{17}$/.test(steamId);
}

/**
 * Sanitize SteamID64
 */
export function sanitizeSteamId(steamId: string | null | undefined): string | null {
  if (!steamId || typeof steamId !== 'string') return null;
  const cleaned = steamId.trim().replace(/\D/g, ''); // Remove non-digits
  return validateSteamId(cleaned) ? cleaned : null;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

