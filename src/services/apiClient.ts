import type {
  ActionPlanResponse,
  AirTelemetry,
  AskAssistantRequest,
  AskAssistantResponse,
  GeocodeOption,
  HouseholdProfile,
  ScaleOverride,
} from '../types/airQuality';

async function parseApiResponse<T>(response: Response, fallbackError: string): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(fallbackError);
    }
    throw new Error('Received malformed JSON response from server.');
  }

  if (!response.ok) {
    const errMsg =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : fallbackError;
    throw new Error(errMsg);
  }

  return payload as T;
}

/**
 * Queries `/api/geocode` for population-ranked city autocomplete suggestions.
 *
 * @param query - User-typed partial city or `"City, Country"` query.
 * @param signal - Optional `AbortSignal` to cancel superseded debounced requests.
 * @returns Array of matching {@link GeocodeOption} records.
 */
export async function geocodeCities(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeOption[]> {
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal });
  const data = await parseApiResponse<{ results?: GeocodeOption[] }>(
    response,
    'Unable to search city locations.',
  );
  return Array.isArray(data.results) ? data.results : [];
}

/**
 * Queries `/api/air-quality` for live pollutant, weather, and regional AQI telemetry.
 *
 * @param city - City or `"City, Country"` query string.
 * @param scaleOverride - Regional AQI standard override or `'AUTO'`.
 * @param signal - Optional `AbortSignal` to cancel in-flight requests.
 * @returns Normalized {@link AirTelemetry} snapshot.
 */
export async function fetchCityTelemetry(
  city: string,
  scaleOverride: ScaleOverride = 'AUTO',
  signal?: AbortSignal,
): Promise<AirTelemetry> {
  const response = await fetch(
    `/api/air-quality?city=${encodeURIComponent(city)}&scale=${encodeURIComponent(scaleOverride)}`,
    { signal },
  );
  const data = await parseApiResponse<{ telemetry?: AirTelemetry }>(
    response,
    'Unable to fetch city telemetry.',
  );
  if (!data.telemetry) {
    throw new Error('Telemetry payload was empty.');
  }
  return data.telemetry;
}

/**
 * Submits the validated household profile to `/api/plan` to compute live telemetry
 * and a structured 3-pillar daily action plan.
 *
 * @param profile - Validated {@link HouseholdProfile}.
 * @param signal - Optional `AbortSignal` for request cancellation.
 * @returns Complete {@link ActionPlanResponse} with grounded recommendations.
 */
export async function generateActionPlan(
  profile: HouseholdProfile,
  signal?: AbortSignal,
): Promise<ActionPlanResponse> {
  const response = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
    signal,
  });
  return parseApiResponse<ActionPlanResponse>(
    response,
    'Failed to generate daily air quality plan.',
  );
}

/**
 * Sends a situational air-quality question grounded in household context and live telemetry
 * to `/api/ask`.
 *
 * @param payload - Question text, validated household profile, and active telemetry.
 * @param signal - Optional `AbortSignal` for request cancellation.
 * @returns Grounded {@link AskAssistantResponse}.
 */
export async function askAirAssistant(
  payload: AskAssistantRequest,
  signal?: AbortSignal,
): Promise<AskAssistantResponse> {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  return parseApiResponse<AskAssistantResponse>(
    response,
    'Unable to get an assistant response.',
  );
}
