import React from 'react';
import type { CommunityImpactSummary } from '../types/airQuality';

/**
 * Data series item for pillar monthly CO2e chart bars.
 */
export interface PillarCo2Bar {
  readonly label: string;
  readonly value: number;
  readonly color: string;
}

/**
 * Props for {@link ImpactCharts}.
 */
export interface ImpactChartsProps {
  impact: CommunityImpactSummary;
  pillarBars: readonly PillarCo2Bar[];
}

/**
 * Accessible inline SVG comparison charts visualizing indoor PM2.5 exposure drop
 * against the WHO 24h guideline and monthly CO2e savings across the 3 action pillars.
 *
 * @param props - Aggregated simulator metrics and per-pillar CO2e totals.
 * @returns Two responsive SVG chart cards with `role="img"`, `<title>`, and `<desc>`.
 */
export function ImpactCharts({ impact, pillarBars }: ImpactChartsProps) {
  const maxPm25Scale = Math.max(impact.baselineIndoorPm25, 35);
  const baselineBarPct = Math.min(100, (impact.baselineIndoorPm25 / maxPm25Scale) * 100);
  const postActionBarPct = Math.min(
    100,
    (impact.estimatedIndoorPm25AfterAction / maxPm25Scale) * 100,
  );
  const whoGuidelinePct = Math.min(100, (15 / maxPm25Scale) * 100);

  const maxPillarCo2 = Math.max(1, ...pillarBars.map((bar) => bar.value));

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-900">
          Estimated Indoor PM2.5 Exposure (µg/m³)
        </h3>
        <p className="mt-0.5 text-xs text-slate-600">
          Compares unmitigated indoor infiltration against adopted household controls.
        </p>

        <svg
          role="img"
          aria-label={`Indoor PM2.5 comparison: baseline ${impact.baselineIndoorPm25} micrograms per cubic meter, after actions ${impact.estimatedIndoorPm25AfterAction} micrograms per cubic meter, WHO 24-hour guideline 15 micrograms per cubic meter.`}
          viewBox="0 0 420 155"
          className="mt-3 w-full overflow-visible"
        >
          <title>Indoor PM2.5 Exposure Comparison Chart</title>
          <desc>
            Horizontal bar chart comparing baseline indoor PM2.5, post-action indoor PM2.5, and WHO 24-hour guideline.
          </desc>

          <text x="0" y="22" className="fill-slate-800 text-[12px] font-semibold">
            Baseline Indoor
          </text>
          <rect x="130" y="10" width="210" height="18" rx="4" className="fill-slate-200" />
          <rect
            x="130"
            y="10"
            width={Math.max(4, (baselineBarPct / 100) * 210)}
            height="18"
            rx="4"
            fill="#991B1B"
          />
          <text x="348" y="23" className="fill-slate-900 font-mono text-[12px] font-bold">
            {impact.baselineIndoorPm25} µg/m³
          </text>

          <text x="0" y="68" className="fill-slate-800 text-[12px] font-semibold">
            With Adopted Plan
          </text>
          <rect x="130" y="56" width="210" height="18" rx="4" className="fill-slate-200" />
          <rect
            x="130"
            y="56"
            width={Math.max(4, (postActionBarPct / 100) * 210)}
            height="18"
            rx="4"
            fill="#065F46"
          />
          <text x="348" y="69" className="fill-[#065F46] font-mono text-[12px] font-bold">
            {impact.estimatedIndoorPm25AfterAction} µg/m³
          </text>

          <text x="0" y="114" className="fill-slate-700 text-[12px] font-medium">
            WHO 24h Target
          </text>
          <rect x="130" y="102" width="210" height="18" rx="4" className="fill-slate-200" />
          <rect
            x="130"
            y="102"
            width={Math.max(4, (whoGuidelinePct / 100) * 210)}
            height="18"
            rx="4"
            fill="#0F4C81"
          />
          <text x="348" y="115" className="fill-[#0F4C81] font-mono text-[12px] font-semibold">
            15.0 µg/m³
          </text>
        </svg>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-900">
          Monthly CO2e Avoided by Pillar (kg/month)
        </h3>
        <p className="mt-0.5 text-xs text-slate-600">
          Scaled to {impact.householdScale.toLocaleString()}{' '}
          {impact.householdScale === 1 ? 'household' : 'households'}.
        </p>

        <svg
          role="img"
          aria-label={`Monthly CO2e avoided by pillar for ${impact.householdScale} households: Daily Routines ${pillarBars[0].value} kg, IAQ Hacks ${pillarBars[1].value} kg, Clean Alternatives ${pillarBars[2].value} kg.`}
          viewBox="0 0 420 155"
          className="mt-3 w-full overflow-visible"
        >
          <title>Monthly Community CO2e Savings by Pillar</title>
          <desc>
            Horizontal bar chart comparing monthly CO2e saved across the three VayuGuard pillars.
          </desc>

          {pillarBars.map((bar, idx) => {
            const yLabel = 22 + idx * 46;
            const yRect = 10 + idx * 46;
            const barWidth =
              bar.value <= 0 ? 0 : Math.max(6, (bar.value / maxPillarCo2) * 210);
            return (
              <g key={bar.label}>
                <text x="0" y={yLabel} className="fill-slate-800 text-[12px] font-semibold">
                  {bar.label}
                </text>
                <rect x="130" y={yRect} width="210" height="18" rx="4" className="fill-slate-200" />
                {barWidth > 0 && (
                  <rect
                    x="130"
                    y={yRect}
                    width={barWidth}
                    height="18"
                    rx="4"
                    fill={bar.color}
                  />
                )}
                <text
                  x="348"
                  y={yLabel + 1}
                  className="fill-slate-900 font-mono text-[12px] font-bold"
                >
                  {bar.value.toLocaleString()} kg
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
