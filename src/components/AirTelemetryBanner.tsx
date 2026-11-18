import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudSun,
  Compass,
  Droplets,
  ExternalLink,
  Gauge,
  Globe,
  Thermometer,
  Wind,
} from 'lucide-react';
import {
  SEVERITY_TIER_TOKENS,
  STATUS_ACCESSIBLE_TOKENS,
} from '../styles/accessibleTheme';
import type { AirTelemetry, ScaleOverride } from '../types/airQuality';

interface AirTelemetryBannerProps {
  telemetry: AirTelemetry | null;
  isLoading: boolean;
  scaleOverride?: ScaleOverride;
  onScaleChange?: (scale: ScaleOverride) => void;
}

const SCALE_OPTIONS: Array<{ value: ScaleOverride; label: string }> = [
  { value: 'AUTO', label: 'Auto (Local Standard)' },
  { value: 'IN_CPCB', label: 'India NAQI (CPCB)' },
  { value: 'US_EPA', label: 'US EPA AQI' },
  { value: 'CN_MEE', label: 'China MEE AQI' },
  { value: 'UK_DAQI', label: 'UK DAQI (1–10)' },
  { value: 'EU_EAQI', label: 'European EAQI (1–6)' },
];

export function formatHemisphereCoordinate(
  value: number,
  positiveHemisphere: 'N' | 'E',
  negativeHemisphere: 'S' | 'W',
): string {
  const hemisphere = value >= 0 ? positiveHemisphere : negativeHemisphere;
  return `${Math.abs(value).toFixed(4)}° ${hemisphere}`;
}

export function AirTelemetryBanner({
  telemetry,
  isLoading,
  scaleOverride = 'AUTO',
  onScaleChange,
}: AirTelemetryBannerProps) {
  const [showRawVerification, setShowRawVerification] = useState(false);

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

  const latFormatted = formatHemisphereCoordinate(telemetry.latitude, 'N', 'S');
  const lonFormatted = formatHemisphereCoordinate(telemetry.longitude, 'E', 'W');
  const osmUrl = `https://www.openstreetmap.org/?mlat=${telemetry.latitude.toFixed(
    4,
  )}&mlon=${telemetry.longitude.toFixed(4)}#map=12/${telemetry.latitude.toFixed(
    4,
  )}/${telemetry.longitude.toFixed(4)}`;

  const subIndices = telemetry.pollutantSubIndices ?? [];
  const getConcDisplay = (
    pollutant: 'PM2.5' | 'PM10' | 'NO2' | 'CO' | 'O3' | 'SO2',
    fallbackNum: number,
  ): string => {
    const found = subIndices.find((item) => item.pollutant === pollutant);
    if (found) {
      return found.concentration === null ? 'N/A' : String(found.concentration);
    }
    return String(fallbackNum);
  };

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
            <span className="font-mono tabular-nums">
              {latFormatted}, {lonFormatted}
            </span>
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
            {/* Single AQI value + category label (no X / Y fraction) */}
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

      {/* 6-column calibrated telemetry grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>PM2.5</span>
            <Gauge className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {getConcDisplay('PM2.5', telemetry.pm25)}
            <span className="ml-1 text-xs font-normal text-slate-600">µg/m³</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>PM10</span>
            <Gauge className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {getConcDisplay('PM10', telemetry.pm10)}
            <span className="ml-1 text-xs font-normal text-slate-600">µg/m³</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>NO2</span>
            <CloudSun className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {getConcDisplay('NO2', telemetry.no2)}
            <span className="ml-1 text-xs font-normal text-slate-600">µg/m³</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Temperature</span>
            <Thermometer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {telemetry.temperatureC}
            <span className="ml-1 text-xs font-normal text-slate-600">°C</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Wind Speed</span>
            <Wind className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {telemetry.windSpeedKmh}
            <span className="ml-1 text-xs font-normal text-slate-600">km/h</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Humidity</span>
            <Droplets className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {telemetry.humidityPercent}
            <span className="ml-1 text-xs font-normal text-slate-600">%</span>
          </p>
        </div>
      </div>

      {/* Atmospheric inversion and ventilation timing summary */}
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

      {/* Collapsible Raw Pollutant & Scale Calculation Disclosure */}
      <div className="mt-4 border-t border-slate-200 pt-3">
        <button
          type="button"
          aria-expanded={showRawVerification}
          aria-controls="raw-pollutant-verification-panel"
          onClick={() => setShowRawVerification((prev) => !prev)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F4C81] hover:text-[#0B3A63]"
        >
          {showRawVerification ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
          <span>Verify Raw Pollutants &amp; Scale Calculation</span>
        </button>

        {showRawVerification && (
          <div
            id="raw-pollutant-verification-panel"
            className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-900">
                Sub-Index Calculation under {telemetry.scaleName}
              </p>
              <p className="text-xs text-slate-600">
                Overall index equals the maximum pollutant sub-index ({telemetry.dominantPollutant}:{' '}
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  AQI {telemetry.aqiValue}
                </span>
                ).
              </p>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-3 font-semibold">Pollutant</th>
                    <th className="py-2 pr-3 text-right font-semibold">Raw Concentration</th>
                    <th className="py-2 pr-3 text-right font-semibold">Computed Sub-Index</th>
                    <th className="py-2 font-semibold">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {subIndices.map((row) => (
                    <tr
                      key={row.pollutant}
                      className={`border-b border-slate-200 last:border-b-0 ${
                        row.isDominant ? 'bg-[#EFF6FF] font-semibold text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      <td className="py-2 pr-3 font-mono">{row.pollutant}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {row.concentration === null ? 'N/A' : `${row.concentration} ${row.unit}`}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {row.subIndex === null ? 'N/A (Not indexed)' : row.subIndex}
                      </td>
                      <td className="py-2">
                        {row.isDominant ? (
                          <span className="inline-flex items-center gap-1 text-[#0F4C81]">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Dominant Driver</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Secondary</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Cross-check external monitors:</span>
              <a
                href="https://airquality.cpcb.gov.in/AQI_India/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[#0F4C81] underline decoration-slate-300 underline-offset-2 hover:text-[#0B3A63]"
              >
                <span>CPCB NAQI (India)</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <a
                href="https://aqicn.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[#0F4C81] underline decoration-slate-300 underline-offset-2 hover:text-[#0B3A63]"
              >
                <span>AQICN World Monitor</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <a
                href="https://open-meteo.com/en/docs/air-quality-api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[#0F4C81] underline decoration-slate-300 underline-offset-2 hover:text-[#0B3A63]"
              >
                <span>Open-Meteo Model Docs</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
