import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Globe,
  Wind,
} from 'lucide-react';
import {
  SEVERITY_TIER_TOKENS,
  STATUS_ACCESSIBLE_TOKENS,
} from '../styles/accessibleTheme';
import type { AirTelemetry, ScaleOverride } from '../types/airQuality';
import {
  buildOpenStreetMapUrl,
  formatCoordinatesWithHemisphere,
} from '../utils/formatters';
import { PollutantBreakdownDrawer } from './PollutantBreakdownDrawer';
import { TelemetryMetricGrid } from './TelemetryMetricGrid';

/**
 * Props for {@link AirTelemetryBanner}.
 */
export interface AirTelemetryBannerProps {
  telemetry: AirTelemetry | null;
  isLoading: boolean;
  scaleOverride?: ScaleOverride;
  onScaleChange?: (scale: ScaleOverride) => void;
}

const SCALE_OPTIONS: ReadonlyArray<{ value: ScaleOverride; label: string }> = [
  { value: 'AUTO', label: 'Auto (Local Standard)' },
  { value: 'IN_CPCB', label: 'India NAQI (CPCB)' },
  { value: 'US_EPA', label: 'US EPA AQI' },
  { value: 'CN_MEE', label: 'China MEE AQI' },
  { value: 'UK_DAQI', label: 'UK DAQI (1–10)' },
  { value: 'EU_EAQI', label: 'European EAQI (1–6)' },
];

/**
 * Displays live outdoor air quality, weather physics, thermal inversion status,
 * location-aware AQI scale selector, hemisphere coordinates, and pollutant sub-index
 * verification disclosure.
 *
 * @param props - Live or baseline telemetry snapshot, loading flag, and scale change handler.
 * @returns Accessible telemetry dashboard banner or skeleton state.
 */
export function AirTelemetryBanner({
  telemetry,
  isLoading,
  scaleOverride = 'AUTO',
  onScaleChange,
}: AirTelemetryBannerProps) {
  if (isLoading && !telemetry) {
    return (
      <section
        id="telemetry-section"
        aria-label="Live outdoor air telemetry"
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-56 rounded bg-slate-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!telemetry) {
    return null;
  }

  const severityToken = SEVERITY_TIER_TOKENS[telemetry.severityTier];
  const inversionToken = telemetry.thermalInversionRisk
    ? STATUS_ACCESSIBLE_TOKENS.inversionWarning
    : STATUS_ACCESSIBLE_TOKENS.dispersionClear;
  const offlineNoticeToken = STATUS_ACCESSIBLE_TOKENS.inversionWarning;

  const isElevatedAqi = telemetry.severityTier >= 3;
  const isLive = telemetry.telemetrySource === 'live';

  const coordsFormatted = formatCoordinatesWithHemisphere(
    telemetry.latitude,
    telemetry.longitude,
  );
  const osmUrl = buildOpenStreetMapUrl(telemetry.latitude, telemetry.longitude);

  const subIndices = telemetry.pollutantSubIndices ?? [];

  return (
    <section
      id="telemetry-section"
      aria-labelledby="telemetry-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      {!isLive && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs font-semibold sm:text-sm"
          style={{
            backgroundColor: offlineNoticeToken.background,
            borderColor: offlineNoticeToken.border,
            color: offlineNoticeToken.foreground,
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Offline Baseline Estimate — Live Open-Meteo telemetry could not be reached from this network.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
            <Compass className="h-4 w-4 text-[#0F4C81]" aria-hidden="true" />
            <span className="font-semibold text-slate-800">
              {isLive ? 'Live Telemetry' : 'Offline Baseline'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Observed {telemetry.observedAt}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{coordsFormatted}</span>
            <a
              href={osmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#0F4C81] underline decoration-slate-300 underline-offset-2 hover:text-[#0B3A63]"
            >
              <span>Verify Coordinates</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>

          <h2
            id="telemetry-heading"
            className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
          >
            {telemetry.resolvedLocation}
          </h2>

          <p className="mt-1 text-xs font-medium text-slate-600">
            <span>
              {telemetry.scaleName} ·{' '}
              {telemetry.isAutoSelectedScale ? 'Local Standard' : 'Manual Comparison'}
            </span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span>
              Dominant Pollutant:{' '}
              <strong className="font-mono text-slate-900">{telemetry.dominantPollutant}</strong>
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              data-testid="aqi-status-pill"
              className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold"
              style={{
                backgroundColor: severityToken.background,
                borderColor: severityToken.border,
                color: severityToken.foreground,
              }}
            >
              {isElevatedAqi ? (
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span className="font-mono tabular-nums">AQI {telemetry.aqiValue}</span>
              <span aria-hidden="true">·</span>
              <span>{telemetry.categoryLabel}</span>
            </div>

            <div
              className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold"
              style={{
                backgroundColor: inversionToken.background,
                borderColor: inversionToken.border,
                color: inversionToken.foreground,
              }}
            >
              {telemetry.thermalInversionRisk ? (
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <Wind className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {telemetry.thermalInversionRisk
                  ? 'Thermal Inversion Alert: Trapped Air'
                  : 'Dispersion Active: No Inversion'}
              </span>
            </div>
          </div>

          {onScaleChange && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="aqi-scale-select"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"
              >
                <Globe className="h-3.5 w-3.5 text-[#0F4C81]" aria-hidden="true" />
                <span>AQI Scale</span>
              </label>
              <select
                id="aqi-scale-select"
                value={scaleOverride}
                onChange={(e) => onScaleChange(e.target.value as ScaleOverride)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
              >
                {SCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <TelemetryMetricGrid telemetry={telemetry} subIndices={subIndices} />

      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm text-slate-700 md:grid-cols-2">
        <div>
          <span className="font-semibold text-slate-900">Boundary-Layer Physics: </span>
          <span>{telemetry.inversionReason}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-900">Ventilation Window: </span>
          <span>{telemetry.recommendedVentilationWindow}</span>
        </div>
      </div>

      <PollutantBreakdownDrawer
        scaleName={telemetry.scaleName}
        dominantPollutant={telemetry.dominantPollutant}
        aqiValue={telemetry.aqiValue}
        subIndices={subIndices}
      />
    </section>
  );
}
