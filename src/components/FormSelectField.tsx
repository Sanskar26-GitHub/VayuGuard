import React from 'react';
import type { SelectOption } from '../constants/formOptions';

/**
 * Props for {@link FormSelectField}.
 */
export interface FormSelectFieldProps {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  value: string;
  options: ReadonlyArray<SelectOption>;
  error?: string;
  errorId: string;
  selectRef?: React.RefObject<HTMLSelectElement | null>;
  onChange: (value: string) => void;
}

/**
 * Reusable accessible `<select>` form field with disabled placeholder prompt and
 * inline `role="alert"` validation messaging.
 *
 * @param props - Field identifiers, options, controlled value, and change handler.
 * @returns Labelled select control wrapper.
 */
export function FormSelectField({
  id,
  name,
  label,
  placeholder,
  value,
  options,
  error,
  errorId,
  selectRef,
  onChange,
}: FormSelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <select
        ref={selectRef}
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm ${
          value ? 'text-slate-900' : 'text-slate-500'
        } ${error ? 'border-[#991B1B]' : 'border-slate-300'}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-[#991B1B]">
          {error}
        </p>
      )}
    </div>
  );
}
