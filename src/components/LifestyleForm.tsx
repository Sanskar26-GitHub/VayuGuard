import React, { useRef, useState } from 'react';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import {
  COMMUTE_MODE_OPTIONS,
  COOKING_FUEL_OPTIONS,
  PURIFIER_OPTIONS,
  SENSITIVE_GROUP_OPTIONS,
  VENTILATION_OPTIONS,
} from '../constants/formOptions';
import { ACCESSIBLE_SURFACES } from '../styles/accessibleTheme';
import type {
  CommuteMode,
  CookingFuel,
  GeocodeOption,
  HouseholdFormDraft,
  HouseholdProfile,
  SensitiveGroup,
  VentilationType,
} from '../types/airQuality';
import { CITY_PRESETS, CityAutocompleteInput } from './CityAutocompleteInput';
import { FormSelectField } from './FormSelectField';

export { CITY_PRESETS };

type RequiredFieldKey =
  | 'city'
  | 'ventilationType'
  | 'cookingFuel'
  | 'commuteMode'
  | 'hasAirPurifier';

/**
 * Props for {@link LifestyleForm}.
 */
export interface LifestyleFormProps {
  profile: HouseholdFormDraft;
  isSubmitting: boolean;
  cityInputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (updated: HouseholdFormDraft) => void;
  onSelectPresetCity: (city: string) => void;
  onSelectLocation?: (option: GeocodeOption) => void;
  onSubmit: (profile: HouseholdProfile) => void;
}

/**
 * Household, housing ventilation, cooking fuel, daily commute, and sensitivity
 * configuration form with inline WCAG-accessible validation and city autocomplete.
 *
 * @param props - Controlled form draft, submission state, and event handlers.
 * @returns Accessible sidebar configuration form.
 */
export function LifestyleForm({
  profile,
  isSubmitting,
  cityInputRef,
  onChange,
  onSelectPresetCity,
  onSelectLocation,
  onSubmit,
}: LifestyleFormProps) {
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<RequiredFieldKey, string>>
  >({});

  const ventilationRef = useRef<HTMLSelectElement | null>(null);
  const cookingFuelRef = useRef<HTMLSelectElement | null>(null);
  const commuteRef = useRef<HTMLSelectElement | null>(null);
  const purifierRef = useRef<HTMLSelectElement | null>(null);

  const clearFieldError = (field: RequiredFieldKey) => {
    if (!validationErrors[field]) return;
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const toggleSensitiveGroup = (group: SensitiveGroup) => {
    const exists = profile.sensitiveGroups.includes(group);
    const nextGroups = exists
      ? profile.sensitiveGroups.filter((g) => g !== group)
      : [...profile.sensitiveGroups, group];
    onChange({ ...profile, sensitiveGroups: nextGroups });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Partial<Record<RequiredFieldKey, string>> = {};
    if (profile.city.trim().length < 2) {
      errors.city = 'Please enter or select a city and country (at least 2 characters).';
    }
    if (!profile.ventilationType) {
      errors.ventilationType = 'Please select your home ventilation setup.';
    }
    if (!profile.cookingFuel) {
      errors.cookingFuel = 'Please select your primary cooking fuel.';
    }
    if (!profile.commuteMode) {
      errors.commuteMode = 'Please select your primary commute mode.';
    }
    if (!profile.hasAirPurifier) {
      errors.hasAirPurifier = 'Please select whether a HEPA air purifier is available.';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      if (errors.city) cityInputRef?.current?.focus();
      else if (errors.ventilationType) ventilationRef.current?.focus();
      else if (errors.cookingFuel) cookingFuelRef.current?.focus();
      else if (errors.commuteMode) commuteRef.current?.focus();
      else if (errors.hasAirPurifier) purifierRef.current?.focus();
      return;
    }

    setValidationErrors({});
    onSubmit({
      city: profile.city.trim(),
      ventilationType: profile.ventilationType as VentilationType,
      hasAirPurifier: profile.hasAirPurifier === 'yes',
      cookingFuel: profile.cookingFuel as CookingFuel,
      commuteMode: profile.commuteMode as CommuteMode,
      sensitiveGroups: profile.sensitiveGroups,
      lifestyleNotes: profile.lifestyleNotes.trim() || undefined,
      scaleOverride: profile.scaleOverride,
    });
  };

  return (
    <section
      aria-labelledby="household-profile-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
        <SlidersHorizontal className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
        <div>
          <h2 id="household-profile-heading" className="text-lg font-bold text-slate-900">
            Household &amp; Commute Context
          </h2>
          <p className="text-xs text-slate-600">
            Tailors action steps to your live city AQI, home sealing, and family sensitivities.
          </p>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} noValidate className="mt-5 space-y-5">
        <CityAutocompleteInput
          value={profile.city}
          error={validationErrors.city}
          inputRef={cityInputRef}
          onChange={(nextCity) => {
            clearFieldError('city');
            onChange({ ...profile, city: nextCity });
          }}
          onSelectPresetCity={(preset) => {
            clearFieldError('city');
            onSelectPresetCity(preset);
          }}
          onSelectLocation={(option) => {
            clearFieldError('city');
            onSelectLocation?.(option);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <FormSelectField
            id="ventilation-select"
            name="ventilationType"
            label="Home Ventilation Setup"
            placeholder="Select home ventilation setup..."
            value={profile.ventilationType}
            options={VENTILATION_OPTIONS}
            error={validationErrors.ventilationType}
            errorId="ventilation-error"
            selectRef={ventilationRef}
            onChange={(val) => {
              clearFieldError('ventilationType');
              onChange({ ...profile, ventilationType: val as VentilationType | '' });
            }}
          />

          <FormSelectField
            id="cooking-fuel-select"
            name="cookingFuel"
            label="Primary Cooking Fuel"
            placeholder="Select primary cooking fuel..."
            value={profile.cookingFuel}
            options={COOKING_FUEL_OPTIONS}
            error={validationErrors.cookingFuel}
            errorId="cooking-fuel-error"
            selectRef={cookingFuelRef}
            onChange={(val) => {
              clearFieldError('cookingFuel');
              onChange({ ...profile, cookingFuel: val as CookingFuel | '' });
            }}
          />
        </div>

        <FormSelectField
          id="commute-select"
          name="commuteMode"
          label="Primary Daily Commute"
          placeholder="Select primary commute mode..."
          value={profile.commuteMode}
          options={COMMUTE_MODE_OPTIONS}
          error={validationErrors.commuteMode}
          errorId="commute-error"
          selectRef={commuteRef}
          onChange={(val) => {
            clearFieldError('commuteMode');
            onChange({ ...profile, commuteMode: val as CommuteMode | '' });
          }}
        />

        <FormSelectField
          id="purifier-select"
          name="hasAirPurifier"
          label="HEPA Air Purifier Availability"
          placeholder="Select air purifier availability..."
          value={profile.hasAirPurifier}
          options={PURIFIER_OPTIONS}
          error={validationErrors.hasAirPurifier}
          errorId="purifier-error"
          selectRef={purifierRef}
          onChange={(val) => {
            clearFieldError('hasAirPurifier');
            onChange({ ...profile, hasAirPurifier: val as '' | 'yes' | 'no' });
          }}
        />

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">
            Household Sensitivities
          </legend>
          <div className="mt-2 space-y-2">
            {SENSITIVE_GROUP_OPTIONS.map((opt) => {
              const checked = profile.sensitiveGroups.includes(opt.id);
              const checkboxId = `sensitive-${opt.id}`;
              return (
                <label
                  key={opt.id}
                  htmlFor={checkboxId}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSensitiveGroup(opt.id)}
                    className="h-4 w-4 rounded border-slate-400 text-[#0F4C81]"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="lifestyle-notes" className="block text-sm font-semibold text-slate-900">
            Optional Household Notes
          </label>
          <textarea
            id="lifestyle-notes"
            name="lifestyleNotes"
            rows={2}
            maxLength={320}
            value={profile.lifestyleNotes}
            onChange={(e) => onChange({ ...profile, lifestyleNotes: e.target.value })}
            placeholder="e.g., Ground-floor flat near main road, evening incense use, school pickup at 14:30"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-65"
          style={{
            backgroundColor: ACCESSIBLE_SURFACES.primaryAction.background,
            color: ACCESSIBLE_SURFACES.primaryAction.foreground,
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Analyzing Telemetry &amp; Building Plan...</span>
            </>
          ) : (
            <span>Generate Personalized Daily Plan</span>
          )}
        </button>
      </form>
    </section>
  );
}
