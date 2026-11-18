import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { geocodeCities } from '../services/apiClient';
import type { GeocodeOption } from '../types/airQuality';

/**
 * Default 1-click quick-fill `"City, Country"` presets.
 */
export const CITY_PRESETS = [
  'Delhi, India',
  'Jaipur, India',
  'Bengaluru, India',
  'Mumbai, India',
] as const;

/**
 * Props for {@link CityAutocompleteInput}.
 */
export interface CityAutocompleteInputProps {
  value: string;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (nextCity: string) => void;
  onSelectPresetCity: (city: string) => void;
  onSelectLocation?: (option: GeocodeOption) => void;
}

/**
 * Accessible `role="combobox"` city & country search input with debounced `/api/geocode`
 * autocomplete, keyboard Arrow/Enter/Escape navigation, inline validation error support,
 * and 1-click quick-fill city presets.
 *
 * @param props - Controlled city value, validation error, and selection callbacks.
 * @returns Accessible city search combobox and preset button group.
 */
export function CityAutocompleteInput({
  value,
  error,
  inputRef,
  onChange,
  onSelectPresetCity,
  onSelectLocation,
}: CityAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<GeocodeOption[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchingGeo, setIsSearchingGeo] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const comboboxContainerRef = useRef<HTMLDivElement | null>(null);
  const skipNextAutocompleteRef = useRef(false);

  useEffect(() => {
    const query = value.trim();
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
        const items = await geocodeCities(query, controller.signal);
        setSuggestions(items);
        setIsDropdownOpen(items.length > 0);
        setActiveIndex(-1);
      } catch {
        // Ignore aborted or transient autocomplete errors silently.
      } finally {
        setIsSearchingGeo(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

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

  const handleChooseSuggestion = (option: GeocodeOption) => {
    skipNextAutocompleteRef.current = true;
    onChange(option.cityWithCountry);
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

  const activeDescendantId =
    isDropdownOpen && activeIndex >= 0 ? `city-option-${activeIndex}` : undefined;

  return (
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
          ref={inputRef}
          id="city-input"
          name="city"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isDropdownOpen}
          aria-controls="city-autocomplete-listbox"
          aria-activedescendant={activeDescendantId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'city-error' : undefined}
          maxLength={80}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsDropdownOpen(true);
          }}
          onKeyDown={handleCityKeyDown}
          placeholder="Search city & country (e.g., Gurugram, India or London, UK)..."
          className={`w-full rounded-lg border bg-white py-2.5 pr-9 pl-9 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#0F4C81] ${
            error ? 'border-[#991B1B]' : 'border-slate-300'
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

      {error && (
        <p id="city-error" role="alert" className="mt-1.5 text-xs font-semibold text-[#991B1B]">
          {error}
        </p>
      )}

      <div
        className="mt-2.5 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Quick city presets"
      >
        <span className="mr-1 text-xs font-medium text-slate-600">Quick-fill presets:</span>
        {CITY_PRESETS.map((preset) => {
          const active = value.trim().toLowerCase() === preset.toLowerCase();
          return (
            <button
              key={preset}
              type="button"
              onClick={() => {
                skipNextAutocompleteRef.current = true;
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
  );
}
