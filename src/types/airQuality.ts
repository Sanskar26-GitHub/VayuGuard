export type AirQualityCategory =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export type RegionalScaleCode = 'IN_CPCB' | 'US_EPA' | 'CN_MEE' | 'UK_DAQI' | 'EU_EAQI';

export type ScaleOverride = 'AUTO' | RegionalScaleCode;

export type SeverityTier = 1 | 2 | 3 | 4 | 5 | 6;

export type VentilationType =
  | 'cross_ventilation'
  | 'single_sided'
  | 'sealed_ac'
  | 'natural_open';

export type CookingFuel =
  | 'lpg'
  | 'electric_induction'
  | 'piped_gas'
  | 'biomass_solid';

export type CommuteMode =
  | 'car_solo'
  | 'two_wheeler'
  | 'metro_bus'
  | 'cycle_walk'
  | 'work_from_home';

export type SensitiveGroup =
  | 'children'
  | 'seniors'
  | 'asthma_respiratory'
  | 'pregnant'
  | 'outdoor_worker';

export type CostTier = 'Free' | 'Low Cost' | 'Equipment';

export type EffortLevel = '2-Min Habit' | 'Daily Routine' | 'One-Time Setup';

export type PillarId =
  | 'low_emission_routines'
  | 'iaq_hacks'
  | 'sustainable_alternatives';

export type TelemetrySource = 'open-meteo-live' | 'meteorological-baseline';
export type TelemetryStatus = 'live' | 'offline-baseline';

export interface PollutantSubIndexDetail {
  pollutant: 'PM2.5' | 'PM10' | 'NO2' | 'CO' | 'O3' | 'SO2';
  concentration: number | null;
  unit: 'µg/m³' | 'mg/m³';
  subIndex: number | null;
  isDominant: boolean;
}

export interface GeocodeOption {
  label: string;
  cityWithCountry: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  timezone: string;
}

export interface RawPollutants {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  co: number | null;
  o3: number | null;
  so2: number | null;
}

export interface RegionalAqiResult {
  aqiValue: number;
  scaleMax: 500 | 10 | 6;
  scaleCode: RegionalScaleCode;
  scaleName: string;
  categoryLabel: string;
  severityTier: SeverityTier;
  dominantPollutant: string;
  isAutoSelectedScale: boolean;
  pollutantSubIndices: PollutantSubIndexDetail[];
}

export interface AirTelemetry {
  city: string;
  cityWithCountry: string;
  resolvedLocation: string;
  countryCode: string;
  timezone: string;
  timezoneAbbreviation: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  observedAt: string;
  usAqi: number;
  category: AirQualityCategory;
  aqiValue: number;
  scaleMax: 500 | 10 | 6;
  scaleCode: RegionalScaleCode;
  scaleName: string;
  categoryLabel: string;
  severityTier: SeverityTier;
  dominantPollutant: string;
  isAutoSelectedScale: boolean;
  pollutantSubIndices: PollutantSubIndexDetail[];
  pm25: number;
  pm10: number;
  no2: number;
  co: number;
  o3: number;
  so2: number;
  temperatureC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  thermalInversionRisk: boolean;
  inversionReason: string;
  recommendedVentilationWindow: string;
  source: TelemetrySource;
  telemetrySource: TelemetryStatus;
}

export interface HouseholdProfile {
  city: string;
  ventilationType: VentilationType;
  hasAirPurifier: boolean;
  cookingFuel: CookingFuel;
  commuteMode: CommuteMode;
  sensitiveGroups: SensitiveGroup[];
  lifestyleNotes?: string;
  scaleOverride?: ScaleOverride;
}

export interface HouseholdFormDraft {
  city: string;
  ventilationType: VentilationType | '';
  hasAirPurifier: '' | 'yes' | 'no';
  cookingFuel: CookingFuel | '';
  commuteMode: CommuteMode | '';
  sensitiveGroups: SensitiveGroup[];
  lifestyleNotes: string;
  scaleOverride: ScaleOverride;
}

export interface WhyAndDirectImpact {
  mechanism: string;
  pm25ReductionPercent: number;
  co2SavedKgPerDay: number;
  costTier: CostTier;
  effortLevel: EffortLevel;
  groundedMetricRef: string;
}

export interface RecommendationCardData {
  id: string;
  pillar: PillarId;
  pillarLabel: string;
  title: string;
  actionSummary: string;
  whyAndDirectImpact: WhyAndDirectImpact;
  groundingAdjusted?: boolean;
  adjustmentNote?: string;
}

export interface ActionPlanResponse {
  telemetry: AirTelemetry;
  dailyBriefing: string;
  ventilationGuidance: string;
  recommendations: RecommendationCardData[];
  metadata: {
    modelUsed: string;
    cached: boolean;
    fallbackTriggered: boolean;
    generatedAt: string;
    groundingAdjustmentsCount: number;
  };
}

export interface AskAssistantRequest {
  question: string;
  profile: HouseholdProfile;
  telemetry?: AirTelemetry;
}

export interface AskAssistantResponse {
  answer: string;
  groundedMetricsUsed: string[];
  cautionNote: string;
  modelUsed: string;
  fallbackTriggered: boolean;
}

export interface CommunityImpactSummary {
  adoptedCount: number;
  totalRecommendations: number;
  householdScale: number;
  dailyCo2SavedPerHouseholdKg: number;
  monthlyCo2SavedPerHouseholdKg: number;
  monthlyCommunityCo2SavedKg: number;
  annualCommunityCo2SavedTonnes: number;
  combinedIndoorPm25ReductionPercent: number;
  estimatedIndoorPm25AfterAction: number;
  baselineIndoorPm25: number;
  treesEquivalentPerMonth: number;
}
