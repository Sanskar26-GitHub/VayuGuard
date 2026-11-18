import { useCallback, useState } from 'react';
import { askAirAssistant, generateActionPlan } from '../services/apiClient';
import type {
  ActionPlanResponse,
  AirTelemetry,
  AskAssistantResponse,
  HouseholdProfile,
  PillarId,
} from '../types/airQuality';

/**
 * Public state and actions exposed by {@link useActionPlan}.
 */
export interface UseActionPlanResult {
  plan: ActionPlanResponse | null;
  submittedProfile: HouseholdProfile | null;
  isLoadingPlan: boolean;
  planError: string | null;
  activePillarFilter: 'all' | PillarId;
  adoptedIds: ReadonlySet<string>;
  householdScale: number;
  setActivePillarFilter: (filter: 'all' | PillarId) => void;
  setHouseholdScale: (scale: number) => void;
  clearPlanError: () => void;
  submitPlan: (profile: HouseholdProfile) => Promise<ActionPlanResponse | null>;
  syncPlanTelemetry: (telemetry: AirTelemetry) => void;
  toggleAdopt: (id: string) => void;
  selectAllAdopted: () => void;
  resetAdopted: () => void;
}

/**
 * Public state and actions exposed by {@link useAssistantQuery}.
 */
export interface UseAssistantQueryResult {
  question: string;
  isAsking: boolean;
  askError: string | null;
  answerData: AskAssistantResponse | null;
  setQuestion: (value: string) => void;
  clearAskError: () => void;
  submitQuestion: (
    textToAsk: string,
    profile: HouseholdProfile,
    telemetry: AirTelemetry,
  ) => Promise<void>;
}

/**
 * Manages personalized 3-pillar action plan generation, pillar filtering,
 * and client-side community simulator adoption state.
 *
 * @param onAnnounce - Optional callback to announce status changes to screen readers.
 * @returns Strongly typed plan state and action handlers.
 */
export function useActionPlan(
  onAnnounce?: (message: string) => void,
): UseActionPlanResult {
  const [plan, setPlan] = useState<ActionPlanResponse | null>(null);
  const [submittedProfile, setSubmittedProfile] = useState<HouseholdProfile | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [activePillarFilter, setActivePillarFilter] = useState<'all' | PillarId>('all');
  const [adoptedIds, setAdoptedIds] = useState<Set<string>>(new Set());
  const [householdScale, setHouseholdScale] = useState<number>(25);

  const clearPlanError = useCallback(() => {
    setPlanError(null);
  }, []);

  const submitPlan = useCallback(
    async (targetProfile: HouseholdProfile): Promise<ActionPlanResponse | null> => {
      setIsLoadingPlan(true);
      setPlanError(null);
      onAnnounce?.(
        `Fetching live air telemetry and generating action plan for ${targetProfile.city}.`,
      );

      try {
        const planResult = await generateActionPlan(targetProfile);
        setPlan(planResult);
        setSubmittedProfile(targetProfile);

        // Pre-select the first 3 recommendations so the simulator immediately shows live impact.
        setAdoptedIds(new Set(planResult.recommendations.slice(0, 3).map((rec) => rec.id)));

        onAnnounce?.(
          `Action plan ready for ${planResult.telemetry.resolvedLocation}. ${planResult.telemetry.scaleName}, AQI ${planResult.telemetry.aqiValue}, ${planResult.telemetry.categoryLabel}. ${planResult.recommendations.length} recommendations generated.`,
        );
        return planResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to load air quality plan.';
        setPlanError(msg);
        onAnnounce?.(`Error: ${msg}`);
        return null;
      } finally {
        setIsLoadingPlan(false);
      }
    },
    [onAnnounce],
  );

  const syncPlanTelemetry = useCallback((telemetry: AirTelemetry) => {
    setPlan((prev) => (prev ? { ...prev, telemetry } : prev));
  }, []);

  const toggleAdopt = useCallback(
    (id: string) => {
      setAdoptedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          onAnnounce?.('Action removed from household adoption simulator.');
        } else {
          next.add(id);
          onAnnounce?.('Action added to household adoption simulator.');
        }
        return next;
      });
    },
    [onAnnounce],
  );

  const selectAllAdopted = useCallback(() => {
    if (!plan) return;
    setAdoptedIds(new Set(plan.recommendations.map((rec) => rec.id)));
    onAnnounce?.(`All ${plan.recommendations.length} recommendations selected in simulator.`);
  }, [onAnnounce, plan]);

  const resetAdopted = useCallback(() => {
    setAdoptedIds(new Set());
    onAnnounce?.('Adopted actions cleared in simulator.');
  }, [onAnnounce]);

  return {
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
  };
}

/**
 * Manages situational air-quality Q&A input, validation, loading, and grounded answer state.
 *
 * @returns Strongly typed Q&A state and submit helper.
 */
export function useAssistantQuery(): UseAssistantQueryResult {
  const [question, setQuestion] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [answerData, setAnswerData] = useState<AskAssistantResponse | null>(null);

  const clearAskError = useCallback(() => {
    setAskError(null);
  }, []);

  const submitQuestion = useCallback(
    async (
      textToAsk: string,
      profile: HouseholdProfile,
      telemetry: AirTelemetry,
    ): Promise<void> => {
      const trimmed = textToAsk.trim();
      if (trimmed.length < 3) {
        setAskError('Please enter a question of at least 3 characters.');
        return;
      }

      setAskError(null);
      setIsAsking(true);
      try {
        const data = await askAirAssistant({ question: trimmed, profile, telemetry });
        setAnswerData(data);
      } catch (err) {
        setAskError(err instanceof Error ? err.message : 'Unable to reach the assistant.');
      } finally {
        setIsAsking(false);
      }
    },
    [],
  );

  return {
    question,
    isAsking,
    askError,
    answerData,
    setQuestion,
    clearAskError,
    submitQuestion,
  };
}
