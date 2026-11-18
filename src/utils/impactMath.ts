import type {
  AirTelemetry,
  CommunityImpactSummary,
  RecommendationCardData,
  VentilationType,
} from '../types/airQuality';

const DAYS_PER_MONTH = 30;
const KG_CO2_PER_TREE_PER_MONTH = 1.83; // ~22 kg CO2/year per mature urban tree

const VENTILATION_INFILTRATION_FACTOR: Record<VentilationType, number> = {
  sealed_ac: 0.55,
  cross_ventilation: 0.72,
  single_sided: 0.78,
  natural_open: 0.88,
};

/**
 * Computes baseline indoor PM2.5 (µg/m³) from outdoor telemetry and housing ventilation,
 * accounting for typical indoor cooking/incense baseline elevation (+8 µg/m³).
 */
export function estimateBaselineIndoorPm25(
  telemetry: AirTelemetry,
  ventilationType: VentilationType,
  hasAirPurifier: boolean,
): number {
  const factor = VENTILATION_INFILTRATION_FACTOR[ventilationType] ?? 0.75;
  const purifierFactor = hasAirPurifier ? 0.72 : 1.0;
  const raw = telemetry.pm25 * factor * purifierFactor + 8;
  return Number(Math.max(4, raw).toFixed(1));
}

/**
 * Pure deterministic calculation for the interactive Family & Community Impact Simulator.
 * Combines adopted actions multiplicatively for indoor PM2.5 exposure reduction
 * (capped realistically at 85% total reduction) and linearly for CO2e savings across
 * 1 to 1,000 community households.
 */
export function computeCommunityImpact(
  recommendations: RecommendationCardData[],
  adoptedIds: ReadonlySet<string>,
  householdScale: number,
  telemetry: AirTelemetry,
  ventilationType: VentilationType,
  hasAirPurifier: boolean,
): CommunityImpactSummary {
  const clampedScale = Math.max(1, Math.min(1000, Math.round(householdScale)));
  const adopted = recommendations.filter((rec) => adoptedIds.has(rec.id));

  let dailyCo2SavedPerHouseholdKg = 0;
  let remainingExposureFactor = 1.0;

  for (const rec of adopted) {
    dailyCo2SavedPerHouseholdKg += rec.whyAndDirectImpact.co2SavedKgPerDay;
    const stepReduction = Math.max(0, Math.min(0.85, rec.whyAndDirectImpact.pm25ReductionPercent / 100));
    remainingExposureFactor *= 1 - stepReduction * 0.65;
  }

  const combinedIndoorPm25ReductionPercent =
    adopted.length === 0
      ? 0
      : Number(Math.min(85, Math.max(1, (1 - remainingExposureFactor) * 100)).toFixed(1));

  const baselineIndoorPm25 = estimateBaselineIndoorPm25(telemetry, ventilationType, hasAirPurifier);
  const estimatedIndoorPm25AfterAction = Number(
    Math.max(2.5, baselineIndoorPm25 * (1 - combinedIndoorPm25ReductionPercent / 100)).toFixed(1),
  );

  const monthlyCo2SavedPerHouseholdKg = Number((dailyCo2SavedPerHouseholdKg * DAYS_PER_MONTH).toFixed(2));
  const monthlyCommunityCo2SavedKg = Number((monthlyCo2SavedPerHouseholdKg * clampedScale).toFixed(1));
  const annualCommunityCo2SavedTonnes = Number(((monthlyCommunityCo2SavedKg * 12) / 1000).toFixed(2));
  const treesEquivalentPerMonth = Math.round(monthlyCommunityCo2SavedKg / KG_CO2_PER_TREE_PER_MONTH);

  return {
    adoptedCount: adopted.length,
    totalRecommendations: recommendations.length,
    householdScale: clampedScale,
    dailyCo2SavedPerHouseholdKg: Number(dailyCo2SavedPerHouseholdKg.toFixed(2)),
    monthlyCo2SavedPerHouseholdKg,
    monthlyCommunityCo2SavedKg,
    annualCommunityCo2SavedTonnes,
    combinedIndoorPm25ReductionPercent,
    estimatedIndoorPm25AfterAction,
    baselineIndoorPm25,
    treesEquivalentPerMonth,
  };
}
