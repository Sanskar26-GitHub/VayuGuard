# VayuGuard — Urban Air Quality & Low-Emission Assistant

VayuGuard is a full-stack TypeScript web application designed to help urban households and neighborhoods convert real-time air quality telemetry into immediate protective actions and measurable carbon-emission reductions.

---

## Chosen Vertical

**Environmental Health, Urban Air Quality & Household Decarbonization**

Passively refreshing Air Quality Index (AQI) apps every ten minutes neither lowers indoor PM2.5 exposure nor reduces the local combustion emissions driving urban smog. VayuGuard bridges the gap between atmospheric telemetry and daily household behavior by combining keyless meteorological physics with personalized, grounded action plans and a neighborhood impact simulator.

---

## Approach and Logic

1. **Population-Prioritized Geocoding & Live `current=` Telemetry**: Before generating any recommendation, VayuGuard queries Open-Meteo's geocoding API (`count=5`) and sorts candidates by `population` descending so major cities (e.g., Chicago, IL; Delhi; London) are resolved accurately without homonymous small-town collisions. It then queries Open-Meteo's real-time `current=` Air Quality (`pm2_5`, `pm10`, `nitrogen_dioxide`, `carbon_monoxide`, `ozone`, `sulphur_dioxide`, `us_aqi` with `timezone=auto`) and Weather (`temperature_2m`, `relative_humidity_2m`, `wind_speed_10m` with `timezone=auto`) endpoints using a strict 5-second `AbortController` timeout, computing boundary-layer **Thermal Inversion Risk** (`temperature < 15°C && windSpeed < 8 km/h`).
2. **Location-Aware Regional AQI Scale Engine (`regionalAqiService.ts`)**: Using the geocoded ISO `country_code`, VayuGuard automatically selects the official governing AQI standard and computes the index directly from live raw pollutant concentrations via linear sub-index interpolation (or discrete step lookup) across the dominant pollutant, while letting users manually switch scales to compare:
   - **`IN_CPCB` (`IN`) — India NAQI (CPCB, 0–500)**: Breakpoints for PM2.5, PM10, NO2, O3, SO2, and CO (`µg/m³ / 1000` to `mg/m³`) across `Good`, `Satisfactory`, `Moderately Polluted`, `Poor`, `Very Poor`, and `Severe`.
   - **`US_EPA` (`US` & Global Default, 0–500)**: Standard US EPA breakpoints for PM2.5, PM10, NO2, O3, and CO across `Good` through `Hazardous`.
   - **`CN_MEE` (`CN`) — China MEE AQI (HJ 633-2012, 0–500)**: Categories `Excellent` through `Severely Polluted`.
   - **`UK_DAQI` (`GB`/`UK`) — UK Daily Air Quality Index (1–10)**: Categories `Low` (1–3), `Moderate` (4–6), `High` (7–9), and `Very High` (10).
   - **`EU_EAQI` (27 EU Member States) — European Air Quality Index (1–6)**: Categories `Good` (1) through `Extremely Poor` (6).
3. **Three-Pillar Action Architecture**: Using the official `@google/genai` SDK (`gemini-4-hydrogen` with jittered exponential backoff and fallback to `gemini-3.1-flash-lite`), the backend generates structured JSON recommendations (`responseSchema`) across three pillars:
   - **Pillar 1 — Low-Emission Daily Routines**: Commute mode/timing shifts, idling elimination, and fuel-efficient cooking/appliance batching.
   - **Pillar 2 — Indoor Air Quality (IAQ) Hacks**: Solar-mixing ventilation windows, damp microfiber mopping over dry sweeping, draft sealing, and HEPA / DIY MERV-13 Corsi-Rosenthal filtration protocols.
   - **Pillar 3 — Sustainable Alternatives**: Eliminating indoor smoldering sources (mosquito coils, incense, paraffin candles), low-VOC cleaners, and reusable N95/FFP2 rotation.
4. **Programmatic Verification & Bounds Clamping**: Every recommendation passes through `groundingService.ts` to clamp `co2SavedKgPerDay` to `[0.05, 15.0]` kg/day, clamp `pm25ReductionPercent` to `[1, 85]`%, and verify explicit references to live regional telemetry.
5. **Zero-Token Client-Side Community Simulator**: Adoption toggles and a 1–1,000 household neighborhood scale slider recalculate monthly CO2e savings, annual tonnes avoided, and indoor PM2.5 exposure curves deterministically in the browser.

---

## How the Solution Works

### Architecture Diagram

```
+-------------------------------------------------------------------+
|                        React Frontend (Vite)                      |
|  Navbar · AirTelemetryBanner (Scale Switcher) · LifestyleForm     |
|  RecommendationCard · ImpactSimulator · AskAssistantPanel         |
+---------------------------------+---------------------------------+
                                  | HTTPS / JSON (32 KB cap)
                                  v
+-------------------------------------------------------------------+
|                     Express Backend (server.ts)                   |
|  /api/plan · /api/ask · /api/air-quality (?scale=) · /api/health  |
+--------+--------------------+--------------------+----------------+
         |                    |                    |
         v                    v                    v
+----------------+   +------------------+   +-----------------------+
| Sanitization   |   | Open-Meteo APIs  |   | Bounded LRU Cache     |
| Control-strip, |   | Geo (count=5) +  |   | SHA-256 payload key   |
| XML escaping,  |   | current= AQ & Wx |   | Max 250 items / 2 MiB |
| scaleOverride  |   | + Regional AQI   |   +-----------------------+
+--------+-------+   +--------+---------+
         |                    |
         +---------+----------+
                   v
+-------------------------------------------------------------------+
|  @google/genai (gemini-4-hydrogen -> gemini-3.1-flash-lite)       |
|  Structured JSON responseSchema + <untrusted_user_input> defense  |
|  -> fallbackPlanService.ts (severityTier parametric fallback)     |
|  -> groundingService.ts (bounds clamping & telemetry citation)    |
+-------------------------------------------------------------------+
```

### Security & WCAG Accessibility Posture

- **Server-Side Secret Isolation**: `GEMINI_API_KEY` is loaded strictly on the Express backend via `dotenv`; no `VITE_` client exposure exists. `sanitizeGeminiError` strips API keys, bearer tokens, file paths, and stack traces from errors.
- **Prompt-Injection Defense**: `sanitizationService.ts` strips control characters, truncates inputs, escapes HTML/XML syntax (`<`, `>`, `&`, `"`, `'`), and encloses user strings inside `<untrusted_user_input>` tags. System instructions enforce treating tagged data strictly as inert text.
- **Bounded Memory Safety**: `cacheService.ts` enforces both `MAX_ENTRIES = 250` and `MAX_MEMORY_BYTES = 2 MiB` with LRU eviction keyed by canonical SHA-256 digests (including active regional scale and AQI band).
- **WCAG 2.1 AA/AAA Compliance**: `src/styles/accessibleTheme.ts` centralizes and documents exact luminance contrast ratios (`>= 4.5:1` AA and `>= 7.0:1` AAA) across unified severity tiers `1–6`. Status indicators always pair icons with explicit text labels (never color alone), interactive cards support `Enter`/`Space` keyboard toggling, and `aria-live="polite"` announces plan and regional scale updates.

---

## Assumptions Made

- **Outdoor-to-Indoor Infiltration Model**: The client-side Impact Simulator estimates baseline indoor PM2.5 using ventilation-type infiltration factors (`0.55` for sealed AC up to `0.88` for naturally open structures), purifier adjustment (`0.72`), and a `+8 µg/m³` indoor background activity baseline.
- **Multiplicative Exposure Reduction**: Combined indoor PM2.5 reduction across adopted habits is modeled multiplicatively and capped at `85%` to avoid unrealistic >100% additive claims.
- **Offline Meteorological Baselines**: If external Open-Meteo endpoints are unreachable or exceed the 5-second `AbortController` timeout in restricted environments, `weatherAirService.ts` falls back to representative meteorological baselines clearly labeled `Offline Baseline` (`telemetrySource: 'offline-baseline'`).

---

## Project Structure

```
.
├── eslint.config.js                      # ESLint v9 flat config (strict TS & type-imports rules)
├── server.ts                             # Express + Vite middleware entrypoint (port 3000)
├── server/
│   ├── config/
│   │   └── gemini.ts                     # @google/genai client, model fallback & error sanitization
│   ├── constants/
│   │   └── aqiBreakpoints.ts             # Regional AQI breakpoint tables & offline baselines
│   ├── prompts/
│   │   └── airQualityPrompt.ts           # Structured responseSchema & XML prompt-injection boundaries
│   ├── routes/
│   │   └── api.ts                        # /api/health, /api/geocode, /api/air-quality, /api/plan, /api/ask
│   ├── services/
│   │   ├── cacheService.ts               # Bounded SHA-256 LRU cache (250 items / 2 MiB)
│   │   ├── fallbackPlanService.ts        # Severity-tier parametric action & Q&A fallback
│   │   ├── geocodingService.ts           # "City, Country" parsing, country hints & population ranking
│   │   ├── groundingService.ts           # Physical bounds clamping & telemetry citation verification
│   │   ├── regionalAqiService.ts         # Unified interpolateSubIndex regional AQI scale engine
│   │   ├── sanitizationService.ts        # Control-char stripping, XML escaping & payload validation
│   │   └── weatherAirService.ts          # Open-Meteo current= AQ/weather fetch & thermal inversion detector
│   └── utils/
│       ├── httpClient.ts                 # Shared AbortController timeout & retry JSON client
│       └── logger.ts                     # Structured redacting server logger
├── src/
│   ├── App.tsx                           # Top-level workspace layout composing hooks & components
│   ├── components/
│   │   ├── ActionPlanSection.tsx         # Filterable 3-pillar daily action plan section
│   │   ├── AirTelemetryBanner.tsx        # Live AQI, weather, coordinates & regional scale switcher
│   │   ├── AskAssistantPanel.tsx         # Grounded situational Q&A panel
│   │   ├── CityAutocompleteInput.tsx     # Accessible role="combobox" city autocomplete & presets
│   │   ├── EmptyWorkspaceCard.tsx        # 3-step onboarding card before plan submission
│   │   ├── ErrorBoundary.tsx             # React error recovery & WCAG AA error alert banner
│   │   ├── FormSelectField.tsx           # Reusable accessible select control with validation
│   │   ├── ImpactCharts.tsx              # Accessible inline SVG PM2.5 and CO2e comparison charts
│   │   ├── ImpactSimulator.tsx           # Client-side household/community impact simulator
│   │   ├── LifestyleForm.tsx             # Household ventilation, fuel, commute & sensitivity form
│   │   ├── Navbar.tsx                    # Sticky accessible header navigation with skip link
│   │   ├── PollutantBreakdownDrawer.tsx  # Collapsible raw pollutant sub-index verification table
│   │   ├── RecommendationCard.tsx        # Keyboard-accessible action card with impact breakdown
│   │   └── TelemetryMetricGrid.tsx       # 6-card live pollutant & weather telemetry grid
│   ├── constants/
│   │   └── formOptions.ts                # Typed household form & sensitivity group options
│   ├── hooks/
│   │   ├── useActionPlan.ts              # Plan generation, simulator adoption & Q&A state hooks
│   │   └── useAirTelemetry.ts            # City telemetry preview & AQI scale-switching hook
│   ├── services/
│   │   └── apiClient.ts                  # Typed frontend API client with AbortSignal & error parsing
│   ├── styles/
│   │   └── accessibleTheme.ts            # WCAG 2.1 AA/AAA luminance-verified palette tokens
│   ├── types/
│   │   └── airQuality.ts                 # Shared TypeScript domain contracts
│   └── utils/
│       ├── formatters.ts                 # Local observation timezone & hemisphere coordinate formatters
│       └── impactMath.ts                 # Deterministic indoor PM2.5 & community CO2e simulator math
└── test/
    ├── backend.spec.ts                   # Sanitization, LRU cache, regional AQI & Open-Meteo parser tests
    ├── formatters.spec.ts                # Timezone observation & hemisphere coordinate formatter tests
    ├── frontend.spec.tsx                 # Contrast ratios, empty initial state, validation & ARIA tests
    ├── geocoding.spec.ts                 # City/Country parsing, country matching & sub-index tests
    ├── grounding.spec.ts                 # Physical bounds clamping & impact simulator tests
    └── prompt-injection.spec.ts          # XML escaping & untrusted delimiter isolation tests
```

---

## Running Locally & Quality Gates

1. Configure `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run development server (Express + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```
4. Run automated quality gates (ESLint + strict TypeScript check, Vitest suite, and Vite production build):
   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

