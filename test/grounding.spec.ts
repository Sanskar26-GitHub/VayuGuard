import { describe, expect, it } from 'vitest';
import { verifyAndGroundRecommendations } from '../server/services/groundingService';
import type { AirTelemetry, RecommendationCardData } from '../src/types/airQuality';
import { computeCommunityImpact } from '../src/utils/impactMath';

describe('Programmatic Grounding & Bounds Verifier', () => {
  const telemetry: AirTelemetry = {
    city: 'Delhi, India',
    cityWithCountry: 'Delhi, India',
    resolvedLocation: 'Delhi, India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 28.65,
    longitude: 77.23,
    timestamp: '2026-11-17T08:00',
    observedAt: 'Nov 17, 2026, 8:00 AM IST',
    usAqi: 248,
    category: 'Very Unhealthy',
    aqiValue: 342,
    scaleMax: 500,
    scaleCode: 'IN_CPCB',
    scaleName: 'India NAQI (CPCB)',
    categoryLabel: 'Very Poor',
    severityTier: 5,
    dominantPollutant: 'PM2.5',
    isAutoSelectedScale: true,
    pollutantSubIndices: [],
    pm25: 174.2,
    pm10: 268.5,
    no2: 64.8,
    co: 1120,
    o3: 42.0,
    so2: 18.5,
    temperatureC: 13.4,
    humidityPercent: 68,
    windSpeedKmh: 5.2,
    thermalInversionRisk: true,
    inversionReason: 'Cool calm inversion',
    recommendedVentilationWindow: 'Keep sealed',
    source: 'open-meteo-live',
    telemetrySource: 'live',
  };

  it('clamps hallucinated CO2e savings to [0.05, 15.0] and PM2.5 reduction to [1, 85]', () => {
    const unverified: RecommendationCardData[] = [
      {
        id: 'outlier-high',
        pillar: 'iaq_hacks',
        pillarLabel: 'Pillar 2',
        title: 'Run HEPA filter',
        actionSummary: 'Continuous filtration',
        whyAndDirectImpact: {
          mechanism: 'HEPA captures fine particulates.',
          pm25ReductionPercent: 99.5, // Unrealistic > 85%
          co2SavedKgPerDay: 140.0, // Unrealistic > 15.0 kg/day
          costTier: 'Equipment',
          effortLevel: 'One-Time Setup',
          groundedMetricRef: 'Unrelated generic claim without numbers',
        },
      },
      {
        id: 'outlier-low',
        pillar: 'low_emission_routines',
        pillarLabel: 'Pillar 1',
        title: 'Turn off idling car',
        actionSummary: 'Cut engine at red lights',
        whyAndDirectImpact: {
          mechanism: 'Reduces tailpipe NO2.',
          pm25ReductionPercent: 0, // Below 1%
          co2SavedKgPerDay: 0.001, // Below 0.05
          costTier: 'Free',
          effortLevel: '2-Min Habit',
          groundedMetricRef: 'Grounded in India NAQI (CPCB) 342/500 and NO2 64.8 µg/m³.',
        },
      },
    ];

    const result = verifyAndGroundRecommendations(unverified, telemetry);
    expect(result.adjustmentsCount).toBe(2);

    expect(result.recommendations[0].whyAndDirectImpact.pm25ReductionPercent).toBe(85);
    expect(result.recommendations[0].whyAndDirectImpact.co2SavedKgPerDay).toBe(15);
    expect(result.recommendations[0].groundingAdjusted).toBe(true);
    expect(result.recommendations[0].whyAndDirectImpact.groundedMetricRef).toContain(
      'India NAQI (CPCB) 342/500',
    );

    expect(result.recommendations[1].whyAndDirectImpact.pm25ReductionPercent).toBe(1);
    expect(result.recommendations[1].whyAndDirectImpact.co2SavedKgPerDay).toBe(0.05);
    expect(result.recommendations[1].groundingAdjusted).toBe(true);
  });
});

describe('Community Impact Simulator Math', () => {
  const telemetry: AirTelemetry = {
    city: 'Mumbai, India',
    cityWithCountry: 'Mumbai, India',
    resolvedLocation: 'Mumbai, India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 19.07,
    longitude: 72.87,
    timestamp: '2026-11-17T08:00',
    observedAt: 'Nov 17, 2026, 8:00 AM IST',
    usAqi: 120,
    category: 'Unhealthy for Sensitive Groups',
    aqiValue: 88,
    scaleMax: 500,
    scaleCode: 'IN_CPCB',
    scaleName: 'India NAQI (CPCB)',
    categoryLabel: 'Satisfactory',
    severityTier: 2,
    dominantPollutant: 'PM10',
    isAutoSelectedScale: true,
    pollutantSubIndices: [],
    pm25: 45.0,
    pm10: 88.0,
    no2: 46.0,
    co: 580,
    o3: 49.0,
    so2: 12.2,
    temperatureC: 27.0,
    humidityPercent: 72,
    windSpeedKmh: 14.0,
    thermalInversionRisk: false,
    inversionReason: 'Dispersion active',
    recommendedVentilationWindow: 'Ventilate midday',
    source: 'open-meteo-live',
    telemetrySource: 'live',
  };

  const sampleRecs: RecommendationCardData[] = [
    {
      id: 'a1',
      pillar: 'low_emission_routines',
      pillarLabel: 'Pillar 1',
      title: 'Shift commute',
      actionSummary: 'Take metro',
      whyAndDirectImpact: {
        mechanism: 'Cuts tailpipe emissions',
        pm25ReductionPercent: 20,
        co2SavedKgPerDay: 2.0,
        costTier: 'Free',
        effortLevel: 'Daily Routine',
        groundedMetricRef: 'US AQI 120',
      },
    },
    {
      id: 'a2',
      pillar: 'iaq_hacks',
      pillarLabel: 'Pillar 2',
      title: 'HEPA filtration',
      actionSummary: 'Run purifier',
      whyAndDirectImpact: {
        mechanism: 'Captures PM2.5',
        pm25ReductionPercent: 60,
        co2SavedKgPerDay: 0.5,
        costTier: 'Equipment',
        effortLevel: 'One-Time Setup',
        groundedMetricRef: 'PM2.5 45.0 µg/m³',
      },
    },
  ];

  it('scales CO2e linearly from 1 to 1,000 households and bounds PM2.5 reduction', () => {
    const adopted = new Set(['a1', 'a2']);
    const single = computeCommunityImpact(
      sampleRecs,
      adopted,
      1,
      telemetry,
      'cross_ventilation',
      false,
    );
    const district = computeCommunityImpact(
      sampleRecs,
      adopted,
      1000,
      telemetry,
      'cross_ventilation',
      false,
    );

    expect(single.dailyCo2SavedPerHouseholdKg).toBe(2.5);
    expect(single.monthlyCo2SavedPerHouseholdKg).toBe(75);
    expect(district.monthlyCommunityCo2SavedKg).toBe(75000);
    expect(district.annualCommunityCo2SavedTonnes).toBe(900);
    expect(single.combinedIndoorPm25ReductionPercent).toBeGreaterThan(0);
    expect(single.combinedIndoorPm25ReductionPercent).toBeLessThanOrEqual(85);
    expect(single.estimatedIndoorPm25AfterAction).toBeLessThan(single.baselineIndoorPm25);
  });

  it('returns zero impact when no recommendations are adopted', () => {
    const empty = computeCommunityImpact(
      sampleRecs,
      new Set(),
      100,
      telemetry,
      'sealed_ac',
      true,
    );
    expect(empty.adoptedCount).toBe(0);
    expect(empty.combinedIndoorPm25ReductionPercent).toBe(0);
    expect(empty.monthlyCommunityCo2SavedKg).toBe(0);
  });
});
