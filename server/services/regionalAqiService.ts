import type {
  RawPollutants,
  RegionalAqiResult,
  RegionalScaleCode,
  ScaleOverride,
  SeverityTier,
} from '../../src/types/airQuality';

export const EU_MEMBER_COUNTRY_CODES: ReadonlySet<string> = new Set([
  'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'SE', 'BE', 'AT', 'IE',
  'PT', 'GR', 'CZ', 'HU', 'RO', 'FI', 'DK', 'SK', 'BG', 'HR',
  'LT', 'SI', 'LV', 'EE', 'CY', 'LU', 'MT',
]);

export const REGIONAL_SCALE_NAMES: Record<RegionalScaleCode, string> = {
  IN_CPCB: 'India NAQI (CPCB)',
  US_EPA: 'US EPA AQI',
  CN_MEE: 'China MEE AQI',
  UK_DAQI: 'UK DAQI',
  EU_EAQI: 'European EAQI',
};

interface BreakpointBand {
  cLo: number;
  cHi: number;
  iLo: number;
  iHi: number;
}

function interpolateLinearSubIndex(
  concentration: number,
  bands: readonly BreakpointBand[],
  maxIndex: number,
): number {
  const safeVal = Math.max(0, Number.isFinite(concentration) ? concentration : 0);
  for (const band of bands) {
    if (safeVal <= band.cHi) {
      if (band.cHi === band.cLo) return band.iHi;
      const ratio = (band.iHi - band.iLo) / (band.cHi - band.cLo);
      return Math.round(ratio * (safeVal - band.cLo) + band.iLo);
    }
  }
  return maxIndex;
}

function stepBandLookup(
  concentration: number,
  thresholds: readonly { max: number; value: number }[],
  overflowValue: number,
): number {
  const safeVal = Math.max(0, Number.isFinite(concentration) ? concentration : 0);
  for (const t of thresholds) {
    if (safeVal <= t.max) return t.value;
  }
  return overflowValue;
}

/**
 * Resolves the official governing AQI scale from an ISO 3166-1 alpha-2 country code.
 */
export function resolveRegionalScaleForCountry(countryCode: string): RegionalScaleCode {
  const code = (countryCode || '').trim().toUpperCase();
  if (code === 'IN') return 'IN_CPCB';
  if (code === 'CN') return 'CN_MEE';
  if (code === 'GB' || code === 'UK') return 'UK_DAQI';
  if (EU_MEMBER_COUNTRY_CODES.has(code)) return 'EU_EAQI';
  return 'US_EPA';
}

function pickDominantSubIndex(
  entries: Array<{ pollutant: string; index: number }>,
): { pollutant: string; index: number } {
  let winner = entries[0];
  for (const item of entries) {
    if (item.index > winner.index) {
      winner = item;
    }
  }
  return winner;
}

// ---------------- INDIA NAQI (CPCB 0–500) ----------------
const IN_PM25_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 30, iLo: 0, iHi: 50 },
  { cLo: 30, cHi: 60, iLo: 51, iHi: 100 },
  { cLo: 60, cHi: 90, iLo: 101, iHi: 200 },
  { cLo: 90, cHi: 120, iLo: 201, iHi: 300 },
  { cLo: 120, cHi: 250, iLo: 301, iHi: 400 },
  { cLo: 250, cHi: 500, iLo: 401, iHi: 500 },
];

const IN_PM10_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
  { cLo: 50, cHi: 100, iLo: 51, iHi: 100 },
  { cLo: 100, cHi: 250, iLo: 101, iHi: 200 },
  { cLo: 250, cHi: 350, iLo: 201, iHi: 300 },
  { cLo: 350, cHi: 430, iLo: 301, iHi: 400 },
  { cLo: 430, cHi: 600, iLo: 401, iHi: 500 },
];

const IN_NO2_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 40, iLo: 0, iHi: 50 },
  { cLo: 40, cHi: 80, iLo: 51, iHi: 100 },
  { cLo: 80, cHi: 180, iLo: 101, iHi: 200 },
  { cLo: 180, cHi: 280, iLo: 201, iHi: 300 },
  { cLo: 280, cHi: 400, iLo: 301, iHi: 400 },
  { cLo: 400, cHi: 600, iLo: 401, iHi: 500 },
];

// CO in mg/m³ (Open-Meteo µg/m³ / 1000)
const IN_CO_MG_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 1.0, iLo: 0, iHi: 50 },
  { cLo: 1.0, cHi: 2.0, iLo: 51, iHi: 100 },
  { cLo: 2.0, cHi: 10.0, iLo: 101, iHi: 200 },
  { cLo: 10.0, cHi: 17.0, iLo: 201, iHi: 300 },
  { cLo: 17.0, cHi: 34.0, iLo: 301, iHi: 400 },
  { cLo: 34.0, cHi: 50.0, iLo: 401, iHi: 500 },
];

const IN_O3_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
  { cLo: 50, cHi: 100, iLo: 51, iHi: 100 },
  { cLo: 100, cHi: 168, iLo: 101, iHi: 200 },
  { cLo: 168, cHi: 208, iLo: 201, iHi: 300 },
  { cLo: 208, cHi: 748, iLo: 301, iHi: 400 },
  { cLo: 748, cHi: 1000, iLo: 401, iHi: 500 },
];

const IN_SO2_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 40, iLo: 0, iHi: 50 },
  { cLo: 40, cHi: 80, iLo: 51, iHi: 100 },
  { cLo: 80, cHi: 380, iLo: 101, iHi: 200 },
  { cLo: 380, cHi: 800, iLo: 201, iHi: 300 },
  { cLo: 800, cHi: 1600, iLo: 301, iHi: 400 },
  { cLo: 1600, cHi: 2000, iLo: 401, iHi: 500 },
];

function classifyIndiaNaqi(aqi: number): { label: string; tier: SeverityTier } {
  if (aqi <= 50) return { label: 'Good', tier: 1 };
  if (aqi <= 100) return { label: 'Satisfactory', tier: 2 };
  if (aqi <= 200) return { label: 'Moderately Polluted', tier: 3 };
  if (aqi <= 300) return { label: 'Poor', tier: 4 };
  if (aqi <= 400) return { label: 'Very Poor', tier: 5 };
  return { label: 'Severe', tier: 6 };
}

// ---------------- US EPA AQI (0–500) ----------------
const US_PM25_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 9.0, iLo: 0, iHi: 50 },
  { cLo: 9.0, cHi: 35.4, iLo: 51, iHi: 100 },
  { cLo: 35.4, cHi: 55.4, iLo: 101, iHi: 150 },
  { cLo: 55.4, cHi: 125.4, iLo: 151, iHi: 200 },
  { cLo: 125.4, cHi: 225.4, iLo: 201, iHi: 300 },
  { cLo: 225.4, cHi: 500.4, iLo: 301, iHi: 500 },
];

const US_PM10_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 54, iLo: 0, iHi: 50 },
  { cLo: 54, cHi: 154, iLo: 51, iHi: 100 },
  { cLo: 154, cHi: 254, iLo: 101, iHi: 150 },
  { cLo: 254, cHi: 354, iLo: 151, iHi: 200 },
  { cLo: 354, cHi: 424, iLo: 201, iHi: 300 },
  { cLo: 424, cHi: 604, iLo: 301, iHi: 500 },
];

// US NO2 in ppb (1 ppb ≈ 1.88 µg/m³ at 25°C)
const US_NO2_PPB_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 53, iLo: 0, iHi: 50 },
  { cLo: 53, cHi: 100, iLo: 51, iHi: 100 },
  { cLo: 100, cHi: 360, iLo: 101, iHi: 150 },
  { cLo: 360, cHi: 649, iLo: 151, iHi: 200 },
  { cLo: 649, cHi: 1249, iLo: 201, iHi: 300 },
  { cLo: 1249, cHi: 2049, iLo: 301, iHi: 500 },
];

// US O3 8h in ppb (1 ppb ≈ 1.96 µg/m³)
const US_O3_PPB_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 54, iLo: 0, iHi: 50 },
  { cLo: 54, cHi: 70, iLo: 51, iHi: 100 },
  { cLo: 70, cHi: 85, iLo: 101, iHi: 150 },
  { cLo: 85, cHi: 105, iLo: 151, iHi: 200 },
  { cLo: 105, cHi: 200, iLo: 201, iHi: 300 },
  { cLo: 200, cHi: 400, iLo: 301, iHi: 500 },
];

// US CO in ppm (1 ppm ≈ 1145 µg/m³)
const US_CO_PPM_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 4.4, iLo: 0, iHi: 50 },
  { cLo: 4.4, cHi: 9.4, iLo: 51, iHi: 100 },
  { cLo: 9.4, cHi: 12.4, iLo: 101, iHi: 150 },
  { cLo: 12.4, cHi: 15.4, iLo: 151, iHi: 200 },
  { cLo: 15.4, cHi: 30.4, iLo: 201, iHi: 300 },
  { cLo: 30.4, cHi: 50.4, iLo: 301, iHi: 500 },
];

function classifyUsEpa(aqi: number): { label: string; tier: SeverityTier } {
  if (aqi <= 50) return { label: 'Good', tier: 1 };
  if (aqi <= 100) return { label: 'Moderate', tier: 2 };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', tier: 3 };
  if (aqi <= 200) return { label: 'Unhealthy', tier: 4 };
  if (aqi <= 300) return { label: 'Very Unhealthy', tier: 5 };
  return { label: 'Hazardous', tier: 6 };
}

// ---------------- CHINA MEE AQI (HJ 633-2012, 0–500) ----------------
const CN_PM25_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 35, iLo: 0, iHi: 50 },
  { cLo: 35, cHi: 75, iLo: 51, iHi: 100 },
  { cLo: 75, cHi: 115, iLo: 101, iHi: 150 },
  { cLo: 115, cHi: 150, iLo: 151, iHi: 200 },
  { cLo: 150, cHi: 250, iLo: 201, iHi: 300 },
  { cLo: 250, cHi: 500, iLo: 301, iHi: 500 },
];

const CN_PM10_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
  { cLo: 50, cHi: 150, iLo: 51, iHi: 100 },
  { cLo: 150, cHi: 250, iLo: 101, iHi: 150 },
  { cLo: 250, cHi: 350, iLo: 151, iHi: 200 },
  { cLo: 350, cHi: 420, iLo: 201, iHi: 300 },
  { cLo: 420, cHi: 600, iLo: 301, iHi: 500 },
];

const CN_NO2_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 40, iLo: 0, iHi: 50 },
  { cLo: 40, cHi: 80, iLo: 51, iHi: 100 },
  { cLo: 80, cHi: 180, iLo: 101, iHi: 150 },
  { cLo: 180, cHi: 280, iLo: 151, iHi: 200 },
  { cLo: 280, cHi: 565, iLo: 201, iHi: 300 },
  { cLo: 565, cHi: 940, iLo: 301, iHi: 500 },
];

const CN_O3_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 100, iLo: 0, iHi: 50 },
  { cLo: 100, cHi: 160, iLo: 51, iHi: 100 },
  { cLo: 160, cHi: 215, iLo: 101, iHi: 150 },
  { cLo: 215, cHi: 265, iLo: 151, iHi: 200 },
  { cLo: 265, cHi: 800, iLo: 201, iHi: 300 },
  { cLo: 800, cHi: 1200, iLo: 301, iHi: 500 },
];

const CN_CO_MG_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 2, iLo: 0, iHi: 50 },
  { cLo: 2, cHi: 4, iLo: 51, iHi: 100 },
  { cLo: 4, cHi: 14, iLo: 101, iHi: 150 },
  { cLo: 14, cHi: 24, iLo: 151, iHi: 200 },
  { cLo: 24, cHi: 36, iLo: 201, iHi: 300 },
  { cLo: 36, cHi: 60, iLo: 301, iHi: 500 },
];

const CN_SO2_BANDS: BreakpointBand[] = [
  { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
  { cLo: 50, cHi: 150, iLo: 51, iHi: 100 },
  { cLo: 150, cHi: 475, iLo: 101, iHi: 150 },
  { cLo: 475, cHi: 800, iLo: 151, iHi: 200 },
  { cLo: 800, cHi: 1600, iLo: 201, iHi: 300 },
  { cLo: 1600, cHi: 2620, iLo: 301, iHi: 500 },
];

function classifyChinaMee(aqi: number): { label: string; tier: SeverityTier } {
  if (aqi <= 50) return { label: 'Excellent', tier: 1 };
  if (aqi <= 100) return { label: 'Good', tier: 2 };
  if (aqi <= 150) return { label: 'Lightly Polluted', tier: 3 };
  if (aqi <= 200) return { label: 'Moderately Polluted', tier: 4 };
  if (aqi <= 300) return { label: 'Heavily Polluted', tier: 5 };
  return { label: 'Severely Polluted', tier: 6 };
}

// ---------------- UK DAQI (1–10) ----------------
const UK_PM25_STEPS = [
  { max: 11, value: 1 },
  { max: 23, value: 2 },
  { max: 35, value: 3 },
  { max: 41, value: 4 },
  { max: 47, value: 5 },
  { max: 53, value: 6 },
  { max: 58, value: 7 },
  { max: 64, value: 8 },
  { max: 70, value: 9 },
];

const UK_PM10_STEPS = [
  { max: 16, value: 1 },
  { max: 33, value: 2 },
  { max: 50, value: 3 },
  { max: 58, value: 4 },
  { max: 66, value: 5 },
  { max: 75, value: 6 },
  { max: 83, value: 7 },
  { max: 91, value: 8 },
  { max: 100, value: 9 },
];

const UK_NO2_STEPS = [
  { max: 67, value: 1 },
  { max: 134, value: 2 },
  { max: 200, value: 3 },
  { max: 267, value: 4 },
  { max: 334, value: 5 },
  { max: 400, value: 6 },
  { max: 467, value: 7 },
  { max: 534, value: 8 },
  { max: 600, value: 9 },
];

const UK_O3_STEPS = [
  { max: 33, value: 1 },
  { max: 66, value: 2 },
  { max: 100, value: 3 },
  { max: 120, value: 4 },
  { max: 140, value: 5 },
  { max: 160, value: 6 },
  { max: 187, value: 7 },
  { max: 213, value: 8 },
  { max: 240, value: 9 },
];

function classifyUkDaqi(daqi: number): { label: string; tier: SeverityTier } {
  if (daqi <= 3) return { label: 'Low', tier: 1 };
  if (daqi <= 6) return { label: 'Moderate', tier: 3 };
  if (daqi <= 9) return { label: 'High', tier: 5 };
  return { label: 'Very High', tier: 6 };
}

// ---------------- EUROPEAN EAQI (1–6) ----------------
const EU_PM25_STEPS = [
  { max: 10, value: 1 },
  { max: 20, value: 2 },
  { max: 25, value: 3 },
  { max: 50, value: 4 },
  { max: 75, value: 5 },
];

const EU_PM10_STEPS = [
  { max: 20, value: 1 },
  { max: 40, value: 2 },
  { max: 50, value: 3 },
  { max: 100, value: 4 },
  { max: 150, value: 5 },
];

const EU_NO2_STEPS = [
  { max: 40, value: 1 },
  { max: 90, value: 2 },
  { max: 120, value: 3 },
  { max: 230, value: 4 },
  { max: 340, value: 5 },
];

const EU_O3_STEPS = [
  { max: 50, value: 1 },
  { max: 100, value: 2 },
  { max: 130, value: 3 },
  { max: 240, value: 4 },
  { max: 380, value: 5 },
];

const EU_SO2_STEPS = [
  { max: 100, value: 1 },
  { max: 200, value: 2 },
  { max: 350, value: 3 },
  { max: 500, value: 4 },
  { max: 750, value: 5 },
];

function classifyEuEaqi(eaqi: number): { label: string; tier: SeverityTier } {
  switch (eaqi) {
    case 1:
      return { label: 'Good', tier: 1 };
    case 2:
      return { label: 'Fair', tier: 2 };
    case 3:
      return { label: 'Moderate', tier: 3 };
    case 4:
      return { label: 'Poor', tier: 4 };
    case 5:
      return { label: 'Very Poor', tier: 5 };
    default:
      return { label: 'Extremely Poor', tier: 6 };
  }
}

/**
 * Computes the official regional Air Quality Index directly from live raw pollutant
 * concentrations using linear sub-index interpolation (or discrete threshold lookup for UK/EU)
 * and selecting the dominant (worst) pollutant sub-index.
 */
export function computeRegionalAqi(
  pollutants: RawPollutants,
  countryCode: string,
  scaleOverride: ScaleOverride = 'AUTO',
): RegionalAqiResult {
  const autoScale = resolveRegionalScaleForCountry(countryCode);
  const isAutoSelectedScale = !scaleOverride || scaleOverride === 'AUTO';
  const scaleCode: RegionalScaleCode = isAutoSelectedScale ? autoScale : scaleOverride;
  const scaleName = REGIONAL_SCALE_NAMES[scaleCode];

  if (scaleCode === 'IN_CPCB') {
    const coMg = pollutants.co / 1000;
    const winner = pickDominantSubIndex([
      { pollutant: 'PM2.5', index: interpolateLinearSubIndex(pollutants.pm25, IN_PM25_BANDS, 500) },
      { pollutant: 'PM10', index: interpolateLinearSubIndex(pollutants.pm10, IN_PM10_BANDS, 500) },
      { pollutant: 'NO2', index: interpolateLinearSubIndex(pollutants.no2, IN_NO2_BANDS, 500) },
      { pollutant: 'CO', index: interpolateLinearSubIndex(coMg, IN_CO_MG_BANDS, 500) },
      { pollutant: 'O3', index: interpolateLinearSubIndex(pollutants.o3, IN_O3_BANDS, 500) },
      { pollutant: 'SO2', index: interpolateLinearSubIndex(pollutants.so2, IN_SO2_BANDS, 500) },
    ]);
    const { label, tier } = classifyIndiaNaqi(winner.index);
    return {
      aqiValue: winner.index,
      scaleMax: 500,
      scaleCode,
      scaleName,
      categoryLabel: label,
      severityTier: tier,
      dominantPollutant: winner.pollutant,
      isAutoSelectedScale,
    };
  }

  if (scaleCode === 'CN_MEE') {
    const coMg = pollutants.co / 1000;
    const winner = pickDominantSubIndex([
      { pollutant: 'PM2.5', index: interpolateLinearSubIndex(pollutants.pm25, CN_PM25_BANDS, 500) },
      { pollutant: 'PM10', index: interpolateLinearSubIndex(pollutants.pm10, CN_PM10_BANDS, 500) },
      { pollutant: 'NO2', index: interpolateLinearSubIndex(pollutants.no2, CN_NO2_BANDS, 500) },
      { pollutant: 'O3', index: interpolateLinearSubIndex(pollutants.o3, CN_O3_BANDS, 500) },
      { pollutant: 'CO', index: interpolateLinearSubIndex(coMg, CN_CO_MG_BANDS, 500) },
      { pollutant: 'SO2', index: interpolateLinearSubIndex(pollutants.so2, CN_SO2_BANDS, 500) },
    ]);
    const { label, tier } = classifyChinaMee(winner.index);
    return {
      aqiValue: winner.index,
      scaleMax: 500,
      scaleCode,
      scaleName,
      categoryLabel: label,
      severityTier: tier,
      dominantPollutant: winner.pollutant,
      isAutoSelectedScale,
    };
  }

  if (scaleCode === 'UK_DAQI') {
    const winner = pickDominantSubIndex([
      { pollutant: 'PM2.5', index: stepBandLookup(pollutants.pm25, UK_PM25_STEPS, 10) },
      { pollutant: 'PM10', index: stepBandLookup(pollutants.pm10, UK_PM10_STEPS, 10) },
      { pollutant: 'NO2', index: stepBandLookup(pollutants.no2, UK_NO2_STEPS, 10) },
      { pollutant: 'O3', index: stepBandLookup(pollutants.o3, UK_O3_STEPS, 10) },
    ]);
    const { label, tier } = classifyUkDaqi(winner.index);
    return {
      aqiValue: winner.index,
      scaleMax: 10,
      scaleCode,
      scaleName,
      categoryLabel: label,
      severityTier: tier,
      dominantPollutant: winner.pollutant,
      isAutoSelectedScale,
    };
  }

  if (scaleCode === 'EU_EAQI') {
    const winner = pickDominantSubIndex([
      { pollutant: 'PM2.5', index: stepBandLookup(pollutants.pm25, EU_PM25_STEPS, 6) },
      { pollutant: 'PM10', index: stepBandLookup(pollutants.pm10, EU_PM10_STEPS, 6) },
      { pollutant: 'NO2', index: stepBandLookup(pollutants.no2, EU_NO2_STEPS, 6) },
      { pollutant: 'O3', index: stepBandLookup(pollutants.o3, EU_O3_STEPS, 6) },
      { pollutant: 'SO2', index: stepBandLookup(pollutants.so2, EU_SO2_STEPS, 6) },
    ]);
    const { label, tier } = classifyEuEaqi(winner.index);
    return {
      aqiValue: winner.index,
      scaleMax: 6,
      scaleCode,
      scaleName,
      categoryLabel: label,
      severityTier: tier,
      dominantPollutant: winner.pollutant,
      isAutoSelectedScale,
    };
  }

  // US_EPA (Default & US)
  const no2Ppb = pollutants.no2 / 1.88;
  const o3Ppb = pollutants.o3 / 1.96;
  const coPpm = pollutants.co / 1145;
  const winner = pickDominantSubIndex([
    { pollutant: 'PM2.5', index: interpolateLinearSubIndex(pollutants.pm25, US_PM25_BANDS, 500) },
    { pollutant: 'PM10', index: interpolateLinearSubIndex(pollutants.pm10, US_PM10_BANDS, 500) },
    { pollutant: 'NO2', index: interpolateLinearSubIndex(no2Ppb, US_NO2_PPB_BANDS, 500) },
    { pollutant: 'O3', index: interpolateLinearSubIndex(o3Ppb, US_O3_PPB_BANDS, 500) },
    { pollutant: 'CO', index: interpolateLinearSubIndex(coPpm, US_CO_PPM_BANDS, 500) },
  ]);
  const { label, tier } = classifyUsEpa(winner.index);
  return {
    aqiValue: winner.index,
    scaleMax: 500,
    scaleCode: 'US_EPA',
    scaleName,
    categoryLabel: label,
    severityTier: tier,
    dominantPollutant: winner.pollutant,
    isAutoSelectedScale,
  };
}
