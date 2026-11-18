import React from 'react';
import { BarChart3, RotateCcw, Users } from 'lucide-react';
import type {
  AirTelemetry,
  PillarId,
  RecommendationCardData,
  VentilationType,
} from '../types/airQuality';
import { computeCommunityImpact } from '../utils/impactMath';
import { ImpactCharts, type PillarCo2Bar } from './ImpactCharts';

/**
 * Props for {@link ImpactSimulator}.
 */
export interface ImpactSimulatorProps {
  recommendations: RecommendationCardData[];
  adoptedIds: ReadonlySet<string>;
  householdScale: number;
  telemetry: AirTelemetry | null;
  ventilationType: VentilationType;
  hasAirPurifier: boolean;
  onScaleChange: (scale: number) => void;
  onSelectAll: () => void;
  onResetAdoption: () => void;
}

const SCALE_PRESETS = [
  { label: '1 Home', value: 1 },
  { label: '25 Block', value: 25 },
  { label: '100 Ward', value: 100 },
  { label: '1,000 District', value: 1000 },
] as const;

/**
 * Interactive 100% client-side Family & Community Impact Simulator calculating
 * monthly CO2e savings, indoor PM2.5 reductions, and urban tree equivalents across
 * 1 to 1,000 community households.
 *
 * @param props - Recommendations, adopted IDs, household scale, and environmental telemetry.
 * @returns Interactive simulator section, or `null` before a plan is generated.
 */
export function ImpactSimulator({
  recommendations,
  adoptedIds,
  householdScale,
  telemetry,
  ventilationType,
  hasAirPurifier,
  onScaleChange,
  onSelectAll,
  onResetAdoption,
}: ImpactSimulatorProps) {
  if (!telemetry || recommendations.length === 0) {
    return null;
  }

  const impact = computeCommunityImpact(
    recommendations,
    adoptedIds,
    householdScale,
    telemetry,
    ventilationType,
    hasAirPurifier,
  );

  const pillarTotals: Record<PillarId, number> = {
    low_emission_routines: 0,
    iaq_hacks: 0,
    sustainable_alternatives: 0,
  };
  for (const rec of recommendations) {
    if (adoptedIds.has(rec.id)) {
      pillarTotals[rec.pillar] +=
        rec.whyAndDirectImpact.co2SavedKgPerDay * 30 * impact.householdScale;
    }
  }

  const pillarBars: PillarCo2Bar[] = [
    {
      label: 'Daily Routines',
      value: Number(pillarTotals.low_emission_routines.toFixed(1)),
      color: '#0F4C81',
    },
    {
      label: 'IAQ Hacks',
      value: Number(pillarTotals.iaq_hacks.toFixed(1)),
      color: '#065F46',
    },
    {
      label: 'Clean Alternatives',
      value: Number(pillarTotals.sustainable_alternatives.toFixed(1)),
      color: '#1E40AF',
    },
  ];

  return (
    <section
      id="impact-simulator-section"
      aria-labelledby="simulator-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <BarChart3 className="mt-0.5 h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
          <div>
            <h2 id="simulator-heading" className="text-xl font-bold text-slate-900">
              Family &amp; Community Impact Simulator
            </h2>
            <p className="text-sm text-slate-600">
              Check off actions above and scale adoption across your neighborhood (live local math, zero extra AI calls).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0 hover:bg-slate-100"
          >
            Adopt All ({recommendations.length})
          </button>
          <button
            type="button"
            onClick={onResetAdoption}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label
            htmlFor="community-scale-slider"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"
          >
            <Users className="h-4 w-4 text-[#0F4C81]" aria-hidden="true" />
            <span>Neighborhood Adoption Scale:</span>
            <span className="font-mono text-base font-bold text-[#0F4C81] tabular-nums">
              {impact.householdScale.toLocaleString()}{' '}
              {impact.householdScale === 1 ? 'household' : 'households'}
            </span>
          </label>

          <div className="flex flex-wrap gap-1.5">
            {SCALE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => onScaleChange(preset.value)}
                aria-pressed={impact.householdScale === preset.value}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${
                  impact.householdScale === preset.value
                    ? 'border-[#0F4C81] bg-[#0F4C81] text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <input
          id="community-scale-slider"
          type="range"
          min={1}
          max={1000}
          step={1}
          value={impact.householdScale}
          onChange={(e) => onScaleChange(Number(e.target.value))}
          aria-valuemin={1}
          aria-valuemax={1000}
          aria-valuenow={impact.householdScale}
          className="mt-3 h-2 w-full cursor-pointer accent-[#0F4C81]"
        />
        <div className="mt-1 flex justify-between font-mono text-xs text-slate-600 tabular-nums">
          <span>1 household</span>
          <span>250</span>
          <span>500</span>
          <span>750</span>
          <span>1,000 households</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-600">Actions Adopted</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {impact.adoptedCount}
            <span className="ml-1 text-sm font-normal text-slate-600">
              / {impact.totalRecommendations}
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-600">Indoor PM2.5 Reduction</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#065F46] tabular-nums">
            -{impact.combinedIndoorPm25ReductionPercent}%
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-600 tabular-nums">
            Est. {impact.estimatedIndoorPm25AfterAction} µg/m³ indoor
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-600">Monthly CO2e Avoided</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#0F4C81] tabular-nums">
            {impact.monthlyCommunityCo2SavedKg.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-slate-600">kg/mo</span>
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-600 tabular-nums">
            {impact.annualCommunityCo2SavedTonnes} tonnes/year
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-600">Urban Tree Equivalent</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {impact.treesEquivalentPerMonth.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-slate-600">trees/mo</span>
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-600 tabular-nums">
            {impact.dailyCo2SavedPerHouseholdKg} kg/day per home
          </p>
        </div>
      </div>

      <ImpactCharts impact={impact} pillarBars={pillarBars} />
    </section>
  );
}
