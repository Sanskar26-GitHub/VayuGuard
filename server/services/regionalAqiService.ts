import type {
  PollutantSubIndexDetail,
  RawPollutants,
  RegionalAqiResult,
  RegionalScaleCode,
  ScaleOverride,
} from '../../src/types/airQuality';
import {
  EU_MEMBER_COUNTRY_CODES,
  REGIONAL_SCALE_CONFIGS,
  REGIONAL_SCALE_NAMES,
  type BreakpointRange,
} from '../constants/aqiBreakpoints';

export { EU_MEMBER_COUNTRY_CODES, REGIONAL_SCALE_NAMES };

type PollutantKey = PollutantSubIndexDetail['pollutant'];

const ORDERED_POLLUTANT_SPECS: ReadonlyArray<{
  readonly pollutant: PollutantKey;
  readonly rawField: keyof RawPollutants;
  readonly unit: 'µg/m³' | 'mg/m³';
  readonly displayScale: number;
  readonly decimals: number;
}> = [
  { pollutant: 'PM2.5', rawField: 'pm25', unit: 'µg/m³', displayScale: 1, decimals: 1 },
  { pollutant: 'PM10', rawField: 'pm10', unit: 'µg/m³', displayScale: 1, decimals: 1 },
  { pollutant: 'NO2', rawField: 'no2', unit: 'µg/m³', displayScale: 1, decimals: 1 },
  { pollutant: 'CO', rawField: 'co', unit: 'mg/m³', displayScale: 0.001, decimals: 3 },
  { pollutant: 'O3', rawField: 'o3', unit: 'µg/m³', displayScale: 1, decimals: 1 },
  { pollutant: 'SO2', rawField: 'so2', unit: 'µg/m³', displayScale: 1, decimals: 1 },
];

function isValidNumber(val: number | null | undefined): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

/**
 * Computes a pollutant's AQI sub-index across either continuous 0–500 ranges
 * or discrete step bands using a single unified breakpoint table.
 *
 * @param concentration - Pollutant concentration converted to the breakpoint table's unit.
 * @param breakpoints - Ordered list of {@link BreakpointRange} segments.
 * @returns Rounded integer sub-index within the scale bounds.
 */
export function interpolateSubIndex(
  concentration: number,
  breakpoints: readonly BreakpointRange[],
): number {
  if (breakpoints.length === 0) return 0;
  const safeVal = Math.max(0, Number.isFinite(concentration) ? concentration : 0);

  for (const band of breakpoints) {
    if (safeVal <= band.cHi) {
      if (band.iLo === band.iHi || band.cHi === band.cLo) {
        return band.iHi;
      }
      const slope = (band.iHi - band.iLo) / (band.cHi - band.cLo);
      return Math.round(slope * (safeVal - band.cLo) + band.iLo);
    }
  }

  return breakpoints[breakpoints.length - 1].iHi;
}

/**
 * Resolves the official governing AQI standard from an ISO 3166-1 alpha-2 country code.
 *
 * @param countryCode - Two-letter ISO country code (e.g. `"IN"`, `"US"`, `"GB"`, `"DE"`, `"CN"`).
 * @returns The matching {@link RegionalScaleCode} standard.
 */
export function resolveScaleForCountry(countryCode: string): RegionalScaleCode {
  const code = (countryCode || '').trim().toUpperCase();
  if (code === 'IN') return 'IN_CPCB';
  if (code === 'CN') return 'CN_MEE';
  if (code === 'GB' || code === 'UK') return 'UK_DAQI';
  if (EU_MEMBER_COUNTRY_CODES.has(code)) return 'EU_EAQI';
  return 'US_EPA';
}

/**
 * Alias for {@link resolveScaleForCountry} preserved for backward compatibility.
 *
 * @param countryCode - Two-letter ISO country code.
 * @returns The matching {@link RegionalScaleCode} standard.
 */
export function resolveRegionalScaleForCountry(countryCode: string): RegionalScaleCode {
  return resolveScaleForCountry(countryCode);
}

/**
 * Computes the official regional Air Quality Index directly from available non-null live
 * raw pollutant concentrations using unified sub-index interpolation and selecting the
 * dominant (highest sub-index) pollutant.
 *
 * @param pollutants - Raw pollutant concentrations (`null` for unavailable readings).
 * @param countryCode - ISO 3166-1 alpha-2 country code of the resolved location.
 * @param scaleOverride - Optional manual AQI scale override or `'AUTO'`.
 * @returns Regional AQI score, category, dominant pollutant, and per-pollutant breakdown.
 */
export function computeRegionalAqi(
  pollutants: RawPollutants,
  countryCode: string,
  scaleOverride: ScaleOverride = 'AUTO',
): RegionalAqiResult {
  const autoScale = resolveScaleForCountry(countryCode);
  const isAutoSelectedScale = !scaleOverride || scaleOverride === 'AUTO';
  const scaleCode: RegionalScaleCode = isAutoSelectedScale ? autoScale : scaleOverride;
  const config = REGIONAL_SCALE_CONFIGS[scaleCode];

  let winner: { pollutant: string; index: number } | null = null;
  const rawEntries = ORDERED_POLLUTANT_SPECS.map((spec) => {
    const rawValue = pollutants[spec.rawField];
    const valid = isValidNumber(rawValue);
    const rule = config.pollutants[spec.pollutant];
    const subIndex =
      valid && rule ? interpolateSubIndex(rawValue * rule.scaleFactor, rule.breakpoints) : null;

    if (subIndex !== null && (!winner || subIndex > winner.index)) {
      winner = { pollutant: spec.pollutant, index: subIndex };
    }

    return {
      pollutant: spec.pollutant,
      concentration: valid ? Number((rawValue * spec.displayScale).toFixed(spec.decimals)) : null,
      unit: spec.unit,
      subIndex,
    };
  });

  const resolvedWinner = winner ?? { pollutant: 'PM2.5', index: 0 };
  const pollutantSubIndices: PollutantSubIndexDetail[] = rawEntries.map((entry) => ({
    pollutant: entry.pollutant,
    concentration: entry.concentration,
    unit: entry.unit,
    subIndex: entry.subIndex,
    isDominant: entry.subIndex !== null && entry.pollutant === resolvedWinner.pollutant,
  }));

  const { label, tier } = config.classify(resolvedWinner.index);

  return {
    aqiValue: resolvedWinner.index,
    scaleMax: config.scaleMax,
    scaleCode: config.scaleCode,
    scaleName: config.scaleName,
    categoryLabel: label,
    severityTier: tier,
    dominantPollutant: resolvedWinner.pollutant,
    isAutoSelectedScale,
    pollutantSubIndices,
  };
}
