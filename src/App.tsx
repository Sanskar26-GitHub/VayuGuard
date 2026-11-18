import React, { useCallback, useRef, useState } from 'react';
import { ActionPlanSection } from './components/ActionPlanSection';
import { AirTelemetryBanner } from './components/AirTelemetryBanner';
import { AskAssistantPanel } from './components/AskAssistantPanel';
import { EmptyWorkspaceCard } from './components/EmptyWorkspaceCard';
import { ErrorAlertBanner, ErrorBoundary } from './components/ErrorBoundary';
import { ImpactSimulator } from './components/ImpactSimulator';
import { LifestyleForm } from './components/LifestyleForm';
import { Navbar } from './components/Navbar';
import { useActionPlan } from './hooks/useActionPlan';
import { useAirTelemetry } from './hooks/useAirTelemetry';
import type {
  GeocodeOption,
  HouseholdFormDraft,
  HouseholdProfile,
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
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('');
  const cityInputRef = useRef<HTMLInputElement | null>(null);

  const announce = useCallback((message: string) => {
    setStatusAnnouncement(message);
  }, []);

  const {
    previewTelemetry,
    isLoadingTelemetry,
    telemetryError,
    setTelemetrySnapshot,
    clearTelemetryError,
    fetchTelemetryPreview,
    switchScale,
  } = useAirTelemetry(announce);

  const {
    plan,
    submittedProfile,
    isLoadingPlan,
    planError,
    activePillarFilter,
    adoptedIds,
    householdScale,
    setActivePillarFilter,
    setHouseholdScale,
    clearPlanError,
    submitPlan,
    syncPlanTelemetry,
    toggleAdopt,
    selectAllAdopted,
    resetAdopted,
  } = useActionPlan(announce);

  const handlePlanSubmit = async (validated: HouseholdProfile) => {
    clearTelemetryError();
    const result = await submitPlan(validated);
    if (result) {
      setTelemetrySnapshot(result.telemetry);
    }
  };

  const applyCitySelection = (cityValue: string) => {
    const updated: HouseholdFormDraft = { ...draft, city: cityValue };
    setDraft(updated);
    const completeProfile = toValidatedProfile(updated);
    if (completeProfile) {
      void handlePlanSubmit(completeProfile);
    } else {
      void fetchTelemetryPreview(cityValue, updated.scaleOverride);
    }
  };

  const activeTelemetry = plan?.telemetry ?? previewTelemetry;
  const activeError = planError ?? telemetryError;

  const handleScaleChange = async (nextScale: ScaleOverride) => {
    setDraft((prev) => ({ ...prev, scaleOverride: nextScale }));
    if (!activeTelemetry) return;

    const cityQuery = activeTelemetry.cityWithCountry || activeTelemetry.city;
    const nextTelemetry = await switchScale(cityQuery, nextScale);
    if (nextTelemetry) {
      syncPlanTelemetry(nextTelemetry);
    }
  };

  const handleFocusPlanner = () => {
    cityInputRef.current?.focus();
    cityInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>

      <main
        id="main-content"
        className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8"
      >
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

        {activeError && (
          <ErrorAlertBanner
            message={activeError}
            onDismiss={() => {
              clearPlanError();
              clearTelemetryError();
            }}
          />
        )}

        {(activeTelemetry || isLoadingPlan || isLoadingTelemetry) && (
          <AirTelemetryBanner
            telemetry={activeTelemetry}
            isLoading={isLoadingPlan || isLoadingTelemetry}
            scaleOverride={draft.scaleOverride}
            onScaleChange={(nextScale) => void handleScaleChange(nextScale)}
          />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-4">
            <LifestyleForm
              profile={draft}
              isSubmitting={isLoadingPlan}
              cityInputRef={cityInputRef}
              onChange={setDraft}
              onSelectPresetCity={applyCitySelection}
              onSelectLocation={(option: GeocodeOption) =>
                applyCitySelection(option.cityWithCountry)
              }
              onSubmit={(validated) => void handlePlanSubmit(validated)}
            />
          </div>

          <div className="space-y-6 lg:col-span-8">
            {!plan && !isLoadingPlan ? (
              <EmptyWorkspaceCard
                activeTelemetry={activeTelemetry}
                onFocusPlanner={handleFocusPlanner}
              />
            ) : (
              <ActionPlanSection
                plan={plan}
                isLoadingPlan={isLoadingPlan}
                activePillarFilter={activePillarFilter}
                adoptedIds={adoptedIds}
                onFilterChange={setActivePillarFilter}
                onToggleAdopt={toggleAdopt}
              />
            )}

            <ImpactSimulator
              recommendations={plan?.recommendations ?? []}
              adoptedIds={adoptedIds}
              householdScale={householdScale}
              telemetry={plan?.telemetry ?? null}
              ventilationType={draft.ventilationType || 'cross_ventilation'}
              hasAirPurifier={draft.hasAirPurifier === 'yes'}
              onScaleChange={setHouseholdScale}
              onSelectAll={selectAllAdopted}
              onResetAdoption={resetAdopted}
            />

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

/**
 * Root VayuGuard application wrapped in a recovery {@link ErrorBoundary}.
 *
 * @returns Root React element tree.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <VayuGuardWorkspace />
    </ErrorBoundary>
  );
}
