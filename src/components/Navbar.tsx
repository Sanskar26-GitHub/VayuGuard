import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { ACCESSIBLE_SURFACES } from '../styles/accessibleTheme';

/**
 * Props for {@link Navbar}.
 */
export interface NavbarProps {
  onFocusPlanner: () => void;
}

/**
 * Sticky single-row top navigation bar featuring an accessible skip link,
 * VayuGuard brand wordmark, section anchors, and quick-configure CTA.
 *
 * @param props - Action callback to focus the household planner input.
 * @returns Semantic `<header>` navigation bar.
 */
export function Navbar({ onFocusPlanner }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-[#0F4C81] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#main-content"
          className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          <ShieldCheck className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
          <span>VayuGuard</span>
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700"
        >
          <a
            href="#telemetry-section"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#0F4C81] hover:underline hover:underline-offset-4"
          >
            Telemetry
          </a>
          <a
            href="#action-plan-section"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#0F4C81] hover:underline hover:underline-offset-4"
          >
            Action Plan
          </a>
          <a
            href="#impact-simulator-section"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#0F4C81] hover:underline hover:underline-offset-4"
          >
            Impact Simulator
          </a>
          <a
            href="#ask-assistant-section"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#0F4C81] hover:underline hover:underline-offset-4"
          >
            Ask Assistant
          </a>
        </nav>

        {/* Zone 3: Single primary action button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onFocusPlanner}
            className="rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
            style={{
              backgroundColor: ACCESSIBLE_SURFACES.primaryAction.background,
              color: ACCESSIBLE_SURFACES.primaryAction.foreground,
            }}
          >
            Configure Plan
          </button>
        </div>
      </div>
    </header>
  );
}
