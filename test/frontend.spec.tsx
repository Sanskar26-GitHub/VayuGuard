// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { RecommendationCard } from '../src/components/RecommendationCard';
import {
  ACCESSIBLE_SURFACES,
  AQI_ACCESSIBLE_TOKENS,
  calculateWcagContrastRatio,
  SEVERITY_TIER_TOKENS,
  STATUS_ACCESSIBLE_TOKENS,
} from '../src/styles/accessibleTheme';
import type { ActionPlanResponse, RecommendationCardData } from '../src/types/airQuality';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockPlanResponse: ActionPlanResponse = {
  telemetry: {
    city: 'Delhi, India',
    cityWithCountry: 'Delhi, India',
    resolvedLocation: 'Delhi, National Capital Territory of Delhi, India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 28.65,
    longitude: 77.23,
    timestamp: '2026-11-18T13:30',
    observedAt: 'Nov 18, 2026, 1:30 PM IST',
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
    pollutantSubIndices: [
      { pollutant: 'PM2.5', concentration: 174.2, unit: 'µg/m³', subIndex: 342, isDominant: true },
      { pollutant: 'PM10', concentration: 268.5, unit: 'µg/m³', subIndex: 219, isDominant: false },
      { pollutant: 'NO2', concentration: 64.8, unit: 'µg/m³', subIndex: 81, isDominant: false },
      { pollutant: 'CO', concentration: 1.12, unit: 'mg/m³', subIndex: 56, isDominant: false },
      { pollutant: 'O3', concentration: 42.0, unit: 'µg/m³', subIndex: 42, isDominant: false },
      { pollutant: 'SO2', concentration: null, unit: 'µg/m³', subIndex: null, isDominant: false },
    ],
    pm25: 174.2,
    pm10: 268.5,
    no2: 64.8,
    co: 1120,
    o3: 42.0,
    so2: 0,
    temperatureC: 13.4,
    humidityPercent: 68,
    windSpeedKmh: 5.2,
    thermalInversionRisk: true,
    inversionReason: 'Cool surface air (< 15°C) with calm winds (< 8 km/h).',
    recommendedVentilationWindow: 'Keep windows sealed; brief midday airing only.',
    source: 'open-meteo-live',
    telemetrySource: 'live',
  },
  dailyBriefing: 'Thermal inversion is trapping PM2.5 near street level.',
  ventilationGuidance: 'Keep windows sealed during morning and evening peaks.',
  recommendations: [
    {
      id: 'rec-1',
      pillar: 'low_emission_routines',
      pillarLabel: 'Pillar 1 · Low-Emission Daily Routines',
      title: 'Shift commuter trips to metro',
      actionSummary: 'Avoid solo cold-start engine trips.',
      whyAndDirectImpact: {
        mechanism: 'Cuts street-level NO2 emissions.',
        pm25ReductionPercent: 22,
        co2SavedKgPerDay: 2.1,
        costTier: 'Free',
        effortLevel: 'Daily Routine',
        groundedMetricRef: 'India NAQI (CPCB) 342/500 and NO2 64.8 µg/m³.',
      },
    },
    {
      id: 'rec-2',
      pillar: 'iaq_hacks',
      pillarLabel: 'Pillar 2 · Indoor Air Quality (IAQ) Hacks',
      title: 'Wet mop floors nightly',
      actionSummary: 'Binds settled coarse dust without resuspension.',
      whyAndDirectImpact: {
        mechanism: 'Prevents PM10 resuspension.',
        pm25ReductionPercent: 24,
        co2SavedKgPerDay: 0.12,
        costTier: 'Free',
        effortLevel: 'Daily Routine',
        groundedMetricRef: 'PM10 268.5 µg/m³.',
      },
    },
  ],
  metadata: {
    modelUsed: 'gemini-4-hydrogen',
    cached: false,
    fallbackTriggered: false,
    generatedAt: '2026-11-18T08:00:00Z',
    groundingAdjustmentsCount: 0,
  },
};

describe('WCAG 2.1 AA/AAA Contrast Token Validation', () => {
  it('verifies every theme color pair satisfies its documented contrast ratio (>= 4.5:1)', () => {
    const allTokens = [
      ...Object.values(ACCESSIBLE_SURFACES),
      ...Object.values(AQI_ACCESSIBLE_TOKENS),
      ...Object.values(SEVERITY_TIER_TOKENS),
      ...Object.values(STATUS_ACCESSIBLE_TOKENS),
    ];

    for (const token of allTokens) {
      const computed = calculateWcagContrastRatio(token.foreground, token.background);
      expect(computed).toBeGreaterThanOrEqual(4.5);
      if (token.wcagLevel === 'AAA') {
        expect(computed).toBeGreaterThanOrEqual(7.0);
      }
    }
  });
});

describe('Keyboard Navigation, Empty Initial State & Semantic Landmarks', () => {
  it('supports Enter and Space keyboard activation on RecommendationCard adoption checkbox', () => {
    const rec: RecommendationCardData = mockPlanResponse.recommendations[0];
    const onToggle = vi.fn();

    render(<RecommendationCard recommendation={rec} adopted={false} onToggleAdopt={onToggle} />);

    const checkboxBtn = screen.getByRole('checkbox', { name: /Adopt action:/i });
    expect(checkboxBtn).toHaveAttribute('aria-checked', 'false');

    fireEvent.keyDown(checkboxBtn, { key: 'Enter' });
    fireEvent.keyDown(checkboxBtn, { key: ' ' });
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenCalledWith('rec-1');
  });

  it('starts with an empty form, fires zero network requests on mount, and validates missing fields', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<App />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText(/Skip to main content/i)).toBeInTheDocument();

    expect((screen.getByLabelText(/City & Country/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Home Ventilation Setup/i) as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText(/Primary Cooking Fuel/i) as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText(/Primary Daily Commute/i) as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText(/HEPA Air Purifier Availability/i) as HTMLSelectElement).value).toBe('');
    expect(screen.getByText(/Configure Your Household Profile to Start/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Submitting blank form displays accessible inline validation errors
    fireEvent.click(screen.getByRole('button', { name: /Generate Personalized Daily Plan/i }));
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(4);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders single AQI pill, 4-decimal hemisphere coordinates, local time, and verification disclosure after submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/geocode')) {
          return {
            ok: true,
            json: async () => ({ results: [] }),
          };
        }
        return {
          ok: true,
          json: async () => mockPlanResponse,
        };
      }),
    );

    render(<App />);

    fireEvent.change(screen.getByLabelText(/City & Country/i), {
      target: { value: 'Delhi, India' },
    });
    fireEvent.change(screen.getByLabelText(/Home Ventilation Setup/i), {
      target: { value: 'cross_ventilation' },
    });
    fireEvent.change(screen.getByLabelText(/Primary Cooking Fuel/i), {
      target: { value: 'lpg' },
    });
    fireEvent.change(screen.getByLabelText(/Primary Daily Commute/i), {
      target: { value: 'metro_bus' },
    });
    fireEvent.change(screen.getByLabelText(/HEPA Air Purifier Availability/i), {
      target: { value: 'no' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Generate Personalized Daily Plan/i }));

    await waitFor(() => {
      expect(screen.getByText(/Shift commuter trips to metro/i)).toBeInTheDocument();
    });

    // Single AQI value without "/ 500" fraction in status pill
    const pill = screen.getByTestId('aqi-status-pill');
    expect(pill.textContent).toContain('AQI 342');
    expect(pill.textContent).toContain('Very Poor');
    expect(pill.textContent).not.toContain('342 / 500');

    // 4-decimal hemisphere coordinates + local observation time
    expect(screen.getByText(/28\.6500° N, 77\.2300° E/)).toBeInTheDocument();
    expect(screen.getByText(/Observed Nov 18, 2026, 1:30 PM IST/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Verify Coordinates/i })).toBeInTheDocument();

    // Collapsible verification table
    const toggleBtn = screen.getByRole('button', {
      name: /Verify Raw Pollutants & Scale Calculation/i,
    });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/174\.2 µg\/m³/)).toBeInTheDocument();

    const liveRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions.length).toBeGreaterThan(0);
    expect(liveRegions[0].textContent).toContain('India NAQI (CPCB), AQI 342, Very Poor');
    expect(screen.getByText(/Thermal Inversion Alert: Trapped Air/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/AQI Scale/i)).toBeInTheDocument();
  });
});
