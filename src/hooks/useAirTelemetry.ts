import { useCallback, useState } from 'react';
import { fetchCityTelemetry } from '../services/apiClient';
import type { AirTelemetry, ScaleOverride } from '../types/airQuality';

/**
 * Public state and actions exposed by {@link useAirTelemetry}.
 */
export interface UseAirTelemetryResult {
  previewTelemetry: AirTelemetry | null;
  isLoadingTelemetry: boolean;
  telemetryError: string | null;
  setTelemetrySnapshot: (telemetry: AirTelemetry | null) => void;
  clearTelemetryError: () => void;
  fetchTelemetryPreview: (
    cityQuery: string,
    scaleOverride: ScaleOverride,
  ) => Promise<AirTelemetry | null>;
  switchScale: (
    cityQuery: string,
    nextScale: ScaleOverride,
  ) => Promise<AirTelemetry | null>;
}

/**
 * Manages live air-quality telemetry preview fetching and regional AQI scale-switching
 * without performing any requests on initial mount.
 *
 * @param onAnnounce - Optional callback to dispatch screen-reader `aria-live` updates.
 * @returns Strongly typed telemetry state and async actions.
 */
export function useAirTelemetry(
  onAnnounce?: (message: string) => void,
): UseAirTelemetryResult {
  const [previewTelemetry, setPreviewTelemetry] = useState<AirTelemetry | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  const setTelemetrySnapshot = useCallback((telemetry: AirTelemetry | null) => {
    setPreviewTelemetry(telemetry);
  }, []);

  const clearTelemetryError = useCallback(() => {
    setTelemetryError(null);
  }, []);

  const fetchTelemetryPreview = useCallback(
    async (cityQuery: string, scaleOverride: ScaleOverride): Promise<AirTelemetry | null> => {
      setIsLoadingTelemetry(true);
      setTelemetryError(null);
      onAnnounce?.(`Fetching live air telemetry for ${cityQuery}.`);

      try {
        const nextTelemetry = await fetchCityTelemetry(cityQuery, scaleOverride);
        setPreviewTelemetry(nextTelemetry);
        onAnnounce?.(
          `Telemetry loaded for ${nextTelemetry.resolvedLocation}. ${nextTelemetry.scaleName}, AQI ${nextTelemetry.aqiValue}, ${nextTelemetry.categoryLabel}.`,
        );
        return nextTelemetry;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to fetch city telemetry.';
        setTelemetryError(msg);
        return null;
      } finally {
        setIsLoadingTelemetry(false);
      }
    },
    [onAnnounce],
  );

  const switchScale = useCallback(
    async (cityQuery: string, nextScale: ScaleOverride): Promise<AirTelemetry | null> => {
      try {
        const nextTelemetry = await fetchCityTelemetry(cityQuery, nextScale);
        setPreviewTelemetry(nextTelemetry);
        onAnnounce?.(
          `Switched scale to ${nextTelemetry.scaleName}: AQI ${nextTelemetry.aqiValue}, ${nextTelemetry.categoryLabel}.`,
        );
        return nextTelemetry;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to switch AQI scale.';
        setTelemetryError(msg);
        return null;
      }
    },
    [onAnnounce],
  );

  return {
    previewTelemetry,
    isLoadingTelemetry,
    telemetryError,
    setTelemetrySnapshot,
    clearTelemetryError,
    fetchTelemetryPreview,
    switchScale,
  };
}
