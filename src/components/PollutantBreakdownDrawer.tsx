import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { PollutantSubIndexDetail } from '../types/airQuality';

/**
 * Props for {@link PollutantBreakdownDrawer}.
 */
export interface PollutantBreakdownDrawerProps {
  scaleName: string;
  dominantPollutant: string;
  aqiValue: number;
  subIndices: readonly PollutantSubIndexDetail[];
}

/**
 * Collapsible disclosure panel displaying raw live pollutant concentrations,
 * computed sub-indices under the active regional AQI scale, dominant driver indicator,
 * and external monitoring agency references.
 *
 * @param props - Active scale summary and per-pollutant sub-index table rows.
 * @returns Accessible disclosure button and expandable calculation breakdown table.
 */
export function PollutantBreakdownDrawer({
  scaleName,
  dominantPollutant,
  aqiValue,
  subIndices,
}: PollutantBreakdownDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="raw-pollutant-verification-panel"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F4C81] hover:text-[#0B3A63]"
      >
        {isOpen ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
        <span>Verify Raw Pollutants &amp; Scale Calculation</span>
      </button>

      {isOpen && (
        <div
          id="raw-pollutant-verification-panel"
          className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-900">
              Sub-Index Calculation under {scaleName}
            </p>
            <p className="text-xs text-slate-600">
              Overall index equals the maximum pollutant sub-index ({dominantPollutant}:{' '}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                AQI {aqiValue}
              </span>
              ).
            </p>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2 pr-3 font-semibold">Pollutant</th>
                  <th className="py-2 pr-3 text-right font-semibold">Raw Concentration</th>
                  <th className="py-2 pr-3 text-right font-semibold">Computed Sub-Index</th>
                  <th className="py-2 font-semibold">Role</th>
                </tr>
              </thead>
              <tbody>
                {subIndices.map((row) => (
                  <tr
                    key={row.pollutant}
                    className={`border-b border-slate-200 last:border-b-0 ${
                      row.isDominant ? 'bg-[#EFF6FF] font-semibold text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    <td className="py-2 pr-3 font-mono">{row.pollutant}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {row.concentration === null ? 'N/A' : `${row.concentration} ${row.unit}`}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {row.subIndex === null ? 'N/A (Not indexed)' : row.subIndex}
                    </td>
                    <td className="py-2">
                      {row.isDominant ? (
                        <span className="inline-flex items-center gap-1 text-[#0F4C81]">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Dominant Driver</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">Secondary</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Cross-check external monitors:</span>
            <a
              href="https://airquality.cpcb.gov.in/AQI_India/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#0F4C81] underline decoration-slate-300 underline-offset-2 hover:text-[#0B3A63]"
            >
              <span>CPCB NAQI (India)</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href="https://aqicn.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#0F4C81] underline decoration-slate-300 underline-offset-2 hover:text-[#0B3A63]"
            >
              <span>AQICN World Monitor</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href="https://open-meteo.com/en/docs/air-quality-api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#0F4C81] underline decoration-slate-300 underline-offset-2 hover:text-[#0B3A63]"
            >
              <span>Open-Meteo Model Docs</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
