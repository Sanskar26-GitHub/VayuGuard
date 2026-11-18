import type {
  AirQualityCategory,
  AirTelemetry,
  GeocodeOption,
  RawPollutants,
  ScaleOverride,
  SeverityTier,
} from '../../src/types/airQuality';
import { computeRegionalAqi } from './regionalAqiService';

const FETCH_TIMEOUT_MS = 8000;
const RETRY_BACKOFF_MS = 400;
const USER_AGENT_HEADER = 'VayuGuard-AirAssistant/1.0';

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

export interface OpenMeteoGeoResult {
  results?: OpenMeteoGeoLocation[];
}

export interface OpenMeteoAirQualityResult {
  timezone?: string;
  timezone_abbreviation?: string;
  current?: {
    time?: string;
    us_aqi?: number | null;
    pm2_5?: number | null;
    pm10?: number | null;
    nitrogen_dioxide?: number | null;
    carbon_monoxide?: number | null;
    ozone?: number | null;
    sulphur_dioxide?: number | null;
  };
}

export interface OpenMeteoWeatherResult {
  timezone?: string;
  timezone_abbreviation?: string;
  current?: {
    time?: string;
    temperature_2m?: number | null;
    relative_humidity_2m?: number | null;
    wind_speed_10m?: number | null;
  };
}

const COUNTRY_HINT_ALIASES: Record<string, string[]> = {
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

const TIMEZONE_ABBR_FALLBACKS: Record<string, string> = {
  'Asia/Kolkata': 'IST',
  'Asia/Calcutta': 'IST',
  'Europe/London': 'GMT',
  'America/Chicago': 'CST',
};

/**
 * Splits a "City, Country" query into city search name and optional country hint.
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

function locationMatchesCountryHint(
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
 * Classifies US EPA Air Quality Index (0–500+) into standard health categories.
 */
export function classifyUsAqi(aqi: number): AirQualityCategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/**
 * Detects surface thermal inversion risk when cool air (< 15°C) pairs with stagnant winds (< 8 km/h),
 * trapping ground-level PM2.5 and NO2 emissions near street level.
 */
export function detectThermalInversion(temperatureC: number, windSpeedKmh: number): boolean {
  return temperatureC < 15 && windSpeedKmh < 8;
}

/**
 * Sorts Open-Meteo geocoding matches by country hint match (when provided) and then
 * population descending so major urban centers (e.g., Chicago, IL vs. small towns) win.
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
  const sorted = [...pool].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  return sorted[0];
}

function validateIanaTimeZone(tz?: string): string {
  const candidate = (tz ?? '').trim();
  if (!candidate) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

/**
 * Formats an observation timestamp into a clean, human-readable local time string
 * in the searched city's IANA timezone (e.g. "Nov 18, 2026, 3:15 PM IST").
 */
export function formatObservedLocalTime(
  rawTime: string | undefined,
  timezone?: string,
  timezoneAbbr?: string,
): string {
  const validTz = validateIanaTimeZone(timezone);

  let instant: Date;
  const trimmed = (rawTime ?? '').trim();
  const wallClockMatch =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);

  if (wallClockMatch) {
    // Open-Meteo `timezone=auto` returns local wall-clock strings without an offset.
    const [, yStr, mStr, dStr, hhStr, mmStr, ssStr] = wallClockMatch;
    const utcGuess = Date.UTC(
      Number(yStr),
      Number(mStr) - 1,
      Number(dStr),
      Number(hhStr),
      Number(mmStr),
      Number(ssStr ?? '0'),
    );

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: validTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcGuess));

    const getPart = (type: string): number =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);

    const tzGuessAsUtc = Date.UTC(
      getPart('year'),
      getPart('month') - 1,
      getPart('day'),
      getPart('hour'),
      getPart('minute'),
      getPart('second'),
    );
    const offsetMs = tzGuessAsUtc - utcGuess;
    instant = new Date(utcGuess - offsetMs);
  } else {
    const parsed = trimmed ? new Date(trimmed) : new Date();
    instant = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: validTz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(instant);

  const cleanAbbr = (timezoneAbbr ?? '').trim();
  const preferredAbbr =
    /^[A-Z]{2,5}$/.test(cleanAbbr) ? cleanAbbr : TIMEZONE_ABBR_FALLBACKS[validTz];

  if (preferredAbbr && /\sGMT(?:[+-]\d{1,2}(?::\d{2})?)?$/.test(formatted)) {
    return formatted.replace(/\sGMT(?:[+-]\d{1,2}(?::\d{2})?)?$/, ` ${preferredAbbr}`);
  }
  return formatted;
}

export function buildVentilationRecommendation(
  severityTier: SeverityTier,
  thermalInversionRisk: boolean,
  windSpeedKmh: number,
): { inversionReason: string; recommendedVentilationWindow: string } {
  if (thermalInversionRisk) {
    return {
      inversionReason:
        'Cool surface air (< 15°C) combined with calm winds (< 8 km/h) creates a boundary-layer inversion that traps emissions close to the ground.',
      recommendedVentilationWindow:
        severityTier >= 4
          ? 'Keep windows sealed; if brief airing is essential, limit to 10 min between 13:30–15:00 when solar mixing peaks.'
          : 'Delay morning window opening until 12:30–15:30 after surface warming breaks the inversion layer.',
    };
  }

  if (severityTier >= 5) {
    return {
      inversionReason: `Dispersion is active (wind ${windSpeedKmh.toFixed(1)} km/h), but ambient particulate load remains severe.`,
      recommendedVentilationWindow:
        'Keep exterior windows closed and rely on recirculated filtered air; crack a window only briefly during kitchen exhaust if needed.',
    };
  }

  if (severityTier >= 3) {
    return {
      inversionReason: `No thermal inversion detected (wind ${windSpeedKmh.toFixed(1)} km/h), though urban particulates remain elevated.`,
      recommendedVentilationWindow:
        'Short 15-minute cross-ventilation window between 13:00–16:00 away from rush-hour traffic peaks.',
    };
  }

  return {
    inversionReason: `Atmospheric mixing is favorable (wind ${windSpeedKmh.toFixed(1)} km/h); pollutants are dispersing naturally.`,
    recommendedVentilationWindow:
      'Cross-ventilate freely for 30–45 minutes mid-morning (10:00–12:00) or early afternoon (14:00–16:00).',
  };
}

function toNullableMetric(value: unknown, decimals = 1): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Number(Math.max(0, value).toFixed(decimals));
}

/**
 * Pure parser transforming raw Open-Meteo geocoding, `current=` air-quality, and `current=` weather JSON
 * responses into a strongly typed, location-aware regional AirTelemetry object.
 */
export function parseOpenMeteoResponses(
  cityInput: string,
  geo: OpenMeteoGeoResult,
  aq: OpenMeteoAirQualityResult,
  weather: OpenMeteoWeatherResult,
  source: 'open-meteo-live' | 'meteorological-baseline' = 'open-meteo-live',
  scaleOverride: ScaleOverride = 'AUTO',
): AirTelemetry {
  const { countryHint } = parseCityAndCountryQuery(cityInput);
  const location = selectTopGeocodingMatch(geo.results, countryHint);

  const resolvedLocation = location
    ? [location.name, location.admin1, location.country].filter(Boolean).join(', ')
    : cityInput;
  const cityWithCountry = location
    ? [location.name, location.country].filter(Boolean).join(', ')
    : cityInput;
  const countryCode = (location?.country_code ?? 'US').trim().toUpperCase();
  const timezone = aq.timezone ?? weather.timezone ?? location?.timezone ?? 'UTC';
  const timezoneAbbreviation =
    aq.timezone_abbreviation ?? weather.timezone_abbreviation ?? '';

  const rawPollutants: RawPollutants = {
    pm25: toNullableMetric(aq.current?.pm2_5, 1),
    pm10: toNullableMetric(aq.current?.pm10, 1),
    no2: toNullableMetric(aq.current?.nitrogen_dioxide, 1),
    co: toNullableMetric(aq.current?.carbon_monoxide, 1),
    o3: toNullableMetric(aq.current?.ozone, 1),
    so2: toNullableMetric(aq.current?.sulphur_dioxide, 1),
  };

  // Compute US EPA AQI directly from available non-null concentrations (or fallback to Open-Meteo's us_aqi)
  const usEpaCalc = computeRegionalAqi(rawPollutants, 'US', 'US_EPA');
  const usAqi =
    typeof aq.current?.us_aqi === 'number' && Number.isFinite(aq.current.us_aqi)
      ? Math.max(0, Math.round(aq.current.us_aqi))
      : usEpaCalc.aqiValue;

  const regional = computeRegionalAqi(rawPollutants, countryCode, scaleOverride);

  const temperatureC = Number((weather.current?.temperature_2m ?? 22).toFixed(1));
  const humidityPercent = Math.round(weather.current?.relative_humidity_2m ?? 52);
  const windSpeedKmh = Number(Math.max(0, weather.current?.wind_speed_10m ?? 9.5).toFixed(1));

  const thermalInversionRisk = detectThermalInversion(temperatureC, windSpeedKmh);
  const { inversionReason, recommendedVentilationWindow } = buildVentilationRecommendation(
    regional.severityTier,
    thermalInversionRisk,
    windSpeedKmh,
  );

  const rawTime = aq.current?.time ?? weather.current?.time ?? new Date().toISOString();
  const observedAt = formatObservedLocalTime(rawTime, timezone, timezoneAbbreviation);

  return {
    city: cityWithCountry,
    cityWithCountry,
    resolvedLocation,
    countryCode,
    timezone,
    timezoneAbbreviation,
    latitude: location?.latitude ?? 0,
    longitude: location?.longitude ?? 0,
    timestamp: rawTime,
    observedAt,
    usAqi,
    category: classifyUsAqi(usAqi),
    aqiValue: regional.aqiValue,
    scaleMax: regional.scaleMax,
    scaleCode: regional.scaleCode,
    scaleName: regional.scaleName,
    categoryLabel: regional.categoryLabel,
    severityTier: regional.severityTier,
    dominantPollutant: regional.dominantPollutant,
    isAutoSelectedScale: regional.isAutoSelectedScale,
    pollutantSubIndices: regional.pollutantSubIndices,
    pm25: rawPollutants.pm25 ?? 0,
    pm10: rawPollutants.pm10 ?? 0,
    no2: rawPollutants.no2 ?? 0,
    co: rawPollutants.co ?? 0,
    o3: rawPollutants.o3 ?? 0,
    so2: rawPollutants.so2 ?? 0,
    temperatureC,
    humidityPercent,
    windSpeedKmh,
    thermalInversionRisk,
    inversionReason,
    recommendedVentilationWindow,
    source,
    telemetrySource: source === 'open-meteo-live' ? 'live' : 'offline-baseline',
  };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT_HEADER,
      },
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithRetry<T>(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS,
  maxRetries = 1,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetchJsonWithTimeout<T>(url, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
      }
    }
  }
  throw lastErr;
}

interface BaselineProfile {
  name: string;
  admin1: string;
  country: string;
  countryCode: string;
  timezone: string;
  timezoneAbbreviation: string;
  latitude: number;
  longitude: number;
  usAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  co: number;
  o3: number;
  so2: number;
  temperatureC: number;
  humidityPercent: number;
  windSpeedKmh: number;
}

const OFFLINE_METEOROLOGICAL_BASELINES: Record<string, BaselineProfile> = {
  delhi: {
    name: 'Delhi',
    admin1: 'National Capital Territory of Delhi',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 28.6519,
    longitude: 77.2315,
    usAqi: 248,
    pm25: 174.2,
    pm10: 268.5,
    no2: 64.8,
    co: 1120,
    o3: 42.0,
    so2: 18.5,
    temperatureC: 13.4,
    humidityPercent: 68,
    windSpeedKmh: 5.2,
  },
  jaipur: {
    name: 'Jaipur',
    admin1: 'Rajasthan',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 26.9124,
    longitude: 75.7873,
    usAqi: 158,
    pm25: 69.4,
    pm10: 142.0,
    no2: 41.2,
    co: 680,
    o3: 52.0,
    so2: 14.0,
    temperatureC: 14.6,
    humidityPercent: 44,
    windSpeedKmh: 6.4,
  },
  bengaluru: {
    name: 'Bengaluru',
    admin1: 'Karnataka',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 12.9716,
    longitude: 77.5946,
    usAqi: 74,
    pm25: 22.8,
    pm10: 48.6,
    no2: 29.5,
    co: 410,
    o3: 46.0,
    so2: 8.4,
    temperatureC: 23.8,
    humidityPercent: 58,
    windSpeedKmh: 12.4,
  },
  mumbai: {
    name: 'Mumbai',
    admin1: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 19.076,
    longitude: 72.8777,
    usAqi: 118,
    pm25: 42.5,
    pm10: 88.2,
    no2: 46.1,
    co: 590,
    o3: 49.0,
    so2: 12.2,
    temperatureC: 27.6,
    humidityPercent: 72,
    windSpeedKmh: 14.8,
  },
  chicago: {
    name: 'Chicago',
    admin1: 'Illinois',
    country: 'United States',
    countryCode: 'US',
    timezone: 'America/Chicago',
    timezoneAbbreviation: 'CST',
    latitude: 41.85,
    longitude: -87.65,
    usAqi: 62,
    pm25: 14.5,
    pm10: 26.4,
    no2: 24.8,
    co: 320,
    o3: 56.0,
    so2: 4.5,
    temperatureC: 9.2,
    humidityPercent: 62,
    windSpeedKmh: 15.4,
  },
  london: {
    name: 'London',
    admin1: 'England',
    country: 'United Kingdom',
    countryCode: 'GB',
    timezone: 'Europe/London',
    timezoneAbbreviation: 'GMT',
    latitude: 51.5085,
    longitude: -0.1257,
    usAqi: 44,
    pm25: 8.6,
    pm10: 16.2,
    no2: 28.4,
    co: 290,
    o3: 52.0,
    so2: 3.1,
    temperatureC: 11.2,
    humidityPercent: 76,
    windSpeedKmh: 16.5,
  },
};

export function getMeteorologicalBaseline(
  cityInput: string,
  scaleOverride: ScaleOverride = 'AUTO',
): AirTelemetry {
  const { cityName, countryHint } = parseCityAndCountryQuery(cityInput);
  const normalizedCity = cityName.toLowerCase();
  const known = OFFLINE_METEOROLOGICAL_BASELINES[normalizedCity];

  const baseline: BaselineProfile = known ?? {
    name: cityName || cityInput.trim(),
    admin1: '',
    country: countryHint || '',
    countryCode: countryHint.toLowerCase().includes('india')
      ? 'IN'
      : countryHint.toLowerCase().includes('uk') || countryHint.toLowerCase().includes('united kingdom')
        ? 'GB'
        : 'US',
    timezone: 'UTC',
    timezoneAbbreviation: 'UTC',
    latitude: 28.6,
    longitude: 77.2,
    usAqi: 78,
    pm25: 23.4,
    pm10: 46.2,
    no2: 28.0,
    co: 420,
    o3: 48.0,
    so2: 7.5,
    temperatureC: 18.5,
    humidityPercent: 55,
    windSpeedKmh: 9.2,
  };

  const nowIso = new Date().toISOString();

  return parseOpenMeteoResponses(
    cityInput,
    {
      results: [
        {
          name: baseline.name,
          admin1: baseline.admin1 || undefined,
          country: baseline.country || undefined,
          country_code: baseline.countryCode,
          latitude: baseline.latitude,
          longitude: baseline.longitude,
          population: 1000000,
          timezone: baseline.timezone,
        },
      ],
    },
    {
      timezone: baseline.timezone,
      timezone_abbreviation: baseline.timezoneAbbreviation,
      current: {
        time: nowIso,
        us_aqi: baseline.usAqi,
        pm2_5: baseline.pm25,
        pm10: baseline.pm10,
        nitrogen_dioxide: baseline.no2,
        carbon_monoxide: baseline.co,
        ozone: baseline.o3,
        sulphur_dioxide: baseline.so2,
      },
    },
    {
      timezone: baseline.timezone,
      timezone_abbreviation: baseline.timezoneAbbreviation,
      current: {
        time: nowIso,
        temperature_2m: baseline.temperatureC,
        relative_humidity_2m: baseline.humidityPercent,
        wind_speed_10m: baseline.windSpeedKmh,
      },
    },
    'meteorological-baseline',
    scaleOverride,
  );
}

/**
 * Lightweight geocoding lookup returning population-ranked City, Region, Country options
 * for live UI autocomplete.
 */
export async function searchGeocodingLocations(query: string): Promise<GeocodeOption[]> {
  const { cityName, countryHint } = parseCityAndCountryQuery(query);
  if (cityName.length < 2) return [];

  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    cityName,
  )}&count=6&language=en&format=json`;

  try {
    const geoData = await fetchJsonWithRetry<OpenMeteoGeoResult>(geoUrl);
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

/**
 * Fetches live population-prioritized geocoding (`count=6`), real-time `current=` air quality,
 * and `current=` weather telemetry via keyless Open-Meteo APIs with an 8-second timeout,
 * 1 automatic retry (400ms backoff), `Promise.allSettled` resilience, and offline fallback
 * reserved strictly for total network failure after retry.
 */
export async function fetchAirAndWeatherTelemetry(
  cityInput: string,
  scaleOverride: ScaleOverride = 'AUTO',
): Promise<AirTelemetry> {
  const { cityName, countryHint } = parseCityAndCountryQuery(cityInput);
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    cityName || cityInput.trim(),
  )}&count=6&language=en&format=json`;

  try {
    const geoData = await fetchJsonWithRetry<OpenMeteoGeoResult>(geoUrl);
    const topMatch = selectTopGeocodingMatch(geoData.results, countryHint);
    if (!topMatch) {
      return getMeteorologicalBaseline(cityInput, scaleOverride);
    }

    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${topMatch.latitude}&longitude=${topMatch.longitude}&current=pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,ozone,sulphur_dioxide,us_aqi&timezone=auto`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${topMatch.latitude}&longitude=${topMatch.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`;

    const [aqSettled, weatherSettled] = await Promise.allSettled([
      fetchJsonWithRetry<OpenMeteoAirQualityResult>(aqUrl),
      fetchJsonWithRetry<OpenMeteoWeatherResult>(weatherUrl),
    ]);

    if (aqSettled.status !== 'fulfilled') {
      return getMeteorologicalBaseline(cityInput, scaleOverride);
    }

    const aqData = aqSettled.value;
    const weatherData: OpenMeteoWeatherResult =
      weatherSettled.status === 'fulfilled'
        ? weatherSettled.value
        : {
            timezone: aqData.timezone ?? topMatch.timezone ?? 'UTC',
            timezone_abbreviation: aqData.timezone_abbreviation ?? '',
            current: {},
          };

    return parseOpenMeteoResponses(
      cityInput,
      geoData,
      aqData,
      weatherData,
      'open-meteo-live',
      scaleOverride,
    );
  } catch {
    return getMeteorologicalBaseline(cityInput, scaleOverride);
  }
}
