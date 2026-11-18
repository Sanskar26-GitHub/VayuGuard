import type { GeocodeOption } from '../../src/types/airQuality';
import { fetchJsonWithRetry } from '../utils/httpClient';

/**
 * Single location entry returned by the Open-Meteo geocoding API.
 */
export interface OpenMeteoGeoLocation {
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  population?: number;
  timezone?: string;
}

/**
 * Open-Meteo geocoding search API response envelope.
 */
export interface OpenMeteoGeoResult {
  results?: OpenMeteoGeoLocation[];
}

const COUNTRY_HINT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  uk: ['gb', 'uk', 'united kingdom', 'great britain'],
  'united kingdom': ['gb', 'uk', 'united kingdom'],
  usa: ['us', 'usa', 'united states', 'united states of america'],
  us: ['us', 'usa', 'united states'],
  'united states': ['us', 'usa', 'united states'],
  uae: ['ae', 'uae', 'united arab emirates'],
  india: ['in', 'india'],
  china: ['cn', 'china'],
  germany: ['de', 'germany'],
  france: ['fr', 'france'],
};

/**
 * Splits a user-entered `"City, Country"` query into a normalized city search term
 * and an optional country filter token.
 *
 * @param input - Raw city or `"City, Country"` search input.
 * @returns Object containing `cityName` and optional `countryHint`.
 */
export function parseCityAndCountryQuery(input: string): {
  cityName: string;
  countryHint: string;
} {
  const parts = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const rawCity = parts[0] ?? input.trim();
  const cityName = rawCity.replace(/\bNCR\b/gi, '').trim() || rawCity;
  const countryHint = parts.slice(1).join(' ').trim();
  return { cityName, countryHint };
}

/**
 * Checks whether an Open-Meteo geocoding candidate satisfies an optional country hint.
 *
 * @param loc - Candidate Open-Meteo geocoding record.
 * @param countryHint - Country name or ISO code suffix extracted from user input.
 * @returns `true` if the candidate matches the country hint (or if hint is empty).
 */
export function locationMatchesCountryHint(
  loc: OpenMeteoGeoLocation,
  countryHint: string,
): boolean {
  const hint = countryHint.trim().toLowerCase();
  if (!hint) return true;

  const aliases = COUNTRY_HINT_ALIASES[hint] ?? [hint];
  const country = (loc.country ?? '').trim().toLowerCase();
  const code = (loc.country_code ?? '').trim().toLowerCase();
  const admin1 = (loc.admin1 ?? '').trim().toLowerCase();

  return aliases.some(
    (alias) =>
      code === alias ||
      country === alias ||
      country.includes(alias) ||
      admin1 === alias,
  );
}

/**
 * Selects the best geocoding match by filtering against an optional country hint
 * and ranking remaining candidates by `population` descending.
 *
 * @param results - Array of Open-Meteo geocoding candidates.
 * @param countryHint - Optional country filter token (e.g., `"UK"`, `"India"`).
 * @returns Highest-population matching location, or `undefined` if empty.
 */
export function selectTopGeocodingMatch(
  results?: OpenMeteoGeoLocation[],
  countryHint = '',
): OpenMeteoGeoLocation | undefined {
  if (!results || results.length === 0) return undefined;
  const cleanHint = countryHint.trim();
  const matching = cleanHint
    ? results.filter((loc) => locationMatchesCountryHint(loc, cleanHint))
    : results;
  const pool = matching.length > 0 ? matching : results;
  return [...pool].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
}

/**
 * Builds the Open-Meteo geocoding search URL for a parsed city query.
 *
 * @param cityInput - City or `"City, Country"` query string.
 * @returns Encoded HTTPS geocoding URL (`count=6`).
 */
export function buildGeocodingSearchUrl(cityInput: string): {
  url: string;
  countryHint: string;
} {
  const { cityName, countryHint } = parseCityAndCountryQuery(cityInput);
  const queryToken = cityName || cityInput.trim();
  return {
    url: `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      queryToken,
    )}&count=6&language=en&format=json`,
    countryHint,
  };
}

/**
 * Queries Open-Meteo geocoding (`count=6`) and returns population-ranked
 * `"City, Region, Country"` options for live UI autocomplete.
 *
 * @param query - Partial city or `"City, Country"` search string.
 * @returns Sorted list of formatted {@link GeocodeOption} records (empty on short/failed queries).
 */
export async function searchGeocodingLocations(query: string): Promise<GeocodeOption[]> {
  const { cityName, countryHint } = parseCityAndCountryQuery(query);
  if (cityName.length < 2) return [];

  const { url } = buildGeocodingSearchUrl(query);

  try {
    const geoData = await fetchJsonWithRetry<OpenMeteoGeoResult>(url);
    const results = geoData.results ?? [];
    if (results.length === 0) return [];

    const filtered = countryHint
      ? results.filter((loc) => locationMatchesCountryHint(loc, countryHint))
      : results;
    const pool = filtered.length > 0 ? filtered : results;

    return [...pool]
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .map((loc) => ({
        label: [loc.name, loc.admin1, loc.country].filter(Boolean).join(', '),
        cityWithCountry: [loc.name, loc.country].filter(Boolean).join(', '),
        latitude: loc.latitude,
        longitude: loc.longitude,
        countryCode: (loc.country_code ?? 'US').trim().toUpperCase(),
        timezone: loc.timezone ?? 'UTC',
      }));
  } catch {
    return [];
  }
}
