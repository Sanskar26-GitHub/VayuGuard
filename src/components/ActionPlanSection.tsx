import React from 'react';
import { CheckCircle2, Layers, ShieldAlert } from 'lucide-react';
import type { ActionPlanResponse, PillarId } from '../types/airQuality';
import { RecommendationCard } from './RecommendationCard';

const PILLAR_TABS: ReadonlyArray<{ id: 'all' | PillarId; label: string }> = [
  { id: 'all', label: 'All Pillars' },
  { id: 'low_emission_routines', label: 'Low-Emission Routines' },
  { id: 'iaq_hacks', label: 'IAQ Hacks' },
  { id: 'sustainable_alternatives', label: 'Sustainable Alternatives' },
];

/**
 * Props for {@link ActionPlanSection}.
 */
export interface ActionPlanSectionProps {
  plan: ActionPlanResponse | null;
  isLoadingPlan: boolean;
  activePillarFilter: 'all' | PillarId;
  adoptedIds: ReadonlySet<string>;
  onFilterChange: (pillar: 'all' | PillarId) => void;
  onToggleAdopt: (id: string) => void;
}

/**
 * Renders the personalized 3-pillar daily action plan with pillar filter tabs,
 * daily boundary-layer briefing, loading skeletons, and interactive recommendation cards.
 *
 * @param props - Active action plan state, pillar filter, and adoption callbacks.
 * @returns Action plan section element.
 */
export function ActionPlanSection({
  plan,
  isLoadingPlan,
  activePillarFilter,
  adoptedIds,
  onFilterChange,
  onToggleAdopt,
}: ActionPlanSectionProps) {
  const visibleRecommendations =
    plan?.recommendations.filter((rec) =>
      activePillarFilter === 'all' ? true : rec.pillar === activePillarFilter,
    ) ?? [];

  return (
    <section
      id="action-plan-section"
      aria-labelledby="action-plan-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Layers className="mt-0.5 h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
          <div>
            <h2 id="action-plan-heading" className="text-xl font-bold text-slate-900">
              Personalized Daily Action Plan
            </h2>
            {plan && (
              <p className="mt-0.5 text-xs text-slate-600">
                {plan.recommendations.length} verified actions across 3 pillars
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>
                  {plan.metadata.fallbackTriggered
                    ? 'Parametric meteorological engine'
                    : `Model: ${plan.metadata.modelUsed}`}
                </span>
                {plan.metadata.cached && (
                  <>
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span>Cached response</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Filter recommendations by pillar"
          className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          {PILLAR_TABS.map((tab) => {
            const active = activePillarFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(tab.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {plan && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-2.5">
            {plan.telemetry.thermalInversionRisk ? (
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-[#92400E]"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]"
                aria-hidden="true"
              />
            )}
            <div className="space-y-1.5 text-sm leading-relaxed text-slate-800">
              <p>{plan.dailyBriefing}</p>
              <p className="text-xs font-medium text-slate-700">
                <span className="font-semibold text-slate-900">Ventilation Strategy: </span>
                {plan.ventilationGuidance}
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoadingPlan && !plan ? (
        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {visibleRecommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              adopted={adoptedIds.has(rec.id)}
              onToggleAdopt={onToggleAdopt}
            />
          ))}
        </div>
      )}
    </section>
  );
}
