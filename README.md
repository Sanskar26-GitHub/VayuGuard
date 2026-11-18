# VayuGuard — Urban Air Quality & Low-Emission Assistant

VayuGuard is a full-stack TypeScript web application designed to help urban households and neighborhoods convert real-time air quality telemetry into immediate protective actions and measurable carbon-emission reductions.

---

## Chosen Vertical

**Environmental Health, Urban Air Quality & Household Decarbonization**

Passively refreshing Air Quality Index (AQI) apps every ten minutes neither lowers indoor PM2.5 exposure nor reduces the local combustion emissions driving urban smog. VayuGuard bridges the gap between atmospheric telemetry and daily household behavior by combining keyless meteorological physics with personalized, grounded action plans and a neighborhood impact simulator.

---

## Approach and Logic

1. **Physics-First Telemetry Grounding**: Before generating any recommendation, VayuGuard fetches live US AQI, PM2.5, PM10, NO2, CO, temperature, humidity, and wind speed from the keyless Open-Meteo Geocoding, Air Quality, and Weather APIs using a strict 5-second `AbortController` timeout. It computes boundary-layer **Thermal Inversion Risk** (`temperature < 15°C && windSpeed < 8 km/h`), identifying when cool stagnant air traps pollutants at street level.
2. **Three-Pillar Action Architecture**: Using the official `@google/genai` SDK (`gemini-4-hydrogen` with jittered exponential backoff and fallback to `gemini-3.1-flash-lite`), the backend generates structured JSON recommendations (`responseSchema`) across three pillars:
   - **Pillar 1 — Low-Emission Daily Routines**: Commute mode/timing shifts, idling elimination, and fuel-efficient cooking/appliance batching.
   - **Pillar 2 — Indoor Air Quality (IAQ) Hacks**: Solar-mixing ventilation windows, damp microfiber mopping over dry sweeping, draft sealing, and HEPA / DIY MERV-13 Corsi-Rosenthal filtration protocols.
   - **Pillar 3 — Sustainable Alternatives**: Eliminating indoor smoldering sources (mosquito coils, incense, paraffin candles), low-VOC cleaners, and reusable N95/FFP2 rotation.
3. **Programmatic Verification & Bounds Clamping**: Every recommendation passes through `groundingService.ts` to clamp `co2SavedKgPerDay` to `[0.05, 15.0]` kg/day, clamp `pm25ReductionPercent` to `[1, 85]`%, and verify explicit references to live city telemetry.
4. **Zero-Token Client-Side Community Simulator**: Adoption toggles and a 1–1,000 household neighborhood scale slider recalculate monthly CO2e savings, annual tonnes avoided, and indoor PM2.5 exposure curves deterministically in the browser.

---

## How the Solution Works

### Architecture Diagram

```
+-------------------------------------------------------------------+
|                        React Frontend (Vite)                      |
|  Navbar · AirTelemetryBanner · LifestyleForm · RecommendationCard |
|  ImpactSimulator (SVG Charts) · AskAssistantPanel · ErrorBoundary |
+---------------------------------+---------------------------------+
                                  | HTTPS / JSON (32 KB cap)
                                  v
+-------------------------------------------------------------------+
|                     Express Backend (server.ts)                   |
|  /api/plan · /api/ask · /api/air-quality · /api/health            |
+--------+--------------------+--------------------+----------------+
         |                    |                    |
         v                    v                    v
+----------------+   +------------------+   +-----------------------+
| Sanitization   |   | Open-Meteo APIs  |   | Bounded LRU Cache     |
| Control-strip, |   | Geocoding + AQI  |   | SHA-256 payload key   |
| XML escaping   |   | + Weather (5s)   |   | Max 250 items / 2 MiB |
+--------+-------+   +--------+---------+   +-----------------------+
         |                    |
         +---------+----------+
                   v
+-------------------------------------------------------------------+
|  @google/genai (gemini-4-hydrogen -> gemini-3.1-flash-lite)       |
|  Structured JSON responseSchema + <untrusted_user_input> defense  |
|  -> fallbackPlanService.ts (dynamic parametric fallback)          |
|  -> groundingService.ts (bounds clamping & telemetry citation)    |
+-------------------------------------------------------------------+
```

### Security & WCAG Accessibility Posture

- **Server-Side Secret Isolation**: `GEMINI_API_KEY` is loaded strictly on the Express backend via `dotenv`; no `VITE_` client exposure exists. `sanitizeGeminiError` strips API keys, bearer tokens, file paths, and stack traces from errors.
- **Prompt-Injection Defense**: `sanitizationService.ts` strips control characters, truncates inputs, escapes HTML/XML syntax (`<`, `>`, `&`, `"`, `'`), and encloses user strings inside `<untrusted_user_input>` tags. System instructions enforce treating tagged data strictly as inert text.
- **Bounded Memory Safety**: `cacheService.ts` enforces both `MAX_ENTRIES = 250` and `MAX_MEMORY_BYTES = 2 MiB` with LRU eviction keyed by canonical SHA-256 digests.
- **WCAG 2.1 AA/AAA Compliance**: `src/styles/accessibleTheme.ts` centralizes and documents exact luminance contrast ratios (`>= 4.5:1` AA and `>= 7.0:1` AAA). Status indicators always pair icons with explicit text labels (never color alone), interactive cards support `Enter`/`Space` keyboard toggling, and `aria-live="polite"` announces plan and telemetry updates.

---

## Assumptions Made

- **Outdoor-to-Indoor Infiltration Model**: The client-side Impact Simulator estimates baseline indoor PM2.5 using ventilation-type infiltration factors (`0.55` for sealed AC up to `0.88` for naturally open structures), purifier adjustment (`0.72`), and a `+8 µg/m³` indoor background activity baseline.
- **Multiplicative Exposure Reduction**: Combined indoor PM2.5 reduction across adopted habits is modeled multiplicatively and capped at `85%` to avoid unrealistic >100% additive claims.
- **Offline Meteorological Baselines**: If external Open-Meteo endpoints are unreachable or exceed the 5-second `AbortController` timeout in restricted environments, `weatherAirService.ts` falls back to representative meteorological baselines labeled `meteorological-baseline`.

---

## Running Locally & Verification

1. Configure `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies and run the test suite:
   ```bash
   npm install
   npm test
   ```
3. Run development server (Express + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```
4. Build and type-check production bundle:
   ```bash
   npm run lint && npm run build
   ```
