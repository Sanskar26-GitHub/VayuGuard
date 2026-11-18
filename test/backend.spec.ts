import { describe, expect, it } from 'vitest';
import {
  BoundedLruCache,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_MEMORY_BYTES,
  hashNormalizedPayload,
} from '../server/services/cacheService';
import { generateParametricFallbackPlan } from '../server/services/fallbackPlanService';
import {
  computeRegionalAqi,
  resolveRegionalScaleForCountry,
} from '../server/services/regionalAqiService';
import {
  sanitizeProfile,
  sanitizeQuestion,
  sanitizeScaleOverride,
  stripControlChars,
  truncateText,
  ValidationError,
} from '../server/services/sanitizationService';
import {
  classifyUsAqi,
  detectThermalInversion,
  parseOpenMeteoResponses,
  selectTopGeocodingMatch,
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

  it('validates and normalizes HouseholdProfile enums and scaleOverride, throwing on empty city', () => {
    expect(() => sanitizeProfile({ city: ' ' })).toThrow(ValidationError);

    const sanitized = sanitizeProfile({
      city: '  Jaipur  ',
      ventilationType: 'invalid_type',
      hasAirPurifier: 1,
      cookingFuel: 'electric_induction',
      commuteMode: 'car_solo',
      sensitiveGroups: ['children', 'children', 'not_valid'],
      lifestyleNotes: 'Near busy junction',
      scaleOverride: 'UK_DAQI',
    });

    expect(sanitized.city).toBe('Jaipur');
    expect(sanitized.ventilationType).toBe('cross_ventilation');
    expect(sanitized.hasAirPurifier).toBe(true);
    expect(sanitized.cookingFuel).toBe('electric_induction');
    expect(sanitized.commuteMode).toBe('car_solo');
    expect(sanitized.sensitiveGroups).toEqual(['children']);
    expect(sanitized.scaleOverride).toBe('UK_DAQI');
    expect(sanitizeScaleOverride('invalid_scale')).toBe('AUTO');
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

describe('Location-Aware Regional AQI Scale Engine & Geocoding Priority', () => {
  it('resolves governing AQI standards from ISO country codes', () => {
    expect(resolveRegionalScaleForCountry('IN')).toBe('IN_CPCB');
    expect(resolveRegionalScaleForCountry('US')).toBe('US_EPA');
    expect(resolveRegionalScaleForCountry('CN')).toBe('CN_MEE');
    expect(resolveRegionalScaleForCountry('GB')).toBe('UK_DAQI');
    expect(resolveRegionalScaleForCountry('DE')).toBe('EU_EAQI');
    expect(resolveRegionalScaleForCountry('FR')).toBe('EU_EAQI');
    expect(resolveRegionalScaleForCountry('CA')).toBe('US_EPA');
  });

  it('computes distinct official scales from identical raw pollutants and honors manual overrides', () => {
    const samplePollutants = {
      pm25: 42.0,
      pm10: 85.0,
      no2: 45.0,
      co: 650,
      o3: 55.0,
      so2: 12.0,
    };

    const india = computeRegionalAqi(samplePollutants, 'IN', 'AUTO');
    expect(india.scaleCode).toBe('IN_CPCB');
    expect(india.scaleMax).toBe(500);
    expect(india.categoryLabel).toBe('Satisfactory');
    expect(india.severityTier).toBe(2);
    expect(india.dominantPollutant).toBe('PM10');
    expect(india.isAutoSelectedScale).toBe(true);

    const us = computeRegionalAqi(samplePollutants, 'US', 'AUTO');
    expect(us.scaleCode).toBe('US_EPA');
    expect(us.scaleMax).toBe(500);
    expect(us.categoryLabel).toBe('Unhealthy for Sensitive Groups');
    expect(us.severityTier).toBe(3);
    expect(us.dominantPollutant).toBe('PM2.5');
    expect(us.isAutoSelectedScale).toBe(true);

    const china = computeRegionalAqi(samplePollutants, 'CN', 'AUTO');
    expect(china.scaleCode).toBe('CN_MEE');
    expect(china.scaleMax).toBe(500);
    expect(china.categoryLabel).toBe('Good');
    expect(china.severityTier).toBe(2);

    const uk = computeRegionalAqi(samplePollutants, 'GB', 'AUTO');
    expect(uk.scaleCode).toBe('UK_DAQI');
    expect(uk.scaleMax).toBe(10);
    expect(uk.aqiValue).toBe(8);
    expect(uk.categoryLabel).toBe('High');
    expect(uk.severityTier).toBe(5);
    expect(uk.dominantPollutant).toBe('PM10');

    const eu = computeRegionalAqi(samplePollutants, 'DE', 'AUTO');
    expect(eu.scaleCode).toBe('EU_EAQI');
    expect(eu.scaleMax).toBe(6);
    expect(eu.aqiValue).toBe(4);
    expect(eu.categoryLabel).toBe('Poor');
    expect(eu.severityTier).toBe(4);

    // Manual override flags isAutoSelectedScale as false
    const manualComparison = computeRegionalAqi(samplePollutants, 'IN', 'UK_DAQI');
    expect(manualComparison.scaleCode).toBe('UK_DAQI');
    expect(manualComparison.isAutoSelectedScale).toBe(false);
    expect(manualComparison.scaleMax).toBe(10);
  });

  it('prioritizes highest-population geocoding match (e.g., Chicago, IL over small homonyms)', () => {
    const match = selectTopGeocodingMatch([
      {
        name: 'Chicago',
        admin1: 'Kansas',
        country: 'United States',
        country_code: 'US',
        latitude: 38.12,
        longitude: -95.4,
        population: 120,
      },
      {
        name: 'Chicago',
        admin1: 'Illinois',
        country: 'United States',
        country_code: 'US',
        latitude: 41.85,
        longitude: -87.65,
        population: 2746388,
      },
      {
        name: 'Chicago',
        admin1: 'Eastern Cape',
        country: 'South Africa',
        country_code: 'ZA',
        latitude: -32.4,
        longitude: 26.8,
        population: 850,
      },
    ]);

    expect(match?.admin1).toBe('Illinois');
    expect(match?.population).toBe(2746388);
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

  it('parses Open-Meteo geocoding, current air-quality, and current weather payloads cleanly', () => {
    const telemetry = parseOpenMeteoResponses(
      'Lucknow',
      {
        results: [
          {
            name: 'Lucknow',
            admin1: 'Uttar Pradesh',
            country: 'India',
            country_code: 'IN',
            latitude: 26.8467,
            longitude: 80.9462,
            population: 2817105,
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
          ozone: 48.0,
          sulphur_dioxide: 12.0,
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
    expect(telemetry.countryCode).toBe('IN');
    expect(telemetry.scaleCode).toBe('IN_CPCB');
    expect(telemetry.scaleName).toBe('India NAQI (CPCB)');
    expect(telemetry.scaleMax).toBe(500);
    expect(telemetry.aqiValue).toBe(295);
    expect(telemetry.categoryLabel).toBe('Poor');
    expect(telemetry.dominantPollutant).toBe('PM2.5');
    expect(telemetry.isAutoSelectedScale).toBe(true);
    expect(telemetry.observedAt).toBe('2026-11-17T08:00');
    expect(telemetry.telemetrySource).toBe('live');
    expect(telemetry.usAqi).toBe(192);
    expect(telemetry.category).toBe('Unhealthy');
    expect(telemetry.thermalInversionRisk).toBe(true);
    expect(telemetry.pm25).toBe(118.4);
    expect(telemetry.o3).toBe(48.0);
    expect(telemetry.so2).toBe(12.0);
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
    countryCode: 'IN',
    latitude: 18.52,
    longitude: 73.85,
    timestamp: '2026-11-17T10:00',
    observedAt: '2026-11-17T10:00',
    usAqi: 42,
    category: 'Good',
    aqiValue: 34,
    scaleMax: 500,
    scaleCode: 'IN_CPCB',
    scaleName: 'India NAQI (CPCB)',
    categoryLabel: 'Good',
    severityTier: 1,
    dominantPollutant: 'PM2.5',
    isAutoSelectedScale: true,
    pm25: 10.2,
    pm10: 22.0,
    no2: 18.5,
    co: 310,
    o3: 42.0,
    so2: 8.0,
    temperatureC: 24.5,
    humidityPercent: 50,
    windSpeedKmh: 12.0,
    thermalInversionRisk: false,
    inversionReason: 'Atmospheric mixing is favorable.',
    recommendedVentilationWindow: 'Cross-ventilate freely.',
    source: 'open-meteo-live',
    telemetrySource: 'live',
    ...overrides,
  });

  it('adapts dynamically across Good, Moderate, and Severe AQI bands without hardcoded cities', () => {
    const goodPlan = generateParametricFallbackPlan(
      { ...baseProfile, sensitiveGroups: [] },
      makeTelemetry({
        city: 'Testopolis',
        usAqi: 38,
        category: 'Good',
        aqiValue: 32,
        categoryLabel: 'Good',
        severityTier: 1,
        pm25: 9.5,
      }),
    );
    const moderatePlan = generateParametricFallbackPlan(
      baseProfile,
      makeTelemetry({
        city: 'Testopolis',
        usAqi: 84,
        category: 'Moderate',
        aqiValue: 82,
        categoryLabel: 'Satisfactory',
        severityTier: 2,
        pm25: 27.4,
      }),
    );
    const severePlan = generateParametricFallbackPlan(
      { ...baseProfile, hasAirPurifier: true, cookingFuel: 'biomass_solid' },
      makeTelemetry({
        city: 'Testopolis',
        usAqi: 268,
        category: 'Very Unhealthy',
        aqiValue: 356,
        categoryLabel: 'Very Poor',
        severityTier: 5,
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
