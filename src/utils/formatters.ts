const TIMEZONE_ABBR_FALLBACKS: Readonly<Record<string, string>> = {
  'Asia/Kolkata': 'IST',
  'Asia/Calcutta': 'IST',
  'Europe/London': 'GMT',
  'America/Chicago': 'CST',
};

function validateIanaTimeZone(timezone?: string): string {
  const candidate = (timezone ?? '').trim();
  if (!candidate) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

/**
 * Formats an observation timestamp into a human-readable local time string
 * in the target city's IANA timezone (for example `"Nov 18, 2026, 3:15 PM IST"`).
 *
 * @param rawTime - Open-Meteo wall-clock string (`YYYY-MM-DDTHH:mm`) or ISO-8601 timestamp.
 * @param timezone - IANA timezone identifier (e.g. `"Asia/Kolkata"`).
 * @param timezoneAbbr - Optional short timezone abbreviation fallback (e.g. `"IST"`).
 * @returns Human-readable local date, time, and timezone abbreviation.
 */
export function formatLocalObservationTime(
  rawTime: string | undefined,
  timezone?: string,
  timezoneAbbr?: string,
): string {
  const validTz = validateIanaTimeZone(timezone);

  let instant: Date;
  const trimmed = (rawTime ?? '').trim();
  const wallClockMatch =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);

  if (wallClockMatch) {
    const [, yStr, mStr, dStr, hhStr, mmStr, ssStr] = wallClockMatch;
    const utcGuess = Date.UTC(
      Number(yStr),
      Number(mStr) - 1,
      Number(dStr),
      Number(hhStr),
      Number(mmStr),
      Number(ssStr ?? '0'),
    );

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: validTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcGuess));

    const getPart = (type: string): number =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);

    const tzGuessAsUtc = Date.UTC(
      getPart('year'),
      getPart('month') - 1,
      getPart('day'),
      getPart('hour'),
      getPart('minute'),
      getPart('second'),
    );
    instant = new Date(utcGuess - (tzGuessAsUtc - utcGuess));
  } else {
    const parsed = trimmed ? new Date(trimmed) : new Date();
    instant = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: validTz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(instant);

  const cleanAbbr = (timezoneAbbr ?? '').trim();
  const preferredAbbr =
    /^[A-Z]{2,5}$/.test(cleanAbbr) ? cleanAbbr : TIMEZONE_ABBR_FALLBACKS[validTz];

  if (preferredAbbr && /\sGMT(?:[+-]\d{1,2}(?::\d{2})?)?$/.test(formatted)) {
    return formatted.replace(/\sGMT(?:[+-]\d{1,2}(?::\d{2})?)?$/, ` ${preferredAbbr}`);
  }
  return formatted;
}

/**
 * Formats a single geographic axis value with 4 decimal places and a hemisphere suffix.
 *
 * @param value - Signed decimal coordinate (latitude or longitude).
 * @param positiveHemisphere - Label used when `value >= 0` (`'N'` or `'E'`).
 * @param negativeHemisphere - Label used when `value < 0` (`'S'` or `'W'`).
 * @returns Formatted axis coordinate string (e.g. `"28.6500° N"`).
 */
export function formatSingleCoordinate(
  value: number,
  positiveHemisphere: 'N' | 'E',
  negativeHemisphere: 'S' | 'W',
): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const hemisphere = safeValue >= 0 ? positiveHemisphere : negativeHemisphere;
  return `${Math.abs(safeValue).toFixed(4)}° ${hemisphere}`;
}

/**
 * Formats latitude and longitude into a combined 4-decimal hemisphere coordinate pair.
 *
 * @param latitude - Signed latitude in decimal degrees.
 * @param longitude - Signed longitude in decimal degrees.
 * @returns Combined coordinate string (e.g. `"51.5074° N, 0.1278° W"`).
 */
export function formatCoordinatesWithHemisphere(latitude: number, longitude: number): string {
  const lat = formatSingleCoordinate(latitude, 'N', 'S');
  const lon = formatSingleCoordinate(longitude, 'E', 'W');
  return `${lat}, ${lon}`;
}

/**
 * Builds an OpenStreetMap verification URL pinned to the 4-decimal location coordinates.
 *
 * @param latitude - Signed latitude in decimal degrees.
 * @param longitude - Signed longitude in decimal degrees.
 * @returns HTTPS OpenStreetMap pin URL centered at zoom level 12.
 */
export function buildOpenStreetMapUrl(latitude: number, longitude: number): string {
  const safeLat = (Number.isFinite(latitude) ? latitude : 0).toFixed(4);
  const safeLon = (Number.isFinite(longitude) ? longitude : 0).toFixed(4);
  return `https://www.openstreetmap.org/?mlat=${safeLat}&mlon=${safeLon}#map=12/${safeLat}/${safeLon}`;
}
