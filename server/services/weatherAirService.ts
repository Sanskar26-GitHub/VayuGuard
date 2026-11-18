import type { AirQualityCategory, AirTelemetry } from '../../src/types/airQuality';

const FETCH_TIMEOUT_MS = 5000;

export interface OpenMeteoGeoResult {
  results?: Array<{
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
  }>;
}

export interface OpenMeteoAirQualityResult {
  current?: {
    time?: string;
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    carbon_monoxide?: number;
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

export function buildVentilationRecommendation(
  usAqi: number,
  thermalInversionRisk: boolean,
  windSpeedKmh: number,
): { inversionReason: string; recommendedVentilationWindow: string } {
  if (thermalInversionRisk) {
    return {
      inversionReason:
        'Cool surface air (< 15°C) combined with calm winds (< 8 km/h) creates a boundary-layer inversion that traps emissions close to the ground.',
      recommendedVentilationWindow:
        usAqi > 150
          ? 'Keep windows sealed; if brief airing is essential, limit to 10 min between 13:30–15:00 when solar mixing peaks.'
          : 'Delay morning window opening until 12:30–15:30 after surface warming breaks the inversion layer.',
    };
  }

  if (usAqi > 200) {
    return {
      inversionReason: `Dispersion is active (wind ${windSpeedKmh.toFixed(1)} km/h), but ambient particulate load remains severe.`,
      recommendedVentilationWindow:
        'Keep exterior windows closed and rely on recirculated filtered air; crack a window only briefly during kitchen exhaust if needed.',
    };
  }

  if (usAqi > 100) {
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
 * Pure parser transforming raw Open-Meteo geocoding, air-quality, and weather JSON
 * responses into a strongly typed AirTelemetry object.
 */
export function parseOpenMeteoResponses(
  cityInput: string,
  geo: OpenMeteoGeoResult,
  aq: OpenMeteoAirQualityResult,
  weather: OpenMeteoWeatherResult,
  source: 'open-meteo-live' | 'meteorological-baseline' = 'open-meteo-live',
): AirTelemetry {
  const location = geo.results?.[0];
  const resolvedLocation = location
    ? [location.name, location.admin1, location.country].filter(Boolean).join(', ')
    : cityInput;

  const usAqi = Math.max(0, Math.round(aq.current?.us_aqi ?? 85));
  const pm25 = Number(Math.max(0, aq.current?.pm2_5 ?? 28).toFixed(1));
  const pm10 = Number(Math.max(0, aq.current?.pm10 ?? 54).toFixed(1));
  const no2 = Number(Math.max(0, aq.current?.nitrogen_dioxide ?? 32).toFixed(1));
  const co = Number(Math.max(0, aq.current?.carbon_monoxide ?? 410).toFixed(1));
  const temperatureC = Number((weather.current?.temperature_2m ?? 22).toFixed(1));
  const humidityPercent = Math.round(weather.current?.relative_humidity_2m ?? 52);
  const windSpeedKmh = Number(Math.max(0, weather.current?.wind_speed_10m ?? 9.5).toFixed(1));

  const thermalInversionRisk = detectThermalInversion(temperatureC, windSpeedKmh);
  const { inversionReason, recommendedVentilationWindow } = buildVentilationRecommendation(
    usAqi,
    thermalInversionRisk,
    windSpeedKmh,
  );

  return {
    city: cityInput,
    resolvedLocation,
    latitude: location?.latitude ?? 0,
    longitude: location?.longitude ?? 0,
    timestamp: aq.current?.time ?? weather.current?.time ?? new Date().toISOString(),
    usAqi,
    category: classifyUsAqi(usAqi),
    pm25,
    pm10,
    no2,
    co,
    temperatureC,
    humidityPercent,
    windSpeedKmh,
    thermalInversionRisk,
    inversionReason,
    recommendedVentilationWindow,
    source,
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
  resolvedLocation: string;
  latitude: number;
  longitude: number;
  usAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  co: number;
  temperatureC: number;
  humidityPercent: number;
  windSpeedKmh: number;
}

const OFFLINE_METEOROLOGICAL_BASELINES: Record<string, BaselineProfile> = {
  'delhi ncr': {
    resolvedLocation: 'Delhi, National Capital Territory of Delhi, India',
    latitude: 28.6519,
    longitude: 77.2315,
    usAqi: 248,
    pm25: 174.2,
    pm10: 268.5,
    no2: 64.8,
    co: 1120,
    temperatureC: 13.4,
    humidityPercent: 68,
    windSpeedKmh: 5.2,
  },
  delhi: {
    resolvedLocation: 'Delhi, National Capital Territory of Delhi, India',
    latitude: 28.6519,
    longitude: 77.2315,
    usAqi: 248,
    pm25: 174.2,
    pm10: 268.5,
    no2: 64.8,
    co: 1120,
    temperatureC: 13.4,
    humidityPercent: 68,
    windSpeedKmh: 5.2,
  },
  jaipur: {
    resolvedLocation: 'Jaipur, Rajasthan, India',
    latitude: 26.9124,
    longitude: 75.7873,
    usAqi: 158,
    pm25: 69.4,
    pm10: 142.0,
    no2: 41.2,
    co: 680,
    temperatureC: 14.6,
    humidityPercent: 44,
    windSpeedKmh: 6.4,
  },
  bengaluru: {
    resolvedLocation: 'Bengaluru, Karnataka, India',
    latitude: 12.9716,
    longitude: 77.5946,
    usAqi: 74,
    pm25: 22.8,
    pm10: 48.6,
    no2: 29.5,
    co: 410,
    temperatureC: 23.8,
    humidityPercent: 58,
    windSpeedKmh: 12.4,
  },
  mumbai: {
    resolvedLocation: 'Mumbai, Maharashtra, India',
    latitude: 19.076,
    longitude: 72.8777,
    usAqi: 118,
    pm25: 42.5,
    pm10: 88.2,
    no2: 46.1,
    co: 590,
    temperatureC: 27.6,
    humidityPercent: 72,
    windSpeedKmh: 14.8,
  },
};

export function getMeteorologicalBaseline(cityInput: string): AirTelemetry {
  const normalized = cityInput.trim().toLowerCase();
  const known = OFFLINE_METEOROLOGICAL_BASELINES[normalized];

  const baseline: BaselineProfile = known ?? {
    resolvedLocation: cityInput.trim(),
    latitude: 28.6,
    longitude: 77.2,
    usAqi: 112,
    pm25: 39.8,
    pm10: 76.4,
    no2: 36.2,
    co: 520,
    temperatureC: 18.5,
    humidityPercent: 55,
    windSpeedKmh: 9.2,
  };

  return parseOpenMeteoResponses(
    cityInput,
    {
      results: [
        {
          name: baseline.resolvedLocation,
          latitude: baseline.latitude,
          longitude: baseline.longitude,
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
  );
}

/**
 * Fetches live geocoding, air quality, and weather telemetry via keyless Open-Meteo APIs
 * with a strict 5-second AbortController timeout and graceful offline meteorological baseline fallback.
 */
export async function fetchAirAndWeatherTelemetry(cityInput: string): Promise<AirTelemetry> {
  const queryCity = cityInput.replace(/\bNCR\b/gi, '').trim() || cityInput.trim();
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    queryCity,
  )}&count=1&language=en&format=json`;

  try {
    const geoData = await fetchJsonWithTimeout<OpenMeteoGeoResult>(geoUrl);
    const first = geoData.results?.[0];
    if (!first) {
      return getMeteorologicalBaseline(cityInput);
    }

    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${first.latitude}&longitude=${first.longitude}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,carbon_monoxide&timezone=auto`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${first.latitude}&longitude=${first.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`;

    const [aqData, weatherData] = await Promise.all([
      fetchJsonWithTimeout<OpenMeteoAirQualityResult>(aqUrl),
      fetchJsonWithTimeout<OpenMeteoWeatherResult>(weatherUrl),
    ]);

    return parseOpenMeteoResponses(cityInput, geoData, aqData, weatherData, 'open-meteo-live');
  } catch {
    return getMeteorologicalBaseline(cityInput);
  }
}
