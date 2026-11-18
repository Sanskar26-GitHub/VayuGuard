import React from 'react';
import { Loader2, MapPin, SlidersHorizontal } from 'lucide-react';
import { ACCESSIBLE_SURFACES } from '../styles/accessibleTheme';
import type {
  CommuteMode,
  CookingFuel,
  HouseholdProfile,
  SensitiveGroup,
  VentilationType,
} from '../types/airQuality';

export const CITY_PRESETS = ['Delhi NCR', 'Jaipur', 'Bengaluru', 'Mumbai'] as const;

const SENSITIVE_GROUP_OPTIONS: Array<{ id: SensitiveGroup; label: string }> = [
  { id: 'children', label: 'Children (under 12)' },
  { id: 'seniors', label: 'Older adults (65+)' },
  { id: 'asthma_respiratory', label: 'Asthma or respiratory sensitivity' },
  { id: 'pregnant', label: 'Pregnant household member' },
  { id: 'outdoor_worker', label: 'Daily outdoor worker' },
];

interface LifestyleFormProps {
  profile: HouseholdProfile;
  isSubmitting: boolean;
  cityInputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (updated: HouseholdProfile) => void;
  onSelectPresetCity: (city: string) => void;
  onSubmit: (profile: HouseholdProfile) => void;
}

export function LifestyleForm({
  profile,
  isSubmitting,
  cityInputRef,
  onChange,
  onSelectPresetCity,
  onSubmit,
}: LifestyleFormProps) {
  const toggleSensitiveGroup = (group: SensitiveGroup) => {
    const exists = profile.sensitiveGroups.includes(group);
    const nextGroups = exists
      ? profile.sensitiveGroups.filter((g) => g !== group)
      : [...profile.sensitiveGroups, group];
    onChange({ ...profile, sensitiveGroups: nextGroups });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(profile);
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

      <form onSubmit={handleFormSubmit} className="mt-5 space-y-5">
        {/* City input + 1-click presets */}
        <div>
          <label htmlFor="city-input" className="block text-sm font-semibold text-slate-900">
            City or Urban District
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
              required
              minLength={2}
              maxLength={80}
              value={profile.city}
              onChange={(e) => onChange({ ...profile, city: e.target.value })}
              placeholder="Enter city (e.g., Delhi NCR, Pune, London)"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#0F4C81]"
            />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick city presets">
            <span className="mr-1 text-xs font-medium text-slate-600">Quick-fill presets:</span>
            {CITY_PRESETS.map((preset) => {
              const active = profile.city.trim().toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSelectPresetCity(preset)}
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
              id="ventilation-select"
              name="ventilationType"
              value={profile.ventilationType}
              onChange={(e) =>
                onChange({ ...profile, ventilationType: e.target.value as VentilationType })
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
            >
              <option value="cross_ventilation">Cross-ventilation windows</option>
              <option value="single_sided">Single-sided apartment</option>
              <option value="sealed_ac">Sealed windows with AC</option>
              <option value="natural_open">Naturally open / porous structure</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cooking-fuel-select"
              className="block text-sm font-semibold text-slate-900"
            >
              Primary Cooking Fuel
            </label>
            <select
              id="cooking-fuel-select"
              name="cookingFuel"
              value={profile.cookingFuel}
              onChange={(e) =>
                onChange({ ...profile, cookingFuel: e.target.value as CookingFuel })
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
            >
              <option value="lpg">LPG Cylinder Stove</option>
              <option value="piped_gas">Piped Natural Gas (PNG)</option>
              <option value="electric_induction">Electric Induction / Ceramic</option>
              <option value="biomass_solid">Solid Fuel / Wood / Coal</option>
            </select>
          </div>
        </div>

        {/* Commute mode */}
        <div>
          <label htmlFor="commute-select" className="block text-sm font-semibold text-slate-900">
            Primary Daily Commute
          </label>
          <select
            id="commute-select"
            name="commuteMode"
            value={profile.commuteMode}
            onChange={(e) =>
              onChange({ ...profile, commuteMode: e.target.value as CommuteMode })
            }
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="metro_bus">Metro / Public Bus</option>
            <option value="car_solo">Solo Private Car</option>
            <option value="two_wheeler">Two-Wheeler / Scooter</option>
            <option value="cycle_walk">Cycle / Walk</option>
            <option value="work_from_home">Remote / Work from Home</option>
          </select>
        </div>

        {/* HEPA purifier toggle */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <label
            htmlFor="purifier-checkbox"
            className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-slate-900"
          >
            <input
              id="purifier-checkbox"
              type="checkbox"
              checked={profile.hasAirPurifier}
              onChange={(e) => onChange({ ...profile, hasAirPurifier: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-400 text-[#0F4C81]"
            />
            <span>
              HEPA Air Purifier Available at Home
              <span className="mt-0.5 block text-xs font-normal text-slate-600">
                Uncheck to receive DIY Corsi-Rosenthal MERV-13 filtration protocols instead.
              </span>
            </span>
          </label>
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
            value={profile.lifestyleNotes ?? ''}
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
