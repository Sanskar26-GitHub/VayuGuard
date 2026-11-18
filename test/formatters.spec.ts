import { describe, expect, it } from 'vitest';
import {
  buildOpenStreetMapUrl,
  formatCoordinatesWithHemisphere,
  formatLocalObservationTime,
  formatSingleCoordinate,
} from '../src/utils/formatters';

describe('Frontend Telemetry Formatters (src/utils/formatters.ts)', () => {
  it('formats latitude and longitude with 4 decimals and correct N/S/E/W hemispheres', () => {
    expect(formatSingleCoordinate(28.65, 'N', 'S')).toBe('28.6500° N');
    expect(formatSingleCoordinate(-33.86882, 'N', 'S')).toBe('33.8688° S');
    expect(formatSingleCoordinate(77.2315, 'E', 'W')).toBe('77.2315° E');
    expect(formatSingleCoordinate(-0.1278, 'E', 'W')).toBe('0.1278° W');

    expect(formatCoordinatesWithHemisphere(51.50735, -0.12776)).toBe(
      '51.5074° N, 0.1278° W',
    );
    expect(formatCoordinatesWithHemisphere(-23.5505, -46.6333)).toBe(
      '23.5505° S, 46.6333° W',
    );
  });

  it('builds a valid 4-decimal OpenStreetMap verification URL', () => {
    expect(buildOpenStreetMapUrl(51.50735, -0.12776)).toBe(
      'https://www.openstreetmap.org/?mlat=51.5074&mlon=-0.1278#map=12/51.5074/-0.1278',
    );
  });

  it('formats wall-clock Open-Meteo timestamps and UTC ISO instants in the target IANA timezone', () => {
    expect(formatLocalObservationTime('2026-11-18T14:30', 'Asia/Kolkata', 'IST')).toBe(
      'Nov 18, 2026, 2:30 PM IST',
    );
    expect(formatLocalObservationTime('2026-11-18T09:32:00Z', 'Europe/London', 'GMT')).toBe(
      'Nov 18, 2026, 9:32 AM GMT',
    );
    expect(formatLocalObservationTime('2026-11-18T03:00', 'America/Chicago', '')).toBe(
      'Nov 18, 2026, 3:00 AM CST',
    );
  });
});
