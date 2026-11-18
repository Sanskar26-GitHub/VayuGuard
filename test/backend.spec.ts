import { describe, expect, it } from 'vitest';
import {
  BoundedLruCache,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_MEMORY_BYTES,
  hashNormalizedPayload,
} from '../server/services/cacheService';
import { generateParametricFallbackPlan } from '../server/services/fallbackPlanService';
import {
  sanitizeProfile,
  sanitizeQuestion,
  stripControlChars,
  truncateText,
  ValidationError,
} from '../server/services/sanitizationService';
import {
  classifyUsAqi,
  detectThermalInversion,
  parseOpenMeteoResponses,
} from '../server/services/weatherAirService';
import type { AirTelemetry, HouseholdProfile } from '../src/types/airQuality';

describe('Input Sanitization Service', () => {
  it('strips control characters and normalizes whitespace', () => {
    const dirty = 'Delhi\u0000\u0007\n\t   NCR\u001F';
    expect(stripControlChars(dirty)).toBe('Delhi NCR');
  });

  it('truncates oversized strings cleanly', () => {
    const longText = 'a'.repeat(500);
    expect(truncateText(longText, 80).length).toBe(80);
  });

  it('validates and normalizes HouseholdProfile enums and throws on empty city', () => {
    expect(() => sanitizeProfile({ city: ' ' })).toThrow(ValidationError);

    const sanitized = sanitizeProfile({
      city: '  Jaipur  ',
      ventilationType: 'invalid_type',
      hasAirPurifier: 1,
      cookingFuel: 'electric_induction',
      commuteMode: 'car_solo',
      sensitiveGroups: ['children', 'children', 'not_valid'],
      lifestyleNotes: 'Near busy junction',
    });

    expect(sanitized.city).toBe('Jaipur');
    expect(sanitized.ventilationType).toBe('cross_ventilation');
    expect(sanitized.hasAirPurifier).toBe(true);
    expect(sanitized.cookingFuel).toBe('electric_induction');
    expect(sanitized.commuteMode).toBe('car_solo');
    expect(sanitized.sensitiveGroups).toEqual(['children']);
  });

  it('rejects overly short Q&A questions', () => {
    expect(() => sanitizeQuestion('hi')).toThrow(ValidationError);
    expect(sanitizeQuestion('Should I open windows?')).toBe('Should I open windows?');
  });
});

describe('Bounded SHA-256 LRU Cache', () => {
  it('generates identical SHA-256 keys regardless of object property order or casing', () => {
    const k1 = hashNormalizedPayload({ city: 'Delhi NCR', a: 1, b: 2 });
    const k2 = hashNormalizedPayload({ b: 2, a: 1, city: '  delhi ncr ' });
    expect(k1).toBe(k2);
    expect(k1).toHaveLength(64);
  });

  it('enforces MAX_ENTRIES (250) and evicts least-recently-used entries', () => {
    const cache = new BoundedLruCache<{ id: number }>();
    expect(cache.getStats().maxEntries).toBe(DEFAULT_MAX_ENTRIES);
    expect(cache.getStats().maxMemoryBytes).toBe(DEFAULT_MAX_MEMORY_BYTES);

    for (let i = 0; i < DEFAULT_MAX_ENTRIES + 25; i += 1) {
      cache.set(`key-${i}`, { id: i });
    }

    const stats = cache.getStats();
    expect(stats.entries).toBe(DEFAULT_MAX_ENTRIES);
    expect(stats.evictions).toBe(25);
    expect(cache.get('key-0')).toBeUndefined();
    expect(cache.get(`key-${DEFAULT_MAX_ENTRIES + 24}`)).toEqual({
      id: DEFAULT_MAX_ENTRIES + 24,
    });
  });

  it('enforces MAX_MEMORY_BYTES ceiling by evicting oldest entries', () => {
    const smallByteLimit = 1024;
    const cache = new BoundedLruCache<{ payload: string }>({
      maxEntries: 250,
      maxMemoryBytes: smallByteLimit,
    });

    for (let i = 0; i < 20; i += 1) {
      cache.set(`k-${i}`, { payload: 'x'.repeat(200) });
    }

    const stats = cache.getStats();
    expect(stats.memoryBytes).toBeLessThanOrEqual(smallByteLimit);
    expect(stats.evictions).toBeGreaterThan(0);
  });
});

describe('Open-Meteo Parsing & Thermal Inversion Detector', () => {
  it('classifies US AQI categories accurately across bands', () => {
    expect(classifyUsAqi(32)).toBe('Good');
    expect(classifyUsAqi(78)).toBe('Moderate');
    expect(classifyUsAqi(125)).toBe('Unhealthy for Sensitive Groups');
    expect(classifyUsAqi(178)).toBe('Unhealthy');
    expect(classifyUsAqi(245)).toBe('Very Unhealthy');
    expect(classifyUsAqi(360)).toBe('Hazardous');
  });

  it('detects thermal inversion only when temp < 15°C AND wind < 8 km/h', () => {
    expect(detectThermalInversion(12.5, 5.4)).toBe(true);
    expect(detectThermalInversion(12.5, 9.2)).toBe(false);
    expect(detectThermalInversion(18.0, 4.0)).toBe(false);
  });

  it('parses Open-Meteo geocoding, air-quality, and weather payloads cleanly', () => {
    const telemetry = parseOpenMeteoResponses(
      'Lucknow',
      {
        results: [
          {
            name: 'Lucknow',
            admin1: 'Uttar Pradesh',
            country: 'India',
            latitude: 26.8467,
            longitude: 80.9462,
          },
        ],
      },
      {
        current: {
          time: '2026-11-17T08:00',
          us_aqi: 192,
          pm2_5: 118.4,
          pm10: 189.2,
          nitrogen_dioxide: 54.6,
          carbon_monoxide: 880,
        },
      },
      {
        current: {
          time: '2026-11-17T08:00',
          temperature_2m: 13.8,
          relative_humidity_2m: 64,
          wind_speed_10m: 5.1,
        },
      },
    );

    expect(telemetry.resolvedLocation).toBe('Lucknow, Uttar Pradesh, India');
    expect(telemetry.usAqi).toBe(192);
    expect(telemetry.category).toBe('Unhealthy');
    expect(telemetry.thermalInversionRisk).toBe(true);
    expect(telemetry.pm25).toBe(118.4);
  });
});

describe('Dynamic Parametric Fallback Plan Generator', () => {
  const baseProfile: HouseholdProfile = {
    city: 'Pune',
    ventilationType: 'cross_ventilation',
    hasAirPurifier: false,
    cookingFuel: 'lpg',
    commuteMode: 'car_solo',
    sensitiveGroups: ['children'],
  };

  const makeTelemetry = (overrides: Partial<AirTelemetry>): AirTelemetry => ({
    city: 'Pune',
    resolvedLocation: 'Pune, Maharashtra, India',
    latitude: 18.52,
    longitude: 73.85,
    timestamp: '2026-11-17T10:00',
    usAqi: 42,
    category: 'Good',
    pm25: 10.2,
    pm10: 22.0,
    no2: 18.5,
    co: 310,
    temperatureC: 24.5,
    humidityPercent: 50,
    windSpeedKmh: 12.0,
    thermalInversionRisk: false,
    inversionReason: 'Atmospheric mixing is favorable.',
    recommendedVentilationWindow: 'Cross-ventilate freely.',
    source: 'open-meteo-live',
    ...overrides,
  });

  it('adapts dynamically across Good, Moderate, and Severe AQI bands without hardcoded cities', () => {
    const goodPlan = generateParametricFallbackPlan(
      { ...baseProfile, sensitiveGroups: [] },
      makeTelemetry({ city: 'Testopolis', usAqi: 38, category: 'Good', pm25: 9.5 }),
    );
    const moderatePlan = generateParametricFallbackPlan(
      baseProfile,
      makeTelemetry({ city: 'Testopolis', usAqi: 84, category: 'Moderate', pm25: 27.4 }),
    );
    const severePlan = generateParametricFallbackPlan(
      { ...baseProfile, hasAirPurifier: true, cookingFuel: 'biomass_solid' },
      makeTelemetry({
        city: 'Testopolis',
        usAqi: 268,
        category: 'Very Unhealthy',
        pm25: 194.0,
        temperatureC: 11.2,
        windSpeedKmh: 4.3,
        thermalInversionRisk: true,
      }),
    );

    expect(goodPlan.dailyBriefing).toContain('Testopolis');
    expect(goodPlan.dailyBriefing).not.toContain('Delhi');
    expect(moderatePlan.recommendations.length).toBeGreaterThanOrEqual(6);
    expect(severePlan.recommendations.length).toBeGreaterThan(goodPlan.recommendations.length);

    const goodPillars = new Set(goodPlan.recommendations.map((r) => r.pillar));
    expect(goodPillars).toEqual(
      new Set(['low_emission_routines', 'iaq_hacks', 'sustainable_alternatives']),
    );
    expect(severePlan.dailyBriefing).toContain('thermal inversion');
  });
});
