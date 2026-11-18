const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_BACKOFF_MS = 400;
const DEFAULT_USER_AGENT = 'VayuGuard-AirAssistant/1.0';

/**
 * Performs a JSON GET request with an explicit `AbortController` timeout and User-Agent header.
 *
 * @typeParam T - Expected parsed JSON response type.
 * @param url - Fully qualified HTTPS endpoint URL.
 * @param timeoutMs - Maximum wait duration in milliseconds before aborting.
 * @returns Parsed JSON payload typed as `T`.
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': DEFAULT_USER_AGENT,
      },
    });
    if (!response.ok) {
      throw new Error(`Upstream HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a JSON GET request with automatic retry and fixed backoff on transient failures.
 *
 * @typeParam T - Expected parsed JSON response type.
 * @param url - Fully qualified HTTPS endpoint URL.
 * @param timeoutMs - Timeout per attempt in milliseconds.
 * @param maxRetries - Number of retry attempts after the initial try.
 * @param backoffMs - Delay between attempts in milliseconds.
 * @returns Parsed JSON payload typed as `T`.
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = 1,
  backoffMs = DEFAULT_RETRY_BACKOFF_MS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetchJsonWithTimeout<T>(url, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
  throw lastError;
}
