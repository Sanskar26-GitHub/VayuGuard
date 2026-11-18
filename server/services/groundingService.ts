import type {
  AirTelemetry,
  CostTier,
  EffortLevel,
  PillarId,
  RecommendationCardData,
} from '../../src/types/airQuality';

const MIN_CO2_KG_PER_DAY = 0.05;
const MAX_CO2_KG_PER_DAY = 15.0;
const MIN_PM25_REDUCTION_PCT = 1;
const MAX_PM25_REDUCTION_PCT = 85;

const PILLAR_LABELS: Record<PillarId, string> = {
  low_emission_routines: 'Pillar 1 · Low-Emission Daily Routines',
  iaq_hacks: 'Pillar 2 · Indoor Air Quality (IAQ) Hacks',
  sustainable_alternatives: 'Pillar 3 · Sustainable Alternatives',
};

const VALID_PILLARS: ReadonlySet<PillarId> = new Set([
  'low_emission_routines',
  'iaq_hacks',
  'sustainable_alternatives',
]);

const VALID_COST_TIERS: ReadonlySet<CostTier> = new Set(['Free', 'Low Cost', 'Equipment']);
const VALID_EFFORT_LEVELS: ReadonlySet<EffortLevel> = new Set([
  '2-Min Habit',
  'Daily Routine',
  'One-Time Setup',
]);

export function clampNumber(value: number, min: number, max: number, decimals = 2): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(max, Math.max(min, value));
  return Number(clamped.toFixed(decimals));
}

function referencesLiveTelemetry(refText: string, telemetry: AirTelemetry): boolean {
  const lower = refText.toLowerCase();
  const expectedSnippets = [
    String(telemetry.usAqi),
    String(Math.round(telemetry.pm25)),
    telemetry.pm25.toFixed(1),
    String(Math.round(telemetry.no2)),
    String(Math.round(telemetry.temperatureC)),
    String(Math.round(telemetry.windSpeedKmh)),
  ];

  const hasMetricKeyword =
    /\b(aqi|pm2\.5|pm10|no2|co|inversion|wind|temp|humidity|°c|µg\/m³|ug\/m3|km\/h)\b/i.test(
      lower,
    );
  const hasActualValue = expectedSnippets.some((snippet) => lower.includes(snippet));

  return hasMetricKeyword && hasActualValue;
}

export interface GroundingVerificationResult {
  recommendations: RecommendationCardData[];
  adjustmentsCount: number;
}

/**
 * Programmatically verifies model-generated or fallback recommendations against
 * physical realism bounds and live Open-Meteo environmental telemetry.
 * Clamps CO2e to [0.05, 15.0] kg/day and PM2.5 reduction to [1, 85]%.
 */
export function verifyAndGroundRecommendations(
  rawRecommendations: RecommendationCardData[],
  telemetry: AirTelemetry,
): GroundingVerificationResult {
  let adjustmentsCount = 0;

  const recommendations = rawRecommendations.map((card, index) => {
    const notes: string[] = [];
    let adjusted = Boolean(card.groundingAdjusted);

    const rawPm25 = card.whyAndDirectImpact.pm25ReductionPercent;
    const clampedPm25 = clampNumber(rawPm25, MIN_PM25_REDUCTION_PCT, MAX_PM25_REDUCTION_PCT, 1);
    if (!Number.isFinite(rawPm25) || clampedPm25 !== Number(rawPm25.toFixed(1))) {
      adjusted = true;
      notes.push(`PM2.5 reduction clamped to [${MIN_PM25_REDUCTION_PCT}%, ${MAX_PM25_REDUCTION_PCT}%]`);
    }

    const rawCo2 = card.whyAndDirectImpact.co2SavedKgPerDay;
    const clampedCo2 = clampNumber(rawCo2, MIN_CO2_KG_PER_DAY, MAX_CO2_KG_PER_DAY, 2);
    if (!Number.isFinite(rawCo2) || clampedCo2 !== Number(rawCo2.toFixed(2))) {
      adjusted = true;
      notes.push(`CO2e savings clamped to [${MIN_CO2_KG_PER_DAY}, ${MAX_CO2_KG_PER_DAY}] kg/day`);
    }

    const pillar: PillarId = VALID_PILLARS.has(card.pillar)
      ? card.pillar
      : 'low_emission_routines';

    const costTier: CostTier = VALID_COST_TIERS.has(card.whyAndDirectImpact.costTier)
      ? card.whyAndDirectImpact.costTier
      : 'Free';

    const effortLevel: EffortLevel = VALID_EFFORT_LEVELS.has(card.whyAndDirectImpact.effortLevel)
      ? card.whyAndDirectImpact.effortLevel
      : 'Daily Routine';

    let groundedMetricRef = (card.whyAndDirectImpact.groundedMetricRef ?? '').trim();
    if (!referencesLiveTelemetry(groundedMetricRef, telemetry)) {
      adjusted = true;
      const inversionTag = telemetry.thermalInversionRisk
        ? `thermal inversion active (${telemetry.temperatureC}°C, wind ${telemetry.windSpeedKmh} km/h)`
        : `wind ${telemetry.windSpeedKmh} km/h at ${telemetry.temperatureC}°C`;
      groundedMetricRef = `Grounded in ${telemetry.city}: US AQI ${telemetry.usAqi} (${telemetry.category}), PM2.5 ${telemetry.pm25} µg/m³, NO2 ${telemetry.no2} µg/m³, ${inversionTag}.`;
      notes.push('Telemetry citation verified and aligned to live city readings');
    }

    if (adjusted) {
      adjustmentsCount += 1;
    }

    return {
      ...card,
      id: card.id && card.id.trim().length > 0 ? card.id : `rec-${index + 1}`,
      pillar,
      pillarLabel: PILLAR_LABELS[pillar],
      whyAndDirectImpact: {
        ...card.whyAndDirectImpact,
        pm25ReductionPercent: clampedPm25,
        co2SavedKgPerDay: clampedCo2,
        costTier,
        effortLevel,
        groundedMetricRef,
      },
      groundingAdjusted: adjusted,
      adjustmentNote: notes.length > 0 ? notes.join('; ') : card.adjustmentNote,
    };
  });

  return { recommendations, adjustmentsCount };
}
