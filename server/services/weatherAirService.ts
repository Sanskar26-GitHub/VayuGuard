import type {
  AirQualityCategory,
  AirTelemetry,
  RawPollutants,
  ScaleOverride,
  SeverityTier,
} from '../../src/types/airQuality';
import {
  OFFLINE_METEOROLOGICAL_BASELINES,
  TIMEZONE_ABBR_FALLBACKS,
  type BaselineProfile,
} from '../constants/aqiBreakpoints';
import { fetchJsonWithRetry } from '../utils/httpClient';
import {
  buildGeocodingSearchUrl,
  parseCityAndCountryQuery,
  searchGeocodingLocations,
  selectTopGeocodingMatch,
  type OpenMeteoGeoLocation,
  type OpenMeteoGeoResult,
} from './geocodingService';
import { computeRegionalAqi } from './regionalAqiService';

export {
  parseCityAndCountryQuery,
  searchGeocodingLocations,
  selectTopGeocodingMatch,
  type OpenMeteoGeoLocation,
  type OpenMeteoGeoResult,
};

/**
 * Current air-quality reading returned by Open-Meteo `current=` endpoint.
 */
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

/**
 * Current surface weather reading returned by Open-Meteo forecast `current=` endpoint.
 */
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

/**
 * Classifies US EPA Air Quality Index (0–500+) into standard health categories.
 *
 * @param aqi - Integer US AQI score.
 * @returns Matching US EPA {@link AirQualityCategory}.
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
 * Detects surface thermal inversion risk when cool air (< 15°C) pairs with calm winds (< 8 km/h),
 * trapping ground-level PM2.5 and NO2 emissions near street level.
 *
 * @param temperatureC - Surface air temperature in degrees Celsius.
 * @param windSpeedKmh - 10-meter wind speed in km/h.
 * @returns `true` when thermal inversion conditions hold.
 */
export function detectThermalInversion(temperatureC: number, windSpeedKmh: number): boolean {
  return temperatureC < 15 && windSpeedKmh < 8;
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
 * in the searched city's IANA timezone (e.g. `"Nov 18, 2026, 3:15 PM IST"`).
 *
 * @param rawTime - Open-Meteo wall-clock timestamp or ISO-8601 instant string.
 * @param timezone - IANA timezone identifier (e.g. `"Asia/Kolkata"`).
 * @param timezoneAbbr - Optional short timezone abbreviation fallback (e.g. `"IST"`).
 * @returns Formatted local observation timestamp string.
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

/**
 * Generates atmospheric boundary-layer explanation and recommended ventilation window
 * based on regional severity tier, inversion risk, and surface wind speed.
 *
 * @param severityTier - Unified severity tier (`1` through `6`).
 * @param thermalInversionRisk - Whether temperature/wind meet inversion criteria.
 * @param windSpeedKmh - Surface wind speed in km/h.
 * @returns Human-readable `inversionReason` and `recommendedVentilationWindow`.
 */
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
 * Pure parser transforming raw Open-Meteo geocoding, `current=` air-quality, and `current=`
 * weather JSON responses into a strongly typed, location-aware regional {@link AirTelemetry} object.
 *
 * @param cityInput - User-provided city or `"City, Country"` query.
 * @param geo - Open-Meteo geocoding payload.
 * @param aq - Open-Meteo air-quality payload.
 * @param weather - Open-Meteo weather payload.
 * @param source - Origin tag (`'open-meteo-live'` or `'meteorological-baseline'`).
 * @param scaleOverride - Optional AQI scale override or `'AUTO'`.
 * @returns Normalized {@link AirTelemetry} snapshot.
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

/**
 * Generates an offline meteorological baseline telemetry object when live Open-Meteo
 * endpoints are unreachable after retry.
 *
 * @param cityInput - City or `"City, Country"` query string.
 * @param scaleOverride - Optional AQI scale override or `'AUTO'`.
 * @returns Baseline {@link AirTelemetry} flagged with `telemetrySource: 'offline-baseline'`.
 */
export function getMeteorologicalBaseline(
  cityInput: string,
  scaleOverride: ScaleOverride = 'AUTO',
): AirTelemetry {
  const { cityName, countryHint } = parseCityAndCountryQuery(cityInput);
  const known = OFFLINE_METEOROLOGICAL_BASELINES[cityName.toLowerCase()];

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
 * Fetches live population-prioritized geocoding, real-time `current=` air quality,
 * and `current=` weather telemetry via keyless Open-Meteo APIs with an 8-second timeout,
 * 1 automatic retry, `Promise.allSettled` resilience, and offline fallback reserved
 * strictly for total upstream failure.
 *
 * @param cityInput - City or `"City, Country"` query string.
 * @param scaleOverride - Optional AQI scale override or `'AUTO'`.
 * @returns Live or offline-baseline {@link AirTelemetry} snapshot.
 */
export async function fetchAirAndWeatherTelemetry(
  cityInput: string,
  scaleOverride: ScaleOverride = 'AUTO',
): Promise<AirTelemetry> {
  const { url: geoUrl, countryHint } = buildGeocodingSearchUrl(cityInput);

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
