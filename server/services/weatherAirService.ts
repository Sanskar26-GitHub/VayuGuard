import type {
  AirQualityCategory,
  AirTelemetry,
  ScaleOverride,
  SeverityTier,
} from '../../src/types/airQuality';
import { computeRegionalAqi } from './regionalAqiService';

const FETCH_TIMEOUT_MS = 5000;

export interface OpenMeteoGeoLocation {
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  population?: number;
}

export interface OpenMeteoGeoResult {
  results?: OpenMeteoGeoLocation[];
}

export interface OpenMeteoAirQualityResult {
  current?: {
    time?: string;
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    carbon_monoxide?: number;
    ozone?: number;
    sulphur_dioxide?: number;
  };
}

export interface OpenMeteoWeatherResult {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
  };
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
 * Sorts Open-Meteo geocoding matches by population descending so major urban centers
 * (e.g., Chicago, IL vs. small homonymous towns) are always prioritized.
 */
export function selectTopGeocodingMatch(
  results?: OpenMeteoGeoLocation[],
): OpenMeteoGeoLocation | undefined {
  if (!results || results.length === 0) return undefined;
  const sorted = [...results].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  return sorted[0];
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
  const location = selectTopGeocodingMatch(geo.results);
  const resolvedLocation = location
    ? [location.name, location.admin1, location.country].filter(Boolean).join(', ')
    : cityInput;
  const countryCode = (location?.country_code ?? 'US').trim().toUpperCase();

  const pm25 = Number(Math.max(0, aq.current?.pm2_5 ?? 28).toFixed(1));
  const pm10 = Number(Math.max(0, aq.current?.pm10 ?? 54).toFixed(1));
  const no2 = Number(Math.max(0, aq.current?.nitrogen_dioxide ?? 32).toFixed(1));
  const co = Number(Math.max(0, aq.current?.carbon_monoxide ?? 410).toFixed(1));
  const o3 = Number(Math.max(0, aq.current?.ozone ?? 48).toFixed(1));
  const so2 = Number(Math.max(0, aq.current?.sulphur_dioxide ?? 8).toFixed(1));

  // Compute US EPA AQI directly from raw concentrations (or fallback to Open-Meteo's us_aqi if available)
  const usEpaCalc = computeRegionalAqi({ pm25, pm10, no2, co, o3, so2 }, 'US', 'US_EPA');
  const usAqi =
    typeof aq.current?.us_aqi === 'number' && Number.isFinite(aq.current.us_aqi)
      ? Math.max(0, Math.round(aq.current.us_aqi))
      : usEpaCalc.aqiValue;

  const regional = computeRegionalAqi(
    { pm25, pm10, no2, co, o3, so2 },
    countryCode,
    scaleOverride,
  );

  const temperatureC = Number((weather.current?.temperature_2m ?? 22).toFixed(1));
  const humidityPercent = Math.round(weather.current?.relative_humidity_2m ?? 52);
  const windSpeedKmh = Number(Math.max(0, weather.current?.wind_speed_10m ?? 9.5).toFixed(1));

  const thermalInversionRisk = detectThermalInversion(temperatureC, windSpeedKmh);
  const { inversionReason, recommendedVentilationWindow } = buildVentilationRecommendation(
    regional.severityTier,
    thermalInversionRisk,
    windSpeedKmh,
  );

  const observedAt = aq.current?.time ?? weather.current?.time ?? new Date().toISOString();

  return {
    city: cityInput,
    resolvedLocation,
    countryCode,
    latitude: location?.latitude ?? 0,
    longitude: location?.longitude ?? 0,
    timestamp: observedAt,
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
    pm25,
    pm10,
    no2,
    co,
    o3,
    so2,
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
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface BaselineProfile {
  name: string;
  admin1: string;
  country: string;
  countryCode: string;
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
  'delhi ncr': {
    name: 'Delhi',
    admin1: 'Delhi',
    country: 'India',
    countryCode: 'IN',
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
  delhi: {
    name: 'Delhi',
    admin1: 'Delhi',
    country: 'India',
    countryCode: 'IN',
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
  const normalized = cityInput.trim().toLowerCase();
  const known = OFFLINE_METEOROLOGICAL_BASELINES[normalized];

  const baseline: BaselineProfile = known ?? {
    name: cityInput.trim(),
    admin1: '',
    country: '',
    countryCode: 'US',
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
        },
      ],
    },
    {
      current: {
        time: new Date().toISOString(),
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
      current: {
        time: new Date().toISOString(),
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
 * Fetches live population-prioritized geocoding (`count=5`), real-time `current=` air quality,
 * and `current=` weather telemetry via keyless Open-Meteo APIs with a strict 5-second timeout
 * and graceful offline meteorological baseline fallback.
 */
export async function fetchAirAndWeatherTelemetry(
  cityInput: string,
  scaleOverride: ScaleOverride = 'AUTO',
): Promise<AirTelemetry> {
  const queryCity = cityInput.replace(/\bNCR\b/gi, '').trim() || cityInput.trim();
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    queryCity,
  )}&count=5&language=en&format=json`;

  try {
    const geoData = await fetchJsonWithTimeout<OpenMeteoGeoResult>(geoUrl);
    const topMatch = selectTopGeocodingMatch(geoData.results);
    if (!topMatch) {
      return getMeteorologicalBaseline(cityInput, scaleOverride);
    }

    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${topMatch.latitude}&longitude=${topMatch.longitude}&current=pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,ozone,sulphur_dioxide,us_aqi&timezone=auto`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${topMatch.latitude}&longitude=${topMatch.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`;

    const [aqData, weatherData] = await Promise.all([
      fetchJsonWithTimeout<OpenMeteoAirQualityResult>(aqUrl),
      fetchJsonWithTimeout<OpenMeteoWeatherResult>(weatherUrl),
    ]);

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
