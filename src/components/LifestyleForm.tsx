import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, SlidersHorizontal } from 'lucide-react';
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

export const CITY_PRESETS = [
  'Delhi, India',
  'Jaipur, India',
  'Bengaluru, India',
  'Mumbai, India',
] as const;

const SENSITIVE_GROUP_OPTIONS: Array<{ id: SensitiveGroup; label: string }> = [
  { id: 'children', label: 'Children (under 12)' },
  { id: 'seniors', label: 'Older adults (65+)' },
  { id: 'asthma_respiratory', label: 'Asthma or respiratory sensitivity' },
  { id: 'pregnant', label: 'Pregnant household member' },
  { id: 'outdoor_worker', label: 'Daily outdoor worker' },
];

type RequiredFieldKey =
  | 'city'
  | 'ventilationType'
  | 'cookingFuel'
  | 'commuteMode'
  | 'hasAirPurifier';

interface LifestyleFormProps {
  profile: HouseholdFormDraft;
  isSubmitting: boolean;
  cityInputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (updated: HouseholdFormDraft) => void;
  onSelectPresetCity: (city: string) => void;
  onSelectLocation?: (option: GeocodeOption) => void;
  onSubmit: (profile: HouseholdProfile) => void;
}

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
  const [suggestions, setSuggestions] = useState<GeocodeOption[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchingGeo, setIsSearchingGeo] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const comboboxContainerRef = useRef<HTMLDivElement | null>(null);
  const skipNextAutocompleteRef = useRef(false);

  const ventilationRef = useRef<HTMLSelectElement | null>(null);
  const cookingFuelRef = useRef<HTMLSelectElement | null>(null);
  const commuteRef = useRef<HTMLSelectElement | null>(null);
  const purifierRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    const query = profile.city.trim();
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }

    if (query.length < 2) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearchingGeo(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { results?: GeocodeOption[] };
        const items = Array.isArray(data.results) ? data.results : [];
        setSuggestions(items);
        setIsDropdownOpen(items.length > 0);
        setActiveIndex(-1);
      } catch {
        // Ignore aborted or transient autocomplete errors silently
      } finally {
        setIsSearchingGeo(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [profile.city]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        comboboxContainerRef.current &&
        !comboboxContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const clearFieldError = (field: RequiredFieldKey) => {
    if (!validationErrors[field]) return;
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleChooseSuggestion = (option: GeocodeOption) => {
    skipNextAutocompleteRef.current = true;
    const updated: HouseholdFormDraft = { ...profile, city: option.cityWithCountry };
    onChange(updated);
    clearFieldError('city');
    setSuggestions([]);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
    onSelectLocation?.(option);
  };

  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < suggestions.length) {
      e.preventDefault();
      handleChooseSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setActiveIndex(-1);
    }
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

  const activeDescendantId =
    isDropdownOpen && activeIndex >= 0 ? `city-option-${activeIndex}` : undefined;

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
        {/* City input + live autocomplete + 1-click City, Country presets */}
        <div ref={comboboxContainerRef}>
          <label htmlFor="city-input" className="block text-sm font-semibold text-slate-900">
            City &amp; Country
          </label>
          <div className="relative mt-1.5">
            <MapPin
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              ref={cityInputRef}
              id="city-input"
              name="city"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isDropdownOpen}
              aria-controls="city-autocomplete-listbox"
              aria-activedescendant={activeDescendantId}
              aria-invalid={Boolean(validationErrors.city)}
              aria-describedby={validationErrors.city ? 'city-error' : undefined}
              maxLength={80}
              value={profile.city}
              onChange={(e) => {
                clearFieldError('city');
                onChange({ ...profile, city: e.target.value });
              }}
              onFocus={() => {
                if (suggestions.length > 0) setIsDropdownOpen(true);
              }}
              onKeyDown={handleCityKeyDown}
              placeholder="Search city & country (e.g., Gurugram, India or London, UK)..."
              className={`w-full rounded-lg border bg-white py-2.5 pr-9 pl-9 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#0F4C81] ${
                validationErrors.city ? 'border-[#991B1B]' : 'border-slate-300'
              }`}
            />
            {isSearchingGeo && (
              <Loader2
                className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500"
                aria-hidden="true"
              />
            )}

            {isDropdownOpen && suggestions.length > 0 && (
              <ul
                id="city-autocomplete-listbox"
                role="listbox"
                aria-label="Matching city locations"
                className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                {suggestions.map((option, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <li
                      key={`${option.label}-${option.latitude}-${option.longitude}`}
                      id={`city-option-${idx}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleChooseSuggestion(option);
                      }}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                        isActive ? 'bg-[#EFF6FF] text-[#0F4C81]' : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate font-medium">{option.label}</span>
                      <span className="shrink-0 font-mono text-xs text-slate-500">
                        {option.countryCode}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {validationErrors.city && (
            <p id="city-error" role="alert" className="mt-1.5 text-xs font-semibold text-[#991B1B]">
              {validationErrors.city}
            </p>
          )}

          <div
            className="mt-2.5 flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Quick city presets"
          >
            <span className="mr-1 text-xs font-medium text-slate-600">Quick-fill presets:</span>
            {CITY_PRESETS.map((preset) => {
              const active = profile.city.trim().toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    skipNextAutocompleteRef.current = true;
                    clearFieldError('city');
                    setIsDropdownOpen(false);
                    onSelectPresetCity(preset);
                  }}
                  aria-pressed={active}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'border-[#0F4C81] bg-[#EFF6FF] text-[#0F4C81]'
                      : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>

        {/* Housing ventilation & cooking fuel */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <label
              htmlFor="ventilation-select"
              className="block text-sm font-semibold text-slate-900"
            >
              Home Ventilation Setup
            </label>
            <select
              ref={ventilationRef}
              id="ventilation-select"
              name="ventilationType"
              aria-invalid={Boolean(validationErrors.ventilationType)}
              aria-describedby={validationErrors.ventilationType ? 'ventilation-error' : undefined}
              value={profile.ventilationType}
              onChange={(e) => {
                clearFieldError('ventilationType');
                onChange({ ...profile, ventilationType: e.target.value as VentilationType | '' });
              }}
              className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm ${
                profile.ventilationType ? 'text-slate-900' : 'text-slate-500'
              } ${validationErrors.ventilationType ? 'border-[#991B1B]' : 'border-slate-300'}`}
            >
              <option value="" disabled>
                Select home ventilation setup...
              </option>
              <option value="cross_ventilation">Cross-ventilation windows</option>
              <option value="single_sided">Single-sided apartment</option>
              <option value="sealed_ac">Sealed windows with AC</option>
              <option value="natural_open">Naturally open / porous structure</option>
            </select>
            {validationErrors.ventilationType && (
              <p
                id="ventilation-error"
                role="alert"
                className="mt-1.5 text-xs font-semibold text-[#991B1B]"
              >
                {validationErrors.ventilationType}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="cooking-fuel-select"
              className="block text-sm font-semibold text-slate-900"
            >
              Primary Cooking Fuel
            </label>
            <select
              ref={cookingFuelRef}
              id="cooking-fuel-select"
              name="cookingFuel"
              aria-invalid={Boolean(validationErrors.cookingFuel)}
              aria-describedby={validationErrors.cookingFuel ? 'cooking-fuel-error' : undefined}
              value={profile.cookingFuel}
              onChange={(e) => {
                clearFieldError('cookingFuel');
                onChange({ ...profile, cookingFuel: e.target.value as CookingFuel | '' });
              }}
              className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm ${
                profile.cookingFuel ? 'text-slate-900' : 'text-slate-500'
              } ${validationErrors.cookingFuel ? 'border-[#991B1B]' : 'border-slate-300'}`}
            >
              <option value="" disabled>
                Select primary cooking fuel...
              </option>
              <option value="lpg">LPG Cylinder Stove</option>
              <option value="piped_gas">Piped Natural Gas (PNG)</option>
              <option value="electric_induction">Electric Induction / Ceramic</option>
              <option value="biomass_solid">Solid Fuel / Wood / Coal</option>
            </select>
            {validationErrors.cookingFuel && (
              <p
                id="cooking-fuel-error"
                role="alert"
                className="mt-1.5 text-xs font-semibold text-[#991B1B]"
              >
                {validationErrors.cookingFuel}
              </p>
            )}
          </div>
        </div>

        {/* Commute mode */}
        <div>
          <label htmlFor="commute-select" className="block text-sm font-semibold text-slate-900">
            Primary Daily Commute
          </label>
          <select
            ref={commuteRef}
            id="commute-select"
            name="commuteMode"
            aria-invalid={Boolean(validationErrors.commuteMode)}
            aria-describedby={validationErrors.commuteMode ? 'commute-error' : undefined}
            value={profile.commuteMode}
            onChange={(e) => {
              clearFieldError('commuteMode');
              onChange({ ...profile, commuteMode: e.target.value as CommuteMode | '' });
            }}
            className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm ${
              profile.commuteMode ? 'text-slate-900' : 'text-slate-500'
            } ${validationErrors.commuteMode ? 'border-[#991B1B]' : 'border-slate-300'}`}
          >
            <option value="" disabled>
              Select primary commute mode...
            </option>
            <option value="metro_bus">Metro / Public Bus</option>
            <option value="car_solo">Solo Private Car</option>
            <option value="two_wheeler">Two-Wheeler / Scooter</option>
            <option value="cycle_walk">Cycle / Walk</option>
            <option value="work_from_home">Remote / Work from Home</option>
          </select>
          {validationErrors.commuteMode && (
            <p
              id="commute-error"
              role="alert"
              className="mt-1.5 text-xs font-semibold text-[#991B1B]"
            >
              {validationErrors.commuteMode}
            </p>
          )}
        </div>

        {/* Air Purifier availability dropdown */}
        <div>
          <label htmlFor="purifier-select" className="block text-sm font-semibold text-slate-900">
            HEPA Air Purifier Availability
          </label>
          <select
            ref={purifierRef}
            id="purifier-select"
            name="hasAirPurifier"
            aria-invalid={Boolean(validationErrors.hasAirPurifier)}
            aria-describedby={validationErrors.hasAirPurifier ? 'purifier-error' : undefined}
            value={profile.hasAirPurifier}
            onChange={(e) => {
              clearFieldError('hasAirPurifier');
              onChange({ ...profile, hasAirPurifier: e.target.value as '' | 'yes' | 'no' });
            }}
            className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm ${
              profile.hasAirPurifier ? 'text-slate-900' : 'text-slate-500'
            } ${validationErrors.hasAirPurifier ? 'border-[#991B1B]' : 'border-slate-300'}`}
          >
            <option value="" disabled>
              Select air purifier availability...
            </option>
            <option value="yes">Yes — HEPA Air Purifier Available</option>
            <option value="no">No — DIY MERV-13 / No Purifier</option>
          </select>
          {validationErrors.hasAirPurifier && (
            <p
              id="purifier-error"
              role="alert"
              className="mt-1.5 text-xs font-semibold text-[#991B1B]"
            >
              {validationErrors.hasAirPurifier}
            </p>
          )}
        </div>

        {/* Sensitive groups */}
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

        {/* Optional lifestyle notes */}
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
