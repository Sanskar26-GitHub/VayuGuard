import { sanitizeGeminiError } from '../config/gemini';

type LogLevel = 'info' | 'warn' | 'error';

/**
 * Redacts sensitive tokens, keys, or stack traces before emitting structured server logs.
 *
 * @param message - Primary log message.
 * @param context - Optional sanitized metadata object (never raw user payloads or secrets).
 * @returns Sanitized metadata dictionary suitable for structured logging.
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, string | number | boolean | undefined>,
): string {
  const safeMessage = sanitizeGeminiError(message);
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: 'vayuguard',
    message: safeMessage,
  };

  if (context) {
    const cleanContext: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(context)) {
      if (value === undefined) continue;
      cleanContext[key] = typeof value === 'string' ? sanitizeGeminiError(value) : value;
    }
    if (Object.keys(cleanContext).length > 0) {
      entry.context = cleanContext;
    }
  }

  return JSON.stringify(entry);
}

/**
 * Lightweight structured server logger that prevents leaking API keys, bearer tokens,
 * internal file paths, or raw user-submitted payloads.
 */
export const logger = {
  /**
   * Emits an informational structured log line.
   *
   * @param message - Operational event description.
   * @param context - Optional sanitized key/value metadata.
   */
  info(message: string, context?: Record<string, string | number | boolean | undefined>): void {
    console.log(formatLogEntry('info', message, context));
  },

  /**
   * Emits a warning structured log line.
   *
   * @param message - Warning description.
   * @param context - Optional sanitized key/value metadata.
   */
  warn(message: string, context?: Record<string, string | number | boolean | undefined>): void {
    console.warn(formatLogEntry('warn', message, context));
  },

  /**
   * Emits an error structured log line with sanitized error details.
   *
   * @param message - Error description.
   * @param error - Optional unknown error object to sanitize before logging.
   * @param context - Optional sanitized key/value metadata.
   */
  error(
    message: string,
    error?: unknown,
    context?: Record<string, string | number | boolean | undefined>,
  ): void {
    const mergedContext = error
      ? { ...context, detail: sanitizeGeminiError(error) }
      : context;
    console.error(formatLogEntry('error', message, mergedContext));
  },
};
