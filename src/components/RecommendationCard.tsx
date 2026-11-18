import React from 'react';
import { CheckSquare, Info, Square } from 'lucide-react';
import { ACCESSIBLE_SURFACES } from '../styles/accessibleTheme';
import type { RecommendationCardData } from '../types/airQuality';

/**
 * Props for {@link RecommendationCard}.
 */
export interface RecommendationCardProps {
  recommendation: RecommendationCardData;
  adopted: boolean;
  onToggleAdopt: (id: string) => void;
}

/**
 * Action recommendation card displaying pillar metadata, keyboard-accessible adoption
 * checkbox, scientific mechanism, quantified PM2.5/CO2e impacts, and grounded telemetry reference.
 *
 * @param props - Recommendation data, adoption flag, and toggle callback.
 * @returns Accessible recommendation `<article>` card.
 */
export function RecommendationCard({
  recommendation,
  adopted,
  onToggleAdopt,
}: RecommendationCardProps) {
  const { whyAndDirectImpact } = recommendation;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleAdopt(recommendation.id);
    }
  };

  return (
    <article
      className={`rounded-xl border p-5 transition-colors ${
        adopted
          ? 'border-[#0F4C81] bg-[#F8FAFC]'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          {/* Unboxed typographic metadata kicker (zero-pill discipline) */}
          <p className="text-xs font-semibold text-[#0F4C81]">
            {recommendation.pillarLabel}
            <span className="mx-1.5 text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-600">{whyAndDirectImpact.costTier}</span>
            <span className="mx-1.5 text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-600">{whyAndDirectImpact.effortLevel}</span>
          </p>

          <h3 className="text-base font-bold leading-snug text-slate-900 sm:text-lg">
            {recommendation.title}
          </h3>
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={adopted}
          aria-label={`Adopt action: ${recommendation.title}`}
          onClick={() => onToggleAdopt(recommendation.id)}
          onKeyDown={handleKeyDown}
          className={`inline-flex items-center gap-2 self-start rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            adopted
              ? 'border-[#0F4C81] bg-[#0F4C81] text-white'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
          }`}
        >
          {adopted ? (
            <CheckSquare className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Square className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{adopted ? 'Adopted in Plan' : 'Adopt Action'}</span>
        </button>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
        {recommendation.actionSummary}
      </p>

      {/* Structured Why & Direct Impact breakdown */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2.5">
          <span className="text-xs font-bold tracking-wide text-slate-800 uppercase">
            Why &amp; Direct Impact
          </span>
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs font-semibold tabular-nums">
            <span className="text-[#065F46]">
              -{whyAndDirectImpact.pm25ReductionPercent}% Indoor PM2.5
            </span>
            <span className="text-[#0F4C81]">
              {whyAndDirectImpact.co2SavedKgPerDay.toFixed(2)} kg CO2e/day saved
            </span>
          </div>
        </div>

        <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">Mechanism: </span>
          {whyAndDirectImpact.mechanism}
        </p>

        <div
          className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed"
          style={{
            backgroundColor: ACCESSIBLE_SURFACES.infoBanner.background,
            borderColor: ACCESSIBLE_SURFACES.infoBanner.border,
            color: ACCESSIBLE_SURFACES.infoBanner.foreground,
          }}
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <div>
            <span className="font-semibold">Grounded Telemetry: </span>
            <span>{whyAndDirectImpact.groundedMetricRef}</span>
            {recommendation.groundingAdjusted && recommendation.adjustmentNote && (
              <span className="mt-1 block text-slate-700">
                Verification note: {recommendation.adjustmentNote}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
