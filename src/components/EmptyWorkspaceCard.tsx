import React from 'react';
import { Compass, Layers, MapPin, SlidersHorizontal } from 'lucide-react';
import type { AirTelemetry } from '../types/airQuality';

/**
 * Props for {@link EmptyWorkspaceCard}.
 */
export interface EmptyWorkspaceCardProps {
  activeTelemetry: AirTelemetry | null;
  onFocusPlanner: () => void;
}

/**
 * Instructional 3-step onboarding card shown in the main workspace before an action plan
 * is generated, guiding users to select a city, configure household context, and simulate
 * community emission savings.
 *
 * @param props - Active telemetry preview (if already searched) and focus action callback.
 * @returns Accessible onboarding panel rendered when no plan is active.
 */
export function EmptyWorkspaceCard({
  activeTelemetry,
  onFocusPlanner,
}: EmptyWorkspaceCardProps) {
  return (
    <section
      id="empty-workspace-state"
      aria-labelledby="empty-state-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <Compass className="mt-0.5 h-6 w-6 shrink-0 text-[#0F4C81]" aria-hidden="true" />
        <div>
          <h2 id="empty-state-heading" className="text-xl font-bold text-slate-900">
            {activeTelemetry
              ? `Telemetry Ready for ${activeTelemetry.resolvedLocation}`
              : 'Configure Your Household Profile to Start'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            {activeTelemetry
              ? 'Select your home ventilation, cooking fuel, daily commute, and air purifier status on the left, then submit to generate your tailored 3-pillar daily action plan and community impact simulation.'
              : 'Search for your city and country on the left (or pick a quick-fill preset) and select your home ventilation, cooking fuel, commute, and purifier setup to fetch live regional AQI telemetry and generate your personalized action plan.'}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0F4C81]">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>01. Select City &amp; Country</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
            Resolves exact coordinates, local timezone, and your country&apos;s official AQI
            scale (CPCB NAQI, US EPA, UK DAQI, China MEE, or European EAQI).
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0F4C81]">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>02. Add Home &amp; Commute</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
            Calibrates ventilation timing, HEPA/MERV-13 protocols, cooking exhaust, and
            commute shifts to your real setup.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0F4C81]">
            <Layers className="h-4 w-4" aria-hidden="true" />
            <span>03. Simulate Community Impact</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
            Check off daily habits to quantify indoor PM2.5 exposure drops and neighborhood
            CO2e reductions from 1 to 1,000 homes.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={onFocusPlanner}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#0F4C81] hover:bg-slate-50"
        >
          {activeTelemetry ? 'Complete Household Setup' : 'Search City & Country'}
        </button>
      </div>
    </section>
  );
}
