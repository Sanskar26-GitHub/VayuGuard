import type {
  AirTelemetry,
  AskAssistantResponse,
  HouseholdProfile,
  RecommendationCardData,
} from '../../src/types/airQuality';

type AqiBand = 'good' | 'moderate' | 'usg' | 'unhealthy' | 'severe';

export function resolveAqiBand(severityTierOrAqi: number): AqiBand {
  // Supports both unified severityTier (1..6) and legacy 0..500 US AQI values
  if (severityTierOrAqi <= 6) {
    if (severityTierOrAqi <= 1) return 'good';
    if (severityTierOrAqi === 2) return 'moderate';
    if (severityTierOrAqi === 3) return 'usg';
    if (severityTierOrAqi === 4) return 'unhealthy';
    return 'severe';
  }
  if (severityTierOrAqi <= 50) return 'good';
  if (severityTierOrAqi <= 100) return 'moderate';
  if (severityTierOrAqi <= 150) return 'usg';
  if (severityTierOrAqi <= 200) return 'unhealthy';
  return 'severe';
}

function describeSensitivities(profile: HouseholdProfile): string {
  if (profile.sensitiveGroups.length === 0) {
    return 'general urban household members';
  }
  return profile.sensitiveGroups.map((g) => g.replace(/_/g, ' ')).join(', ');
}

/**
 * Dynamic parametric fallback plan generator triggered ONLY if all Gemini retries fail.
 * Computes tailored recommendations across all 3 pillars strictly from the user's live
 * regional AQI severity tier, thermal inversion status, purifier availability, cooking fuel,
 * commute mode, and household sensitivities—never hardcoded to specific city names.
 */
export function generateParametricFallbackPlan(
  profile: HouseholdProfile,
  telemetry: AirTelemetry,
): {
  dailyBriefing: string;
  ventilationGuidance: string;
  recommendations: RecommendationCardData[];
} {
  const band = resolveAqiBand(telemetry.severityTier);
  const sensitivityLabel = describeSensitivities(profile);
  const scaleSummary = `${telemetry.scaleName} ${telemetry.aqiValue}/${telemetry.scaleMax} (${telemetry.categoryLabel})`;
  const liveCitation = `Live telemetry in ${telemetry.city}: ${scaleSummary}, dominant pollutant ${telemetry.dominantPollutant}, PM2.5 ${telemetry.pm25} µg/m³, NO2 ${telemetry.no2} µg/m³, ${telemetry.temperatureC}°C, wind ${telemetry.windSpeedKmh} km/h.`;

  const dailyBriefing = telemetry.thermalInversionRisk
    ? `${telemetry.city} is currently at ${scaleSummary} with an active thermal inversion (${telemetry.temperatureC}°C, ${telemetry.windSpeedKmh} km/h wind) trapping PM2.5 (${telemetry.pm25} µg/m³) near street level. Priority protection for ${sensitivityLabel} requires keeping indoor sources near zero and sealing outdoor infiltration.`
    : `${telemetry.city} shows ${scaleSummary} with PM2.5 at ${telemetry.pm25} µg/m³ and ${telemetry.windSpeedKmh} km/h surface wind. Focus on cutting indoor combustion spikes while timing ventilation and travel for ${sensitivityLabel} outside peak pollution hours.`;

  const ventilationGuidance = telemetry.recommendedVentilationWindow;

  const recommendations: RecommendationCardData[] = [];

  // --- Pillar 1: Low-Emission Daily Routines ---
  if (profile.commuteMode === 'car_solo' || profile.commuteMode === 'two_wheeler') {
    const isCar = profile.commuteMode === 'car_solo';
    recommendations.push({
      id: 'routine-commute-shift',
      pillar: 'low_emission_routines',
      pillarLabel: 'Pillar 1 · Low-Emission Daily Routines',
      title: isCar
        ? 'Shift two weekly solo drives to public transit or carpool & eliminate 3-min idling'
        : 'Consolidate errands off-peak & switch short trips under 3 km to transit or walk',
      actionSummary: isCar
        ? `With ambient NO2 at ${telemetry.no2} µg/m³, replacing cold-start solo car trips and engine idling cuts tailpipe NOx and personal in-cabin exposure.`
        : `Two-wheeler riders inhale street-level PM2.5 (${telemetry.pm25} µg/m³) directly; shifting to enclosed transit or trip-batching reduces both dose and exhaust.`,
      whyAndDirectImpact: {
        mechanism:
          'Cold-start combustion engines emit disproportionate NO2 and ultrafine particulates during the first 5 minutes; reducing vehicle kilometers and idling directly curtails street-canyon NOx.',
        pm25ReductionPercent: band === 'severe' || band === 'unhealthy' ? 28 : 18,
        co2SavedKgPerDay: isCar ? 2.6 : 1.15,
        costTier: 'Free',
        effortLevel: 'Daily Routine',
        groundedMetricRef: liveCitation,
      },
    });
  } else {
    recommendations.push({
      id: 'routine-offpeak-travel',
      pillar: 'low_emission_routines',
      pillarLabel: 'Pillar 1 · Low-Emission Daily Routines',
      title: 'Time outdoor errands for mid-afternoon dispersion & avoid congested arterial corridors',
      actionSummary: `Schedule travel for ${sensitivityLabel} between 13:00–16:00 rather than 08:00–10:00 or 18:00–21:00 rush peaks.`,
      whyAndDirectImpact: {
        mechanism:
          'Solar boundary-layer mixing deepens in early afternoon, diluting street-level PM2.5 and NO2 compared to morning/evening inversion and traffic peaks.',
        pm25ReductionPercent: telemetry.thermalInversionRisk ? 32 : 20,
        co2SavedKgPerDay: 0.65,
        costTier: 'Free',
        effortLevel: 'Daily Routine',
        groundedMetricRef: liveCitation,
      },
    });
  }

  if (profile.cookingFuel === 'biomass_solid' || profile.cookingFuel === 'lpg' || profile.cookingFuel === 'piped_gas') {
    const isBiomass = profile.cookingFuel === 'biomass_solid';
    recommendations.push({
      id: 'routine-batch-cooking',
      pillar: 'low_emission_routines',
      pillarLabel: 'Pillar 1 · Low-Emission Daily Routines',
      title: isBiomass
        ? 'Transition indoor cooking to pressure-cooked electric/LPG batches & pre-soak grains'
        : 'Batch-cook meals with lids on & run exhaust hood 10 minutes past burner shutoff',
      actionSummary: isBiomass
        ? 'Solid fuel combustion generates extreme indoor PM2.5 spikes that stack onto outdoor pollution; pre-soaking and pressure cooking slashes burn duration by 45%.'
        : `Gas burners release NO2 (stacking on outdoor ${telemetry.no2} µg/m³) and ultrafine aerosols during high-heat frying; lids and post-cook exhaust clear the kitchen plume.`,
      whyAndDirectImpact: {
        mechanism:
          'Covering cookware traps steam and reduces fuel burn time by 25–40%, cutting both CO2e fuel consumption and gas-flame NO2/PM2.5 accumulation.',
        pm25ReductionPercent: isBiomass ? 54 : 30,
        co2SavedKgPerDay: isBiomass ? 3.2 : 0.48,
        costTier: isBiomass ? 'Low Cost' : 'Free',
        effortLevel: 'Daily Routine',
        groundedMetricRef: `Outdoor NO2 is ${telemetry.no2} µg/m³ and PM2.5 is ${telemetry.pm25} µg/m³ in ${telemetry.city}; indoor gas/solid fuel spikes compound baseline exposure.`,
      },
    });
  } else {
    recommendations.push({
      id: 'routine-appliance-batching',
      pillar: 'low_emission_routines',
      pillarLabel: 'Pillar 1 · Low-Emission Daily Routines',
      title: 'Keep induction cooking on covered medium-heat cycles & shift laundry to cold full loads',
      actionSummary:
        'Using lids on electric induction cuts cooking kWh by ~30%, while cold-water full loads curb thermal power-plant grid emissions.',
      whyAndDirectImpact: {
        mechanism:
          'Lower household electricity draw during peak evening hours reduces fossil-fuel grid peaker generation and local thermal pollution.',
        pm25ReductionPercent: 14,
        co2SavedKgPerDay: 0.72,
        costTier: 'Free',
        effortLevel: 'Daily Routine',
        groundedMetricRef: liveCitation,
      },
    });
  }

  // --- Pillar 2: Indoor Air Quality (IAQ) Hacks ---
  recommendations.push({
    id: 'iaq-ventilation-window',
    pillar: 'iaq_hacks',
    pillarLabel: 'Pillar 2 · Indoor Air Quality (IAQ) Hacks',
    title:
      band === 'good' || band === 'moderate'
        ? 'Execute timed cross-ventilation purge during peak dispersion window'
        : 'Seal perimeter window gaps & lock ventilation to midday solar-mixing window only',
    actionSummary: telemetry.recommendedVentilationWindow,
    whyAndDirectImpact: {
      mechanism: telemetry.thermalInversionRisk
        ? 'During cool calm inversions (<15°C, <8 km/h), outdoor air holds concentrated ground-level PM2.5; sealing drafts prevents outdoor aerosol infiltration.'
        : 'Controlled cross-ventilation during lower ambient AQI flushes indoor CO2 and VOC buildup without overloading indoor filtration.',
      pm25ReductionPercent: band === 'severe' || band === 'unhealthy' ? 38 : 22,
      co2SavedKgPerDay: 0.25,
      costTier: band === 'severe' || band === 'unhealthy' ? 'Low Cost' : 'Free',
      effortLevel: '2-Min Habit',
      groundedMetricRef: `Wind ${telemetry.windSpeedKmh} km/h, Temp ${telemetry.temperatureC}°C, Inversion Risk: ${telemetry.thermalInversionRisk ? 'Active' : 'Inactive'}, ${telemetry.scaleName} ${telemetry.aqiValue}/${telemetry.scaleMax}.`,
    },
  });

  recommendations.push({
    id: 'iaq-wet-mop',
    pillar: 'iaq_hacks',
    pillarLabel: 'Pillar 2 · Indoor Air Quality (IAQ) Hacks',
    title: 'Replace dry sweeping with damp microfiber mopping every evening',
    actionSummary: `With outdoor PM10 at ${telemetry.pm10} µg/m³ settling indoors on shoes and textiles, wet mopping captures coarse dust instead of resuspending it.`,
    whyAndDirectImpact: {
      mechanism:
        'Dry brooms shear settled PM10 and PM2.5 particles back into the breathing zone (0.5–1.5 m height) where children and seniors inhale them; damp microfiber binds particles by capillary adhesion.',
      pm25ReductionPercent: 24,
      co2SavedKgPerDay: 0.12,
      costTier: 'Free',
      effortLevel: 'Daily Routine',
      groundedMetricRef: `Outdoor PM10 in ${telemetry.city} is ${telemetry.pm10} µg/m³ and PM2.5 is ${telemetry.pm25} µg/m³.`,
    },
  });

  recommendations.push({
    id: 'iaq-filtration-protocol',
    pillar: 'iaq_hacks',
    pillarLabel: 'Pillar 2 · Indoor Air Quality (IAQ) Hacks',
    title: profile.hasAirPurifier
      ? 'Run HEPA purifier on continuous medium in bedroom & clean pre-filter weekly'
      : 'Build a Corsi-Rosenthal MERV-13 box-fan filter for the primary sleeping room',
    actionSummary: profile.hasAirPurifier
      ? `Continuous medium airflow maintains 4–5 air changes per hour (ACH) at low noise and energy draw while keeping indoor PM2.5 safe despite ${telemetry.pm25} µg/m³ outdoors.`
      : `A standard box fan sealed to a MERV-13 pleated filter delivers ~250–400 CFM clean air delivery rate at a fraction of commercial purifier cost.`,
    whyAndDirectImpact: {
      mechanism:
        'Mechanical MERV-13 / HEPA media captures >=85–99.97% of 0.3–2.5 µm particulates via diffusion and interception without generating ozone.',
      pm25ReductionPercent: profile.hasAirPurifier ? 62 : 55,
      co2SavedKgPerDay: profile.hasAirPurifier ? 0.35 : 0.42,
      costTier: profile.hasAirPurifier ? 'Free' : 'Equipment',
      effortLevel: profile.hasAirPurifier ? '2-Min Habit' : 'One-Time Setup',
      groundedMetricRef: `Designed to counter outdoor ${telemetry.scaleName} ${telemetry.aqiValue}/${telemetry.scaleMax} (PM2.5 ${telemetry.pm25} µg/m³) in ${telemetry.city}.`,
    },
  });

  // --- Pillar 3: Sustainable Alternatives ---
  recommendations.push({
    id: 'alt-combustion-free-home',
    pillar: 'sustainable_alternatives',
    pillarLabel: 'Pillar 3 · Sustainable Alternatives',
    title: 'Eliminate indoor incense, mosquito coils & paraffin candles; switch to electric vaporizers or netting',
    actionSummary:
      'One smoldering mosquito coil emits PM2.5 equivalent to dozens of cigarettes; zero-smoke mesh screens and liquid electric repellents protect sensitive lungs.',
    whyAndDirectImpact: {
      mechanism:
        'Smoldering biomass coils and paraffin wax release polycyclic aromatic hydrocarbons (PAHs) and fine soot directly into enclosed rooms.',
      pm25ReductionPercent: 44,
      co2SavedKgPerDay: 0.3,
      costTier: 'Low Cost',
      effortLevel: 'One-Time Setup',
      groundedMetricRef: `Avoids adding indoor combustion soot atop ${telemetry.city}'s outdoor PM2.5 (${telemetry.pm25} µg/m³).`,
    },
  });

  recommendations.push({
    id: 'alt-low-voc-cleaners',
    pillar: 'sustainable_alternatives',
    pillarLabel: 'Pillar 3 · Sustainable Alternatives',
    title: 'Swap aerosol sprays & synthetic bleach for diluted vinegar, castile soap, and baking soda',
    actionSummary:
      'Aerosol propellants and pine/citrus terpenes react with ambient ozone/NO2 to form secondary organic aerosols indoors.',
    whyAndDirectImpact: {
      mechanism:
        'Eliminating volatile organic compounds (VOCs) prevents secondary ultrafine particle nucleation when cleaning agents mix with infiltrating urban NO2.',
      pm25ReductionPercent: 18,
      co2SavedKgPerDay: 0.22,
      costTier: 'Low Cost',
      effortLevel: '2-Min Habit',
      groundedMetricRef: `Prevents VOC + NO2 secondary aerosol formation (outdoor NO2 currently ${telemetry.no2} µg/m³ in ${telemetry.city}).`,
    },
  });

  if (band === 'usg' || band === 'unhealthy' || band === 'severe' || profile.sensitiveGroups.length > 0) {
    recommendations.push({
      id: 'alt-reusable-respirator',
      pillar: 'sustainable_alternatives',
      pillarLabel: 'Pillar 3 · Sustainable Alternatives',
      title: 'Rotate 3 reusable NIOSH N95 / BIS FFP2 respirators in breathable paper bags for outdoor trips',
      actionSummary:
        'Rotating masks over 3-day drying intervals extends electrostatic filter life 5x and cuts single-use mask landfill waste.',
      whyAndDirectImpact: {
        mechanism:
          'Electrostatic polypropylene melt-blown fibers retain >95% filtration efficiency for PM2.5 when kept dry and unwashed between uses.',
        pm25ReductionPercent: 78,
        co2SavedKgPerDay: 0.18,
        costTier: 'Low Cost',
        effortLevel: '2-Min Habit',
        groundedMetricRef: `Recommended due to ${telemetry.city} ${telemetry.scaleName} ${telemetry.aqiValue}/${telemetry.scaleMax} (${telemetry.categoryLabel}) for ${sensitivityLabel}.`,
      },
    });
  }

  return { dailyBriefing, ventilationGuidance, recommendations };
}

/**
 * Parametric fallback answer for /api/ask when Gemini is unavailable.
 */
export function generateFallbackAssistantAnswer(
  question: string,
  profile: HouseholdProfile,
  telemetry: AirTelemetry,
): AskAssistantResponse {
  const band = resolveAqiBand(telemetry.severityTier);
  const qLower = question.toLowerCase();
  const sensitivityLabel = describeSensitivities(profile);
  const scaleBadge = `${telemetry.scaleName} ${telemetry.aqiValue}/${telemetry.scaleMax} (${telemetry.categoryLabel})`;

  const metricsUsed = [
    scaleBadge,
    `Dominant: ${telemetry.dominantPollutant}`,
    `PM2.5 ${telemetry.pm25} µg/m³`,
    `NO2 ${telemetry.no2} µg/m³`,
    `Wind ${telemetry.windSpeedKmh} km/h`,
    `Temp ${telemetry.temperatureC}°C`,
  ];

  let answer: string;
  if (/window|ventilat|open|air out/i.test(qLower)) {
    answer = `In ${telemetry.resolvedLocation}, current ${scaleBadge} with ${
      telemetry.thermalInversionRisk ? 'an active thermal inversion' : 'no thermal inversion'
    } (${telemetry.temperatureC}°C, ${telemetry.windSpeedKmh} km/h wind). ${telemetry.recommendedVentilationWindow} With ${profile.ventilationType.replace(
      /_/g,
      ' ',
    )} setup and air purifier ${profile.hasAirPurifier ? 'enabled' : 'unavailable'}, keep indoor combustion zeroed out during sealed hours.`;
  } else if (/run|jog|walk|exercise|outdoor|commute|school|park/i.test(qLower)) {
    answer =
      band === 'good' || band === 'moderate'
        ? `At ${scaleBadge} (PM2.5 ${telemetry.pm25} µg/m³) in ${telemetry.resolvedLocation}, light-to-moderate outdoor activity is acceptable—prefer mid-afternoon hours away from traffic corridors where NO2 (${telemetry.no2} µg/m³) spikes.`
        : `At ${scaleBadge} and PM2.5 ${telemetry.pm25} µg/m³ in ${telemetry.resolvedLocation}, avoid vigorous outdoor exercise—especially for ${sensitivityLabel}. Move workouts indoors with filtration, and wear a well-sealed N95/FFP2 respirator for essential trips.`;
  } else if (/cook|kitchen|gas|lpg|smoke|incense/i.test(qLower)) {
    answer = `Since your household uses ${profile.cookingFuel.replace(
      /_/g,
      ' ',
    )} while outdoor NO2 is ${telemetry.no2} µg/m³ and PM2.5 is ${telemetry.pm25} µg/m³ (${scaleBadge}), cover pots with lids, run kitchen exhaust during and 10 minutes after cooking, and eliminate incense or paraffin candles completely.`;
  } else {
    answer = `For ${telemetry.resolvedLocation} right now (${scaleBadge}, PM2.5 ${telemetry.pm25} µg/m³, wind ${telemetry.windSpeedKmh} km/h): ${telemetry.recommendedVentilationWindow} Prioritize ${
      profile.hasAirPurifier
        ? 'continuous medium HEPA filtration in sleeping rooms'
        : 'sealing drafts and damp mopping floors'
    } and shifting ${profile.commuteMode.replace(/_/g, ' ')} trips off peak hours.`;
  }

  return {
    answer,
    groundedMetricsUsed: metricsUsed,
    cautionNote:
      profile.sensitiveGroups.length > 0
        ? `Protective guidance prioritized for ${sensitivityLabel}; consult a clinician immediately if wheezing, chest tightness, or persistent coughing occurs.`
        : 'Environmental guidance is informational and does not substitute for clinical medical advice during acute respiratory symptoms.',
    modelUsed: 'parametric-meteorological-fallback',
    fallbackTriggered: true,
  };
}
