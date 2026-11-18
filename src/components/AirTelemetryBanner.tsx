import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudSun,
  Compass,
  Droplets,
  Gauge,
  Thermometer,
  Wind,
} from 'lucide-react';
import {
  AQI_ACCESSIBLE_TOKENS,
  STATUS_ACCESSIBLE_TOKENS,
} from '../styles/accessibleTheme';
import type { AirTelemetry } from '../types/airQuality';

interface AirTelemetryBannerProps {
  telemetry: AirTelemetry | null;
  isLoading: boolean;
}

export function AirTelemetryBanner({ telemetry, isLoading }: AirTelemetryBannerProps) {
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

  const aqiToken = AQI_ACCESSIBLE_TOKENS[telemetry.category];
  const inversionToken = telemetry.thermalInversionRisk
    ? STATUS_ACCESSIBLE_TOKENS.inversionWarning
    : STATUS_ACCESSIBLE_TOKENS.dispersionClear;

  const isElevatedAqi =
    telemetry.category !== 'Good' && telemetry.category !== 'Moderate';

  return (
    <section
      id="telemetry-section"
      aria-labelledby="telemetry-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
            <Compass className="h-4 w-4 text-[#0F4C81]" aria-hidden="true" />
            <span>
              {telemetry.source === 'open-meteo-live'
                ? 'Live Open-Meteo Telemetry'
                : 'Meteorological Baseline Telemetry'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {telemetry.latitude.toFixed(2)}°N, {telemetry.longitude.toFixed(2)}°E
            </span>
          </div>
          <h2
            id="telemetry-heading"
            className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
          >
            {telemetry.resolvedLocation}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status indicator always pairs icon + text label (never hue alone) */}
          <div
            className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold"
            style={{
              backgroundColor: aqiToken.background,
              borderColor: aqiToken.border,
              color: aqiToken.foreground,
            }}
          >
            {isElevatedAqi ? (
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="font-mono tabular-nums">US AQI {telemetry.usAqi}</span>
            <span aria-hidden="true">·</span>
            <span>{telemetry.category}</span>
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
      </div>

      {/* 6-column calibrated telemetry grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>PM2.5</span>
            <Gauge className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {telemetry.pm25}
            <span className="ml-1 text-xs font-normal text-slate-600">µg/m³</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>PM10</span>
            <Gauge className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {telemetry.pm10}
            <span className="ml-1 text-xs font-normal text-slate-600">µg/m³</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>NO2</span>
            <CloudSun className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {telemetry.no2}
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
    </section>
  );
}
