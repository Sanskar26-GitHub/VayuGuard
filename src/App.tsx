import React, { useCallback, useRef, useState } from 'react';
import { CheckCircle2, Compass, Layers, MapPin, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { AirTelemetryBanner } from './components/AirTelemetryBanner';
import { AskAssistantPanel } from './components/AskAssistantPanel';
import { ErrorAlertBanner, ErrorBoundary } from './components/ErrorBoundary';
import { ImpactSimulator } from './components/ImpactSimulator';
import { LifestyleForm } from './components/LifestyleForm';
import { Navbar } from './components/Navbar';
import { RecommendationCard } from './components/RecommendationCard';
import type {
  ActionPlanResponse,
  AirTelemetry,
  GeocodeOption,
  HouseholdFormDraft,
  HouseholdProfile,
  PillarId,
  ScaleOverride,
} from './types/airQuality';

const INITIAL_DRAFT: HouseholdFormDraft = {
  city: '',
  ventilationType: '',
  hasAirPurifier: '',
  cookingFuel: '',
  commuteMode: '',
  sensitiveGroups: [],
  lifestyleNotes: '',
  scaleOverride: 'AUTO',
};

const PILLAR_TABS: Array<{ id: 'all' | PillarId; label: string }> = [
  { id: 'all', label: 'All Pillars' },
  { id: 'low_emission_routines', label: 'Low-Emission Routines' },
  { id: 'iaq_hacks', label: 'IAQ Hacks' },
  { id: 'sustainable_alternatives', label: 'Sustainable Alternatives' },
];

function toValidatedProfile(draft: HouseholdFormDraft): HouseholdProfile | null {
  if (
    draft.city.trim().length < 2 ||
    !draft.ventilationType ||
    !draft.cookingFuel ||
    !draft.commuteMode ||
    !draft.hasAirPurifier
  ) {
    return null;
  }
  return {
    city: draft.city.trim(),
    ventilationType: draft.ventilationType,
    hasAirPurifier: draft.hasAirPurifier === 'yes',
    cookingFuel: draft.cookingFuel,
    commuteMode: draft.commuteMode,
    sensitiveGroups: draft.sensitiveGroups,
    lifestyleNotes: draft.lifestyleNotes.trim() || undefined,
    scaleOverride: draft.scaleOverride,
  };
}

function VayuGuardWorkspace() {
  const [draft, setDraft] = useState<HouseholdFormDraft>(INITIAL_DRAFT);
  const [previewTelemetry, setPreviewTelemetry] = useState<AirTelemetry | null>(null);
  const [plan, setPlan] = useState<ActionPlanResponse | null>(null);
  const [submittedProfile, setSubmittedProfile] = useState<HouseholdProfile | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('');
  const [activePillarFilter, setActivePillarFilter] = useState<'all' | PillarId>('all');
  const [adoptedIds, setAdoptedIds] = useState<Set<string>>(new Set());
  const [householdScale, setHouseholdScale] = useState<number>(25);

  const cityInputRef = useRef<HTMLInputElement | null>(null);

  const fetchActionPlan = useCallback(async (targetProfile: HouseholdProfile) => {
    setIsLoadingPlan(true);
    setErrorMessage(null);
    setStatusAnnouncement(
      `Fetching live air telemetry and generating action plan for ${targetProfile.city}.`,
    );

    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetProfile),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate daily air quality plan.');
      }

      const planResult = payload as ActionPlanResponse;
      setPlan(planResult);
      setPreviewTelemetry(planResult.telemetry);
      setSubmittedProfile(targetProfile);

      // Pre-select the first 3 recommendations so the simulator immediately shows live impact
      const initialAdopted = new Set(
        planResult.recommendations.slice(0, 3).map((rec) => rec.id),
      );
      setAdoptedIds(initialAdopted);

      setStatusAnnouncement(
        `Action plan ready for ${planResult.telemetry.resolvedLocation}. ${planResult.telemetry.scaleName}, AQI ${planResult.telemetry.aqiValue}, ${planResult.telemetry.categoryLabel}. ${planResult.recommendations.length} recommendations generated.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load air quality plan.';
      setErrorMessage(msg);
      setStatusAnnouncement(`Error: ${msg}`);
    } finally {
      setIsLoadingPlan(false);
    }
  }, []);

  const fetchCityTelemetryPreview = useCallback(
    async (cityQuery: string, scaleOverride: ScaleOverride) => {
      setIsLoadingTelemetry(true);
      setErrorMessage(null);
      setStatusAnnouncement(`Fetching live air telemetry for ${cityQuery}.`);

      try {
        const res = await fetch(
          `/api/air-quality?city=${encodeURIComponent(cityQuery)}&scale=${encodeURIComponent(
            scaleOverride,
          )}`,
        );
        const payload = (await res.json()) as { telemetry?: AirTelemetry; error?: string };
        if (!res.ok || !payload.telemetry) {
          throw new Error(payload.error || 'Unable to fetch city telemetry.');
        }

        const nextTelemetry = payload.telemetry;
        setPreviewTelemetry(nextTelemetry);
        setStatusAnnouncement(
          `Telemetry loaded for ${nextTelemetry.resolvedLocation}. ${nextTelemetry.scaleName}, AQI ${nextTelemetry.aqiValue}, ${nextTelemetry.categoryLabel}.`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to fetch city telemetry.';
        setErrorMessage(msg);
      } finally {
        setIsLoadingTelemetry(false);
      }
    },
    [],
  );

  const handleSelectPresetCity = (presetCity: string) => {
    const updated: HouseholdFormDraft = { ...draft, city: presetCity };
    setDraft(updated);
    const completeProfile = toValidatedProfile(updated);
    if (completeProfile) {
      void fetchActionPlan(completeProfile);
    } else {
      void fetchCityTelemetryPreview(presetCity, updated.scaleOverride);
    }
  };

  const handleSelectLocation = (option: GeocodeOption) => {
    const updated: HouseholdFormDraft = { ...draft, city: option.cityWithCountry };
    setDraft(updated);
    const completeProfile = toValidatedProfile(updated);
    if (completeProfile) {
      void fetchActionPlan(completeProfile);
    } else {
      void fetchCityTelemetryPreview(option.cityWithCountry, updated.scaleOverride);
    }
  };

  const activeTelemetry = plan?.telemetry ?? previewTelemetry;

  const handleScaleChange = async (nextScale: ScaleOverride) => {
    const updatedDraft: HouseholdFormDraft = { ...draft, scaleOverride: nextScale };
    setDraft(updatedDraft);
    if (!activeTelemetry) return;

    try {
      const cityQuery = encodeURIComponent(activeTelemetry.cityWithCountry || activeTelemetry.city);
      const scaleQuery = encodeURIComponent(nextScale);
      const response = await fetch(`/api/air-quality?city=${cityQuery}&scale=${scaleQuery}`);
      const payload = (await response.json()) as { telemetry?: AirTelemetry; error?: string };
      if (!response.ok || !payload.telemetry) {
        throw new Error(payload.error || 'Unable to switch AQI scale.');
      }
      const nextTelemetry = payload.telemetry;
      setPreviewTelemetry(nextTelemetry);
      setPlan((prev) => (prev ? { ...prev, telemetry: nextTelemetry } : prev));
      setStatusAnnouncement(
        `Switched scale to ${nextTelemetry.scaleName}: AQI ${nextTelemetry.aqiValue}, ${nextTelemetry.categoryLabel}.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to switch AQI scale.';
      setErrorMessage(msg);
    }
  };

  const handleToggleAdopt = (id: string) => {
    setAdoptedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setStatusAnnouncement('Action removed from household adoption simulator.');
      } else {
        next.add(id);
        setStatusAnnouncement('Action added to household adoption simulator.');
      }
      return next;
    });
  };

  const handleSelectAllAdopted = () => {
    if (!plan) return;
    setAdoptedIds(new Set(plan.recommendations.map((rec) => rec.id)));
    setStatusAnnouncement(`All ${plan.recommendations.length} recommendations selected in simulator.`);
  };

  const handleResetAdopted = () => {
    setAdoptedIds(new Set());
    setStatusAnnouncement('Adopted actions cleared in simulator.');
  };

  const handleFocusPlanner = () => {
    cityInputRef.current?.focus();
    cityInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const visibleRecommendations =
    plan?.recommendations.filter((rec) =>
      activePillarFilter === 'all' ? true : rec.pillar === activePillarFilter,
    ) ?? [];

  const assistantProfile: HouseholdProfile | null =
    submittedProfile ??
    (activeTelemetry
      ? {
          city: activeTelemetry.cityWithCountry || draft.city,
          ventilationType: draft.ventilationType || 'cross_ventilation',
          hasAirPurifier: draft.hasAirPurifier === 'yes',
          cookingFuel: draft.cookingFuel || 'lpg',
          commuteMode: draft.commuteMode || 'metro_bus',
          sensitiveGroups: draft.sensitiveGroups,
          lifestyleNotes: draft.lifestyleNotes || undefined,
          scaleOverride: draft.scaleOverride,
        }
      : null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar onFocusPlanner={handleFocusPlanner} />

      {/* Screen-reader live status region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>

      <main
        id="main-content"
        className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8"
      >
        {/* Hero Headline & Mission Summary */}
        <section aria-labelledby="hero-heading" className="border-b border-slate-200 pb-5">
          <h1
            id="hero-heading"
            className="max-w-3xl text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-3xl"
          >
            Urban Air Quality Action Plan &amp; Household Emission Reduction
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 sm:text-base">
            Move beyond passively checking AQI numbers. Grounded in live Open-Meteo pollutant and
            boundary-layer weather telemetry, VayuGuard builds daily routines, indoor air hacks, and
            low-emission alternatives calibrated to your home and commute.
          </p>
        </section>

        {errorMessage && (
          <ErrorAlertBanner
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {/* Live Telemetry Ribbon (only shown after user searches/selects a city or submits) */}
        {(activeTelemetry || isLoadingPlan || isLoadingTelemetry) && (
          <AirTelemetryBanner
            telemetry={activeTelemetry}
            isLoading={isLoadingPlan || isLoadingTelemetry}
            scaleOverride={draft.scaleOverride}
            onScaleChange={(nextScale) => void handleScaleChange(nextScale)}
          />
        )}

        {/* Asymmetric Split Workspace: Left Controls + Right Action Plan */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-4">
            <LifestyleForm
              profile={draft}
              isSubmitting={isLoadingPlan}
              cityInputRef={cityInputRef}
              onChange={setDraft}
              onSelectPresetCity={handleSelectPresetCity}
              onSelectLocation={handleSelectLocation}
              onSubmit={(validated) => void fetchActionPlan(validated)}
            />
          </div>

          <div className="space-y-6 lg:col-span-8">
            {!plan && !isLoadingPlan ? (
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
                    onClick={handleFocusPlanner}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#0F4C81] hover:bg-slate-50"
                  >
                    {activeTelemetry ? 'Complete Household Setup' : 'Search City & Country'}
                  </button>
                </div>
              </section>
            ) : (
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

                  {/* Interactive Pillar Filter Tabs */}
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
                          onClick={() => setActivePillarFilter(tab.id)}
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

                {/* Daily Briefing Summary */}
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

                {/* Recommendation Cards */}
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
                        onToggleAdopt={handleToggleAdopt}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Family & Community Impact Simulator */}
            <ImpactSimulator
              recommendations={plan?.recommendations ?? []}
              adoptedIds={adoptedIds}
              householdScale={householdScale}
              telemetry={plan?.telemetry ?? null}
              ventilationType={draft.ventilationType || 'cross_ventilation'}
              hasAirPurifier={draft.hasAirPurifier === 'yes'}
              onScaleChange={setHouseholdScale}
              onSelectAll={handleSelectAllAdopted}
              onResetAdoption={handleResetAdopted}
            />

            {/* Grounded Situational Q&A */}
            <AskAssistantPanel profile={assistantProfile} telemetry={activeTelemetry} />
          </div>
        </div>
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          VayuGuard · Open-Meteo Environmental Telemetry &amp; Household Emission Modeling · Informational guidance only
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <VayuGuardWorkspace />
    </ErrorBoundary>
  );
}
