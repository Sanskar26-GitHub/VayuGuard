import type {
  CommuteMode,
  CookingFuel,
  HouseholdProfile,
  SensitiveGroup,
  VentilationType,
} from '../../src/types/airQuality';

export class ValidationError extends Error {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const VALID_VENTILATION: ReadonlySet<VentilationType> = new Set([
  'cross_ventilation',
  'single_sided',
  'sealed_ac',
  'natural_open',
]);

const VALID_COOKING_FUELS: ReadonlySet<CookingFuel> = new Set([
  'lpg',
  'electric_induction',
  'piped_gas',
  'biomass_solid',
]);

const VALID_COMMUTE_MODES: ReadonlySet<CommuteMode> = new Set([
  'car_solo',
  'two_wheeler',
  'metro_bus',
  'cycle_walk',
  'work_from_home',
]);

const VALID_SENSITIVE_GROUPS: ReadonlySet<SensitiveGroup> = new Set([
  'children',
  'seniors',
  'asthma_respiratory',
  'pregnant',
  'outdoor_worker',
]);

/**
 * Strips ASCII control characters (preserving spaces/tabs/newlines normalized to spaces)
 * to neutralize hidden control sequences or terminal/prompt delimiters.
 */
export function stripControlChars(input: string): string {
  // Remove C0/C1 control chars except space, normalize runs of whitespace
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncates text safely to a maximum character ceiling.
 */
export function truncateText(input: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength).trim();
}

/**
 * Escapes HTML and XML special characters so user input cannot close
 * `<untrusted_user_input>` delimiters or inject forged prompt tags.
 */
export function escapeXmlAndHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes free-form user text by stripping control characters, truncating to maxLength,
 * and escaping HTML/XML syntax.
 */
export function sanitizeUserText(raw: unknown, maxLength = 320): string {
  if (typeof raw !== 'string') {
    return '';
  }
  const stripped = stripControlChars(raw);
  const truncated = truncateText(stripped, maxLength);
  return escapeXmlAndHtml(truncated);
}

/**
 * Wraps sanitized user data in explicit XML boundary tags so Gemini treats
 * the content strictly as inert data rather than executable instructions.
 */
export function wrapUntrustedInput(field: string, rawValue: unknown, maxLength = 320): string {
  const safeField = stripControlChars(field).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeValue = sanitizeUserText(rawValue, maxLength);
  return `<untrusted_user_input field="${safeField}">${safeValue}</untrusted_user_input>`;
}

/**
 * Validates and normalizes an incoming HouseholdProfile payload.
 */
export function sanitizeProfile(raw: unknown): HouseholdProfile {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Household profile payload must be a JSON object.');
  }

  const candidate = raw as Record<string, unknown>;
  const rawCity = typeof candidate.city === 'string' ? stripControlChars(candidate.city) : '';
  const cleanCity = truncateText(rawCity, 80);

  if (!cleanCity || cleanCity.length < 2) {
    throw new ValidationError('Please provide a valid city name (at least 2 characters).');
  }

  const ventilationType = VALID_VENTILATION.has(candidate.ventilationType as VentilationType)
    ? (candidate.ventilationType as VentilationType)
    : 'cross_ventilation';

  const hasAirPurifier = Boolean(candidate.hasAirPurifier);

  const cookingFuel = VALID_COOKING_FUELS.has(candidate.cookingFuel as CookingFuel)
    ? (candidate.cookingFuel as CookingFuel)
    : 'lpg';

  const commuteMode = VALID_COMMUTE_MODES.has(candidate.commuteMode as CommuteMode)
    ? (candidate.commuteMode as CommuteMode)
    : 'metro_bus';

  const rawSensitive = Array.isArray(candidate.sensitiveGroups) ? candidate.sensitiveGroups : [];
  const sensitiveSet = new Set<SensitiveGroup>();
  for (const item of rawSensitive) {
    if (VALID_SENSITIVE_GROUPS.has(item as SensitiveGroup)) {
      sensitiveSet.add(item as SensitiveGroup);
    }
  }

  const lifestyleNotes =
    typeof candidate.lifestyleNotes === 'string'
      ? truncateText(stripControlChars(candidate.lifestyleNotes), 320)
      : undefined;

  return {
    city: cleanCity,
    ventilationType,
    hasAirPurifier,
    cookingFuel,
    commuteMode,
    sensitiveGroups: Array.from(sensitiveSet),
    lifestyleNotes: lifestyleNotes && lifestyleNotes.length > 0 ? lifestyleNotes : undefined,
  };
}

/**
 * Validates and sanitizes a situational Q&A question string.
 */
export function sanitizeQuestion(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ValidationError('Question must be a non-empty text string.');
  }
  const clean = truncateText(stripControlChars(raw), 400);
  if (clean.length < 3) {
    throw new ValidationError('Please enter a question of at least 3 characters.');
  }
  return clean;
}
