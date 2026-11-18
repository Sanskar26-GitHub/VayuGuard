import dotenv from 'dotenv';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';

dotenv.config();

export const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

let cachedClient: GoogleGenAI | null = null;

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'your_gemini_api_key_here' && key !== 'MY_GEMINI_API_KEY');
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('Gemini API key is not configured.');
  }

  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  return cachedClient;
}

/**
 * Strips API keys, bearer tokens, file paths, and stack traces from upstream errors
 * before logging or surfacing sanitized diagnostics.
 */
export function sanitizeGeminiError(error: unknown): string {
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown AI error';

  return rawMessage
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/key=[A-Za-z0-9\-._~]+/gi, 'key=[REDACTED]')
    .replace(/(\/[a-zA-Z0-9_.-]+)+\.(ts|js|mjs|cjs|json)(:\d+(:\d+)?)?/g, '[INTERNAL_PATH]')
    .replace(/[A-Z]:\\[^\s]+/g, '[INTERNAL_PATH]')
    .replace(/\s+at\s+[^\n]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeJitteredBackoffMs(attempt: number, baseMs = 350): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 180);
  return Math.min(3500, exponential + jitter);
}

export interface RetryFallbackParams {
  contents: string;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
}

export interface RetryFallbackResult {
  text: string;
  modelUsed: string;
}

let lastAiDiagnostic: string | null = null;

export function getLastAiDiagnostic(): string | null {
  return lastAiDiagnostic;
}

const GEMINI_ATTEMPT_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Executes Gemini structured JSON generation with jittered exponential backoff
 * on `gemini-4-hydrogen`, automatically falling back to `gemini-3.1-flash-lite`.
 */
export async function generateContentWithRetryAndFallback(
  params: RetryFallbackParams,
): Promise<RetryFallbackResult> {
  const ai = getGeminiClient();
  const models = [PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL];
  let lastSanitizedError = 'Gemini generation failed.';

  for (const model of models) {
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response: GenerateContentResponse = await withTimeout(
          ai.models.generateContent({
            model,
            contents: params.contents,
            config: {
              systemInstruction: params.systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: params.responseSchema,
            },
          }),
          GEMINI_ATTEMPT_TIMEOUT_MS,
          `Gemini ${model}`,
        );

        const text = response.text?.trim();
        if (!text) {
          throw new Error(`Empty JSON response from ${model}`);
        }

        lastAiDiagnostic = null;
        return { text, modelUsed: model };
      } catch (err) {
        lastSanitizedError = sanitizeGeminiError(err);
        lastAiDiagnostic = `${model}: ${lastSanitizedError}`;
        if (attempt < maxAttempts - 1) {
          await sleep(computeJitteredBackoffMs(attempt));
        }
      }
    }
  }

  throw new Error(lastSanitizedError);
}
