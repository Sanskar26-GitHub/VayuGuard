import type {
  PollutantSubIndexDetail,
  RegionalScaleCode,
  SeverityTier,
} from '../../src/types/airQuality';

/**
 * Represents a single concentration-to-sub-index breakpoint segment.
 * For continuous 0–500 scales, `iLo` and `iHi` span the linear output band;
 * for discrete index scales (UK DAQI, EU EAQI), `iLo` and `iHi` share the band integer.
 */
export interface BreakpointRange {
  readonly cLo: number;
  readonly cHi: number;
  readonly iLo: number;
  readonly iHi: number;
}

/**
 * Descriptor for converting raw Open-Meteo concentrations into a regional scale's units
 * and evaluating its sub-index via {@link BreakpointRange} lookup.
 */
export interface PollutantRuleConfig {
  readonly scaleFactor: number;
  readonly breakpoints: readonly BreakpointRange[];
}

/**
 * Complete declarative configuration for a regional AQI standard.
 */
export interface RegionalScaleConfig {
  readonly scaleCode: RegionalScaleCode;
  readonly scaleName: string;
  readonly scaleMax: 500 | 10 | 6;
  readonly pollutants: Partial<Record<PollutantSubIndexDetail['pollutant'], PollutantRuleConfig>>;
  readonly classify: (indexValue: number) => { label: string; tier: SeverityTier };
}

/**
 * Representative offline meteorological baseline used strictly when live Open-Meteo
 * endpoints cannot be reached after retry.
 */
export interface BaselineProfile {
  readonly name: string;
  readonly admin1: string;
  readonly country: string;
  readonly countryCode: string;
  readonly timezone: string;
  readonly timezoneAbbreviation: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly usAqi: number;
  readonly pm25: number;
  readonly pm10: number;
  readonly no2: number;
  readonly co: number;
  readonly o3: number;
  readonly so2: number;
  readonly temperatureC: number;
  readonly humidityPercent: number;
  readonly windSpeedKmh: number;
}

/**
 * ISO 3166-1 alpha-2 country codes for the 27 EU member states governed by European EAQI.
 */
export const EU_MEMBER_COUNTRY_CODES: ReadonlySet<string> = new Set([
  'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'SE', 'BE', 'AT', 'IE',
  'PT', 'GR', 'CZ', 'HU', 'RO', 'FI', 'DK', 'SK', 'BG', 'HR',
  'LT', 'SI', 'LV', 'EE', 'CY', 'LU', 'MT',
]);

/**
 * Human-readable display names for every supported regional AQI standard.
 */
export const REGIONAL_SCALE_NAMES: Readonly<Record<RegionalScaleCode, string>> = {
  IN_CPCB: 'India NAQI (CPCB)',
  US_EPA: 'US EPA AQI',
  CN_MEE: 'China MEE AQI',
  UK_DAQI: 'UK DAQI',
  EU_EAQI: 'European EAQI',
};

const IN_CPCB_CONFIG: RegionalScaleConfig = {
  scaleCode: 'IN_CPCB',
  scaleName: REGIONAL_SCALE_NAMES.IN_CPCB,
  scaleMax: 500,
  pollutants: {
    'PM2.5': {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 30, iLo: 0, iHi: 50 },
        { cLo: 30, cHi: 60, iLo: 51, iHi: 100 },
        { cLo: 60, cHi: 90, iLo: 101, iHi: 200 },
        { cLo: 90, cHi: 120, iLo: 201, iHi: 300 },
        { cLo: 120, cHi: 250, iLo: 301, iHi: 400 },
        { cLo: 250, cHi: 500, iLo: 401, iHi: 500 },
      ],
    },
    PM10: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
        { cLo: 50, cHi: 100, iLo: 51, iHi: 100 },
        { cLo: 100, cHi: 250, iLo: 101, iHi: 200 },
        { cLo: 250, cHi: 350, iLo: 201, iHi: 300 },
        { cLo: 350, cHi: 430, iLo: 301, iHi: 400 },
        { cLo: 430, cHi: 600, iLo: 401, iHi: 500 },
      ],
    },
    NO2: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 40, iLo: 0, iHi: 50 },
        { cLo: 40, cHi: 80, iLo: 51, iHi: 100 },
        { cLo: 80, cHi: 180, iLo: 101, iHi: 200 },
        { cLo: 180, cHi: 280, iLo: 201, iHi: 300 },
        { cLo: 280, cHi: 400, iLo: 301, iHi: 400 },
        { cLo: 400, cHi: 600, iLo: 401, iHi: 500 },
      ],
    },
    CO: {
      // Open-Meteo reports CO in µg/m³; CPCB CO breakpoints use mg/m³.
      scaleFactor: 1 / 1000,
      breakpoints: [
        { cLo: 0, cHi: 1.0, iLo: 0, iHi: 50 },
        { cLo: 1.0, cHi: 2.0, iLo: 51, iHi: 100 },
        { cLo: 2.0, cHi: 10.0, iLo: 101, iHi: 200 },
        { cLo: 10.0, cHi: 17.0, iLo: 201, iHi: 300 },
        { cLo: 17.0, cHi: 34.0, iLo: 301, iHi: 400 },
        { cLo: 34.0, cHi: 50.0, iLo: 401, iHi: 500 },
      ],
    },
    O3: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
        { cLo: 50, cHi: 100, iLo: 51, iHi: 100 },
        { cLo: 100, cHi: 168, iLo: 101, iHi: 200 },
        { cLo: 168, cHi: 208, iLo: 201, iHi: 300 },
        { cLo: 208, cHi: 748, iLo: 301, iHi: 400 },
        { cLo: 748, cHi: 1000, iLo: 401, iHi: 500 },
      ],
    },
    SO2: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 40, iLo: 0, iHi: 50 },
        { cLo: 40, cHi: 80, iLo: 51, iHi: 100 },
        { cLo: 80, cHi: 380, iLo: 101, iHi: 200 },
        { cLo: 380, cHi: 800, iLo: 201, iHi: 300 },
        { cLo: 800, cHi: 1600, iLo: 301, iHi: 400 },
        { cLo: 1600, cHi: 2000, iLo: 401, iHi: 500 },
      ],
    },
  },
  classify: (aqi) => {
    if (aqi <= 50) return { label: 'Good', tier: 1 };
    if (aqi <= 100) return { label: 'Satisfactory', tier: 2 };
    if (aqi <= 200) return { label: 'Moderately Polluted', tier: 3 };
    if (aqi <= 300) return { label: 'Poor', tier: 4 };
    if (aqi <= 400) return { label: 'Very Poor', tier: 5 };
    return { label: 'Severe', tier: 6 };
  },
};

const US_EPA_CONFIG: RegionalScaleConfig = {
  scaleCode: 'US_EPA',
  scaleName: REGIONAL_SCALE_NAMES.US_EPA,
  scaleMax: 500,
  pollutants: {
    'PM2.5': {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 9.0, iLo: 0, iHi: 50 },
        { cLo: 9.0, cHi: 35.4, iLo: 51, iHi: 100 },
        { cLo: 35.4, cHi: 55.4, iLo: 101, iHi: 150 },
        { cLo: 55.4, cHi: 125.4, iLo: 151, iHi: 200 },
        { cLo: 125.4, cHi: 225.4, iLo: 201, iHi: 300 },
        { cLo: 225.4, cHi: 500.4, iLo: 301, iHi: 500 },
      ],
    },
    PM10: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 54, iLo: 0, iHi: 50 },
        { cLo: 54, cHi: 154, iLo: 51, iHi: 100 },
        { cLo: 154, cHi: 254, iLo: 101, iHi: 150 },
        { cLo: 254, cHi: 354, iLo: 151, iHi: 200 },
        { cLo: 354, cHi: 424, iLo: 201, iHi: 300 },
        { cLo: 424, cHi: 604, iLo: 301, iHi: 500 },
      ],
    },
    NO2: {
      // 1 ppb NO2 ≈ 1.88 µg/m³ at 25°C.
      scaleFactor: 1 / 1.88,
      breakpoints: [
        { cLo: 0, cHi: 53, iLo: 0, iHi: 50 },
        { cLo: 53, cHi: 100, iLo: 51, iHi: 100 },
        { cLo: 100, cHi: 360, iLo: 101, iHi: 150 },
        { cLo: 360, cHi: 649, iLo: 151, iHi: 200 },
        { cLo: 649, cHi: 1249, iLo: 201, iHi: 300 },
        { cLo: 1249, cHi: 2049, iLo: 301, iHi: 500 },
      ],
    },
    CO: {
      // 1 ppm CO ≈ 1145 µg/m³.
      scaleFactor: 1 / 1145,
      breakpoints: [
        { cLo: 0, cHi: 4.4, iLo: 0, iHi: 50 },
        { cLo: 4.4, cHi: 9.4, iLo: 51, iHi: 100 },
        { cLo: 9.4, cHi: 12.4, iLo: 101, iHi: 150 },
        { cLo: 12.4, cHi: 15.4, iLo: 151, iHi: 200 },
        { cLo: 15.4, cHi: 30.4, iLo: 201, iHi: 300 },
        { cLo: 30.4, cHi: 50.4, iLo: 301, iHi: 500 },
      ],
    },
    O3: {
      // 1 ppb O3 ≈ 1.96 µg/m³.
      scaleFactor: 1 / 1.96,
      breakpoints: [
        { cLo: 0, cHi: 54, iLo: 0, iHi: 50 },
        { cLo: 54, cHi: 70, iLo: 51, iHi: 100 },
        { cLo: 70, cHi: 85, iLo: 101, iHi: 150 },
        { cLo: 85, cHi: 105, iLo: 151, iHi: 200 },
        { cLo: 105, cHi: 200, iLo: 201, iHi: 300 },
        { cLo: 200, cHi: 400, iLo: 301, iHi: 500 },
      ],
    },
    SO2: {
      // 1 ppb SO2 ≈ 2.62 µg/m³.
      scaleFactor: 1 / 2.62,
      breakpoints: [
        { cLo: 0, cHi: 35, iLo: 0, iHi: 50 },
        { cLo: 35, cHi: 75, iLo: 51, iHi: 100 },
        { cLo: 75, cHi: 185, iLo: 101, iHi: 150 },
        { cLo: 185, cHi: 304, iLo: 151, iHi: 200 },
        { cLo: 304, cHi: 604, iLo: 201, iHi: 300 },
        { cLo: 604, cHi: 1004, iLo: 301, iHi: 500 },
      ],
    },
  },
  classify: (aqi) => {
    if (aqi <= 50) return { label: 'Good', tier: 1 };
    if (aqi <= 100) return { label: 'Moderate', tier: 2 };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', tier: 3 };
    if (aqi <= 200) return { label: 'Unhealthy', tier: 4 };
    if (aqi <= 300) return { label: 'Very Unhealthy', tier: 5 };
    return { label: 'Hazardous', tier: 6 };
  },
};

const CN_MEE_CONFIG: RegionalScaleConfig = {
  scaleCode: 'CN_MEE',
  scaleName: REGIONAL_SCALE_NAMES.CN_MEE,
  scaleMax: 500,
  pollutants: {
    'PM2.5': {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 35, iLo: 0, iHi: 50 },
        { cLo: 35, cHi: 75, iLo: 51, iHi: 100 },
        { cLo: 75, cHi: 115, iLo: 101, iHi: 150 },
        { cLo: 115, cHi: 150, iLo: 151, iHi: 200 },
        { cLo: 150, cHi: 250, iLo: 201, iHi: 300 },
        { cLo: 250, cHi: 500, iLo: 301, iHi: 500 },
      ],
    },
    PM10: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
        { cLo: 50, cHi: 150, iLo: 51, iHi: 100 },
        { cLo: 150, cHi: 250, iLo: 101, iHi: 150 },
        { cLo: 250, cHi: 350, iLo: 151, iHi: 200 },
        { cLo: 350, cHi: 420, iLo: 201, iHi: 300 },
        { cLo: 420, cHi: 600, iLo: 301, iHi: 500 },
      ],
    },
    NO2: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 40, iLo: 0, iHi: 50 },
        { cLo: 40, cHi: 80, iLo: 51, iHi: 100 },
        { cLo: 80, cHi: 180, iLo: 101, iHi: 150 },
        { cLo: 180, cHi: 280, iLo: 151, iHi: 200 },
        { cLo: 280, cHi: 565, iLo: 201, iHi: 300 },
        { cLo: 565, cHi: 940, iLo: 301, iHi: 500 },
      ],
    },
    CO: {
      scaleFactor: 1 / 1000,
      breakpoints: [
        { cLo: 0, cHi: 2, iLo: 0, iHi: 50 },
        { cLo: 2, cHi: 4, iLo: 51, iHi: 100 },
        { cLo: 4, cHi: 14, iLo: 101, iHi: 150 },
        { cLo: 14, cHi: 24, iLo: 151, iHi: 200 },
        { cLo: 24, cHi: 36, iLo: 201, iHi: 300 },
        { cLo: 36, cHi: 60, iLo: 301, iHi: 500 },
      ],
    },
    O3: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 100, iLo: 0, iHi: 50 },
        { cLo: 100, cHi: 160, iLo: 51, iHi: 100 },
        { cLo: 160, cHi: 215, iLo: 101, iHi: 150 },
        { cLo: 215, cHi: 265, iLo: 151, iHi: 200 },
        { cLo: 265, cHi: 800, iLo: 201, iHi: 300 },
        { cLo: 800, cHi: 1200, iLo: 301, iHi: 500 },
      ],
    },
    SO2: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
        { cLo: 50, cHi: 150, iLo: 51, iHi: 100 },
        { cLo: 150, cHi: 475, iLo: 101, iHi: 150 },
        { cLo: 475, cHi: 800, iLo: 151, iHi: 200 },
        { cLo: 800, cHi: 1600, iLo: 201, iHi: 300 },
        { cLo: 1600, cHi: 2620, iLo: 301, iHi: 500 },
      ],
    },
  },
  classify: (aqi) => {
    if (aqi <= 50) return { label: 'Excellent', tier: 1 };
    if (aqi <= 100) return { label: 'Good', tier: 2 };
    if (aqi <= 150) return { label: 'Lightly Polluted', tier: 3 };
    if (aqi <= 200) return { label: 'Moderately Polluted', tier: 4 };
    if (aqi <= 300) return { label: 'Heavily Polluted', tier: 5 };
    return { label: 'Severely Polluted', tier: 6 };
  },
};

const UK_DAQI_CONFIG: RegionalScaleConfig = {
  scaleCode: 'UK_DAQI',
  scaleName: REGIONAL_SCALE_NAMES.UK_DAQI,
  scaleMax: 10,
  pollutants: {
    'PM2.5': {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 11, iLo: 1, iHi: 1 },
        { cLo: 11, cHi: 23, iLo: 2, iHi: 2 },
        { cLo: 23, cHi: 35, iLo: 3, iHi: 3 },
        { cLo: 35, cHi: 41, iLo: 4, iHi: 4 },
        { cLo: 41, cHi: 47, iLo: 5, iHi: 5 },
        { cLo: 47, cHi: 53, iLo: 6, iHi: 6 },
        { cLo: 53, cHi: 58, iLo: 7, iHi: 7 },
        { cLo: 58, cHi: 64, iLo: 8, iHi: 8 },
        { cLo: 64, cHi: 70, iLo: 9, iHi: 9 },
        { cLo: 70, cHi: Number.POSITIVE_INFINITY, iLo: 10, iHi: 10 },
      ],
    },
    PM10: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 16, iLo: 1, iHi: 1 },
        { cLo: 16, cHi: 33, iLo: 2, iHi: 2 },
        { cLo: 33, cHi: 50, iLo: 3, iHi: 3 },
        { cLo: 50, cHi: 58, iLo: 4, iHi: 4 },
        { cLo: 58, cHi: 66, iLo: 5, iHi: 5 },
        { cLo: 66, cHi: 75, iLo: 6, iHi: 6 },
        { cLo: 75, cHi: 83, iLo: 7, iHi: 7 },
        { cLo: 83, cHi: 91, iLo: 8, iHi: 8 },
        { cLo: 91, cHi: 100, iLo: 9, iHi: 9 },
        { cLo: 100, cHi: Number.POSITIVE_INFINITY, iLo: 10, iHi: 10 },
      ],
    },
    NO2: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 67, iLo: 1, iHi: 1 },
        { cLo: 67, cHi: 134, iLo: 2, iHi: 2 },
        { cLo: 134, cHi: 200, iLo: 3, iHi: 3 },
        { cLo: 200, cHi: 267, iLo: 4, iHi: 4 },
        { cLo: 267, cHi: 334, iLo: 5, iHi: 5 },
        { cLo: 334, cHi: 400, iLo: 6, iHi: 6 },
        { cLo: 400, cHi: 467, iLo: 7, iHi: 7 },
        { cLo: 467, cHi: 534, iLo: 8, iHi: 8 },
        { cLo: 534, cHi: 600, iLo: 9, iHi: 9 },
        { cLo: 600, cHi: Number.POSITIVE_INFINITY, iLo: 10, iHi: 10 },
      ],
    },
    O3: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 33, iLo: 1, iHi: 1 },
        { cLo: 33, cHi: 66, iLo: 2, iHi: 2 },
        { cLo: 66, cHi: 100, iLo: 3, iHi: 3 },
        { cLo: 100, cHi: 120, iLo: 4, iHi: 4 },
        { cLo: 120, cHi: 140, iLo: 5, iHi: 5 },
        { cLo: 140, cHi: 160, iLo: 6, iHi: 6 },
        { cLo: 160, cHi: 187, iLo: 7, iHi: 7 },
        { cLo: 187, cHi: 213, iLo: 8, iHi: 8 },
        { cLo: 213, cHi: 240, iLo: 9, iHi: 9 },
        { cLo: 240, cHi: Number.POSITIVE_INFINITY, iLo: 10, iHi: 10 },
      ],
    },
    SO2: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 88, iLo: 1, iHi: 1 },
        { cLo: 88, cHi: 177, iLo: 2, iHi: 2 },
        { cLo: 177, cHi: 266, iLo: 3, iHi: 3 },
        { cLo: 266, cHi: 354, iLo: 4, iHi: 4 },
        { cLo: 354, cHi: 443, iLo: 5, iHi: 5 },
        { cLo: 443, cHi: 532, iLo: 6, iHi: 6 },
        { cLo: 532, cHi: 710, iLo: 7, iHi: 7 },
        { cLo: 710, cHi: 887, iLo: 8, iHi: 8 },
        { cLo: 887, cHi: 1064, iLo: 9, iHi: 9 },
        { cLo: 1064, cHi: Number.POSITIVE_INFINITY, iLo: 10, iHi: 10 },
      ],
    },
  },
  classify: (daqi) => {
    if (daqi <= 3) return { label: 'Low', tier: 1 };
    if (daqi <= 6) return { label: 'Moderate', tier: 3 };
    if (daqi <= 9) return { label: 'High', tier: 5 };
    return { label: 'Very High', tier: 6 };
  },
};

const EU_EAQI_CONFIG: RegionalScaleConfig = {
  scaleCode: 'EU_EAQI',
  scaleName: REGIONAL_SCALE_NAMES.EU_EAQI,
  scaleMax: 6,
  pollutants: {
    'PM2.5': {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 10, iLo: 1, iHi: 1 },
        { cLo: 10, cHi: 20, iLo: 2, iHi: 2 },
        { cLo: 20, cHi: 25, iLo: 3, iHi: 3 },
        { cLo: 25, cHi: 50, iLo: 4, iHi: 4 },
        { cLo: 50, cHi: 75, iLo: 5, iHi: 5 },
        { cLo: 75, cHi: Number.POSITIVE_INFINITY, iLo: 6, iHi: 6 },
      ],
    },
    PM10: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 20, iLo: 1, iHi: 1 },
        { cLo: 20, cHi: 40, iLo: 2, iHi: 2 },
        { cLo: 40, cHi: 50, iLo: 3, iHi: 3 },
        { cLo: 50, cHi: 100, iLo: 4, iHi: 4 },
        { cLo: 100, cHi: 150, iLo: 5, iHi: 5 },
        { cLo: 150, cHi: Number.POSITIVE_INFINITY, iLo: 6, iHi: 6 },
      ],
    },
    NO2: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 40, iLo: 1, iHi: 1 },
        { cLo: 40, cHi: 90, iLo: 2, iHi: 2 },
        { cLo: 90, cHi: 120, iLo: 3, iHi: 3 },
        { cLo: 120, cHi: 230, iLo: 4, iHi: 4 },
        { cLo: 230, cHi: 340, iLo: 5, iHi: 5 },
        { cLo: 340, cHi: Number.POSITIVE_INFINITY, iLo: 6, iHi: 6 },
      ],
    },
    O3: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 50, iLo: 1, iHi: 1 },
        { cLo: 50, cHi: 100, iLo: 2, iHi: 2 },
        { cLo: 100, cHi: 130, iLo: 3, iHi: 3 },
        { cLo: 130, cHi: 240, iLo: 4, iHi: 4 },
        { cLo: 240, cHi: 380, iLo: 5, iHi: 5 },
        { cLo: 380, cHi: Number.POSITIVE_INFINITY, iLo: 6, iHi: 6 },
      ],
    },
    SO2: {
      scaleFactor: 1,
      breakpoints: [
        { cLo: 0, cHi: 100, iLo: 1, iHi: 1 },
        { cLo: 100, cHi: 200, iLo: 2, iHi: 2 },
        { cLo: 200, cHi: 350, iLo: 3, iHi: 3 },
        { cLo: 350, cHi: 500, iLo: 4, iHi: 4 },
        { cLo: 500, cHi: 750, iLo: 5, iHi: 5 },
        { cLo: 750, cHi: Number.POSITIVE_INFINITY, iLo: 6, iHi: 6 },
      ],
    },
  },
  classify: (eaqi) => {
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
  },
};

/**
 * Strongly typed registry of all 5 regional AQI standards (`IN_CPCB`, `US_EPA`, `CN_MEE`, `UK_DAQI`, `EU_EAQI`).
 */
export const REGIONAL_SCALE_CONFIGS: Readonly<Record<RegionalScaleCode, RegionalScaleConfig>> = {
  IN_CPCB: IN_CPCB_CONFIG,
  US_EPA: US_EPA_CONFIG,
  CN_MEE: CN_MEE_CONFIG,
  UK_DAQI: UK_DAQI_CONFIG,
  EU_EAQI: EU_EAQI_CONFIG,
};

/**
 * Fallback meteorological baselines indexed by normalized city slug, used strictly
 * when live Open-Meteo network calls cannot be reached.
 */
export const OFFLINE_METEOROLOGICAL_BASELINES: Readonly<Record<string, BaselineProfile>> = {
  delhi: {
    name: 'Delhi',
    admin1: 'National Capital Territory of Delhi',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 28.6519,
    longitude: 77.2315,
    usAqi: 248,
    pm25: 174.2,
    pm10: 268.5,
    no2: 64.8,
    co: 1120,
    o3: 42.0,
    so2: 18.5,
    temperatureC: 13.4,
    humidityPercent: 68,
    windSpeedKmh: 5.2,
  },
  jaipur: {
    name: 'Jaipur',
    admin1: 'Rajasthan',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 26.9124,
    longitude: 75.7873,
    usAqi: 158,
    pm25: 69.4,
    pm10: 142.0,
    no2: 41.2,
    co: 680,
    o3: 52.0,
    so2: 14.0,
    temperatureC: 14.6,
    humidityPercent: 44,
    windSpeedKmh: 6.4,
  },
  bengaluru: {
    name: 'Bengaluru',
    admin1: 'Karnataka',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 12.9716,
    longitude: 77.5946,
    usAqi: 74,
    pm25: 22.8,
    pm10: 48.6,
    no2: 29.5,
    co: 410,
    o3: 46.0,
    so2: 8.4,
    temperatureC: 23.8,
    humidityPercent: 58,
    windSpeedKmh: 12.4,
  },
  mumbai: {
    name: 'Mumbai',
    admin1: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    timezoneAbbreviation: 'IST',
    latitude: 19.076,
    longitude: 72.8777,
    usAqi: 118,
    pm25: 42.5,
    pm10: 88.2,
    no2: 46.1,
    co: 590,
    o3: 49.0,
    so2: 12.2,
    temperatureC: 27.6,
    humidityPercent: 72,
    windSpeedKmh: 14.8,
  },
  chicago: {
    name: 'Chicago',
    admin1: 'Illinois',
    country: 'United States',
    countryCode: 'US',
    timezone: 'America/Chicago',
    timezoneAbbreviation: 'CST',
    latitude: 41.85,
    longitude: -87.65,
    usAqi: 62,
    pm25: 14.5,
    pm10: 26.4,
    no2: 24.8,
    co: 320,
    o3: 56.0,
    so2: 4.5,
    temperatureC: 9.2,
    humidityPercent: 62,
    windSpeedKmh: 15.4,
  },
  london: {
    name: 'London',
    admin1: 'England',
    country: 'United Kingdom',
    countryCode: 'GB',
    timezone: 'Europe/London',
    timezoneAbbreviation: 'GMT',
    latitude: 51.5085,
    longitude: -0.1257,
    usAqi: 44,
    pm25: 8.6,
    pm10: 16.2,
    no2: 28.4,
    co: 290,
    o3: 52.0,
    so2: 3.1,
    temperatureC: 11.2,
    humidityPercent: 76,
    windSpeedKmh: 16.5,
  },
};

/**
 * Lookup map of common IANA timezones to preferred short abbreviations when `Intl` emits raw offsets.
 */
export const TIMEZONE_ABBR_FALLBACKS: Readonly<Record<string, string>> = {
  'Asia/Kolkata': 'IST',
  'Asia/Calcutta': 'IST',
  'Europe/London': 'GMT',
  'America/Chicago': 'CST',
};
