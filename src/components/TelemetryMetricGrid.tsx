import React from 'react';
import { CloudSun, Droplets, Gauge, Thermometer, Wind } from 'lucide-react';
import type { AirTelemetry, PollutantSubIndexDetail } from '../types/airQuality';

/**
 * Props for {@link TelemetryMetricGrid}.
 */
export interface TelemetryMetricGridProps {
  telemetry: AirTelemetry;
  subIndices: PollutantSubIndexDetail[];
}

function getConcentrationDisplay(
  subIndices: PollutantSubIndexDetail[],
  pollutant: 'PM2.5' | 'PM10' | 'NO2',
  fallbackValue: number,
): string {
  const found = subIndices.find((item) => item.pollutant === pollutant);
  if (found) {
    return found.concentration === null ? 'N/A' : String(found.concentration);
  }
  return String(fallbackValue);
}

/**
 * Displays the 6-card grid of live pollutant concentrations and meteorological readings
 * (PM2.5, PM10, NO2, Temperature, Wind Speed, Humidity).
 *
 * @param props - Live telemetry snapshot and computed pollutant sub-indices.
 * @returns Responsive 6-card metric grid.
 */
export function TelemetryMetricGrid({ telemetry, subIndices }: TelemetryMetricGridProps) {
  const metricCards = [
    {
      label: 'PM2.5',
      value: getConcentrationDisplay(subIndices, 'PM2.5', telemetry.pm25),
      unit: 'µg/m³',
      icon: <Gauge className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />,
    },
    {
      label: 'PM10',
      value: getConcentrationDisplay(subIndices, 'PM10', telemetry.pm10),
      unit: 'µg/m³',
      icon: <Gauge className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />,
    },
    {
      label: 'NO2',
      value: getConcentrationDisplay(subIndices, 'NO2', telemetry.no2),
      unit: 'µg/m³',
      icon: <CloudSun className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />,
    },
    {
      label: 'Temperature',
      value: String(telemetry.temperatureC),
      unit: '°C',
      icon: <Thermometer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />,
    },
    {
      label: 'Wind Speed',
      value: String(telemetry.windSpeedKmh),
      unit: 'km/h',
      icon: <Wind className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />,
    },
    {
      label: 'Humidity',
      value: String(telemetry.humidityPercent),
      unit: '%',
      icon: <Droplets className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />,
    },
  ];

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {metricCards.map((card) => (
        <div key={card.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>{card.label}</span>
            {card.icon}
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {card.value}
            <span className="ml-1 text-xs font-normal text-slate-600">{card.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
