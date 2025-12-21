/**
 * Rate limiting feedback utility
 */

export interface RateLimitInfo {
  retryAfter?: number;
  limit?: number;
  remaining?: number;
  reset?: number;
}

export function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  const retryAfter = headers.get('retry-after');
  const rateLimitLimit = headers.get('x-ratelimit-limit');
  const rateLimitRemaining = headers.get('x-ratelimit-remaining');
  const rateLimitReset = headers.get('x-ratelimit-reset');

  return {
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
    limit: rateLimitLimit ? parseInt(rateLimitLimit, 10) : undefined,
    remaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
    reset: rateLimitReset ? parseInt(rateLimitReset, 10) : undefined,
  };
}

export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes !== 1 ? 's' : ''} and ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
}

export function getRateLimitMessage(info: RateLimitInfo): string {
  if (info.retryAfter) {
    return `Rate limit exceeded. Please try again in ${formatRetryAfter(info.retryAfter)}.`;
  }
  if (info.remaining !== undefined && info.remaining <= 5) {
    return `Rate limit warning: ${info.remaining} request${info.remaining !== 1 ? 's' : ''} remaining.`;
  }
  return 'Rate limit exceeded. Please try again later.';
}

