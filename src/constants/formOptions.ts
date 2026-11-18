import type { SensitiveGroup } from '../types/airQuality';

/**
 * Select option item with display label.
 */
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export const VENTILATION_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'cross_ventilation', label: 'Cross-ventilation windows' },
  { value: 'single_sided', label: 'Single-sided apartment' },
  { value: 'sealed_ac', label: 'Sealed windows with AC' },
  { value: 'natural_open', label: 'Naturally open / porous structure' },
];

export const COOKING_FUEL_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'lpg', label: 'LPG Cylinder Stove' },
  { value: 'piped_gas', label: 'Piped Natural Gas (PNG)' },
  { value: 'electric_induction', label: 'Electric Induction / Ceramic' },
  { value: 'biomass_solid', label: 'Solid Fuel / Wood / Coal' },
];

export const COMMUTE_MODE_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'metro_bus', label: 'Metro / Public Bus' },
  { value: 'car_solo', label: 'Solo Private Car' },
  { value: 'two_wheeler', label: 'Two-Wheeler / Scooter' },
  { value: 'cycle_walk', label: 'Cycle / Walk' },
  { value: 'work_from_home', label: 'Remote / Work from Home' },
];

export const PURIFIER_OPTIONS: ReadonlyArray<SelectOption<'yes' | 'no'>> = [
  { value: 'yes', label: 'Yes — HEPA Air Purifier Available' },
  { value: 'no', label: 'No — DIY MERV-13 / No Purifier' },
];

export const SENSITIVE_GROUP_OPTIONS: ReadonlyArray<{ id: SensitiveGroup; label: string }> = [
  { id: 'children', label: 'Children (under 12)' },
  { id: 'seniors', label: 'Older adults (65+)' },
  { id: 'asthma_respiratory', label: 'Asthma or respiratory sensitivity' },
  { id: 'pregnant', label: 'Pregnant household member' },
  { id: 'outdoor_worker', label: 'Daily outdoor worker' },
];
