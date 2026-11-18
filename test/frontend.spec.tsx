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
    city: 'Delhi NCR',
    resolvedLocation: 'Delhi, National Capital Territory of Delhi, India',
    countryCode: 'IN',
    latitude: 28.65,
    longitude: 77.23,
    timestamp: '2026-11-17T08:00',
    observedAt: '2026-11-17T08:00',
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
    generatedAt: '2026-11-17T08:00:00Z',
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

describe('Keyboard Navigation & Semantic Landmarks', () => {
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

  it('renders semantic landmarks, skip link, scale selector, and aria-live announcements in App', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => mockPlanResponse,
      })),
    );

    render(<App />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText(/Skip to main content/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Shift commuter trips to metro/i)).toBeInTheDocument();
    });

    const liveRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions.length).toBeGreaterThan(0);
    expect(liveRegions[0].textContent).toContain('India NAQI (CPCB) 342 out of 500');
    expect(screen.getByText(/Thermal Inversion Alert: Trapped Air/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/AQI Scale/i)).toBeInTheDocument();
  });
});
