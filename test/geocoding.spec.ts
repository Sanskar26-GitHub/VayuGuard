import { describe, expect, it } from 'vitest';
import {
  buildGeocodingSearchUrl,
  locationMatchesCountryHint,
  parseCityAndCountryQuery,
  selectTopGeocodingMatch,
  type OpenMeteoGeoLocation,
} from '../server/services/geocodingService';
import { interpolateSubIndex, resolveScaleForCountry } from '../server/services/regionalAqiService';

describe('Geocoding Service (server/services/geocodingService.ts)', () => {
  it('parses City, Country strings and strips NCR suffix cleanly', () => {
    expect(parseCityAndCountryQuery('Gurugram, India')).toEqual({
      cityName: 'Gurugram',
      countryHint: 'India',
    });
    expect(parseCityAndCountryQuery('Delhi NCR, India')).toEqual({
      cityName: 'Delhi',
      countryHint: 'India',
    });
    expect(parseCityAndCountryQuery('Tokyo')).toEqual({
      cityName: 'Tokyo',
      countryHint: '',
    });
  });

  it('builds Open-Meteo geocoding URLs with count=6 and encoded city token', () => {
    const built = buildGeocodingSearchUrl('London, UK');
    expect(built.countryHint).toBe('UK');
    expect(built.url).toContain('name=London');
    expect(built.url).toContain('count=6');
  });

  it('matches country aliases (UK, USA, India) and ranks remaining candidates by population descending', () => {
    const candidates: OpenMeteoGeoLocation[] = [
      {
        name: 'London',
        admin1: 'Ontario',
        country: 'Canada',
        country_code: 'CA',
        latitude: 42.98,
        longitude: -81.23,
        population: 383822,
      },
      {
        name: 'London',
        admin1: 'England',
        country: 'United Kingdom',
        country_code: 'GB',
        latitude: 51.5085,
        longitude: -0.1257,
        population: 8961989,
      },
      {
        name: 'London',
        admin1: 'Ohio',
        country: 'United States',
        country_code: 'US',
        latitude: 39.8864,
        longitude: -83.4482,
        population: 10279,
      },
    ];

    expect(locationMatchesCountryHint(candidates[1], 'UK')).toBe(true);
    expect(locationMatchesCountryHint(candidates[2], 'USA')).toBe(true);
    expect(locationMatchesCountryHint(candidates[0], 'UK')).toBe(false);

    expect(selectTopGeocodingMatch(candidates, 'UK')?.country_code).toBe('GB');
    expect(selectTopGeocodingMatch(candidates, 'USA')?.country_code).toBe('US');
    expect(selectTopGeocodingMatch(candidates, 'Canada')?.country_code).toBe('CA');
    expect(selectTopGeocodingMatch(candidates)?.country_code).toBe('GB');
  });

  it('verifies unified interpolateSubIndex and resolveScaleForCountry helpers', () => {
    expect(resolveScaleForCountry('IN')).toBe('IN_CPCB');
    expect(resolveScaleForCountry('GB')).toBe('UK_DAQI');
    expect(resolveScaleForCountry('FR')).toBe('EU_EAQI');

    expect(
      interpolateSubIndex(45, [
        { cLo: 0, cHi: 30, iLo: 0, iHi: 50 },
        { cLo: 30, cHi: 60, iLo: 51, iHi: 100 },
      ]),
    ).toBe(76);
  });
});
