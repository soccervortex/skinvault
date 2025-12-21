/**
 * Retry utility for failed API calls
 */

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  onRetry?: (attempt: number, error: any) => void;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  delay: 1000,
  backoff: 'exponential',
  onRetry: () => {},
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors (4xx client errors except 429)
      if (error?.status >= 400 && error?.status < 500 && error?.status !== 429) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === opts.maxAttempts) {
        throw error;
      }

      // Call onRetry callback
      opts.onRetry(attempt, error);

      // Calculate delay with backoff
      const delay = opts.backoff === 'exponential'
        ? opts.delay * Math.pow(2, attempt - 1)
        : opts.delay * attempt;

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Retry fetch with exponential backoff
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retry(
    () => fetch(url, options),
    {
      maxAttempts: 3,
      delay: 1000,
      backoff: 'exponential',
      ...retryOptions,
    }
  );
}

