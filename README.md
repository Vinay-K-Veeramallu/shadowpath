# ShadowPath

A mobile-first campus routing app that helps ASU Tempe students, staff, and visitors navigate safely during extreme heat. ShadowPath compares three walking routes — shortest, shade-aware, and cooling-stop — each scored with a heat Exposure_Score, a Heat_Safety_Gate verdict, and a time-travel Shade_Slider so you can plan your walk for the coolest window before you step outside.

Built for the **Kiro Spark Challenge (Environment Accountability Guardrail)** using a fully spec-driven workflow.

---

## Why ShadowPath?

Tempe summers regularly exceed 110°F. Most campus navigation tools optimise for speed, not safety. ShadowPath connects the macro problem of climate resilience to the micro-action of choosing a walking path — surfacing heat exposure data, a safety gate, and time-of-day shade comparisons so every route decision is an informed one.

---

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The app runs entirely from a local static GeoJSON dataset — no external map tile server or API key is required for core functionality. An optional live weather fetch from the National Weather Service API improves score confidence but degrades gracefully to a demo heat index (105°F) when unavailable.

---

## Running Tests

```bash
npm run test:run
```

This runs the full Vitest suite (unit tests + property-based tests) in single-pass mode. To run in watch mode during development:

```bash
npm run test
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS (with custom `hc:` high-contrast variant) |
| Map | MapLibre GL JS |
| Testing | Vitest + fast-check (property-based testing via `@fast-check/vitest`) |
| Weather | National Weather Service API (server-side proxy, graceful fallback) |
| Data | Static GeoJSON — ASU Tempe campus nodes and edges |

All route computation happens in pure TypeScript functions with no side effects, making the core engine straightforward to test with property-based generators.

---

## Project Structure

```
src/app/                # Next.js App Router pages and API routes
lib/
  graph/                # Campus_Graph builder and types
  routing/              # Dijkstra, route functions, exposure score, safety gate
  weather/              # NWS API client with demo fallback
  data/                 # GeoJSON loader
data/
  campus.geojson        # Static ASU Tempe campus dataset
components/             # React UI components
hooks/                  # useRoutes, useWeather, useHighContrast
contexts/               # HighContrastContext
__tests__/              # Vitest test suites (unit + property-based)
```

---

## Kiro Spec-Driven Workflow

ShadowPath was built end-to-end using the **Kiro spec-driven workflow**:

1. **Requirements** — user stories and acceptance criteria written first, before any code
2. **Design** — architecture, data models, algorithms, correctness properties, and testing strategy derived from requirements
3. **Tasks** — implementation plan generated from the design, with each task linked to specific requirements
4. **Tests** — 14 correctness properties (P1–P14) implemented as property-based tests with fast-check, plus unit tests for boundary conditions and error paths
5. **Kiro Process page** — the running spec artefacts are surfaced in the app at `/kiro-process` for full transparency

The full spec lives in `.kiro/specs/shadow-path/`. The Kiro Process page in the app renders or links to each artefact so evaluators can verify the workflow end-to-end.


---

## HeatShield Planner

HeatShield Planner extends ShadowPath from a single-route comparison tool into a full-day heat-risk planner. The tagline: **"Plan your school day around heat, not just time."**

### Day Planner

Enter 2–5 campus commitments for your day (location, time, flexibility). The planner computes route segments between each consecutive pair and produces per-transition heat-risk analysis — walking time, sun exposure, shade percentage, cooling/water availability, confidence label, and risk level. A preloaded demo schedule is available for quick evaluation.

### Heat Budget Dashboard

A visual budget showing how much of your daily heat exposure each walking segment consumes. Shaded routes, cooling stops, and shuttle alternatives reduce consumed budget. The dashboard displays remaining vs consumed budget, the highest-risk time block, recommended cooling break timing, and estimated reduction compared to shortest-route-only planning.

### Shuttle Alternatives

When a walking segment is classified as "higher-risk" or "not recommended", the planner recommends nearby campus shuttle stops as alternatives — including stop name, estimated wait time, walking distance, and wheelchair accessibility.

### Personal Heat Mode

Configurable preferences that tailor route recommendations to individual needs: standard walking, low exertion, wheelchair-accessible, asthma-sensitive, prefer shaded paths, prefer water refill stops, prefer cooling stops, and prefer shuttle alternatives during high-risk periods.

### Responsible Language

HeatShield Planner never uses the word "safe". All risk assessments use "lower-risk", "higher-risk", or "not recommended". The planner includes prototype disclaimers, demo data notes, and methodology transparency — it is intended for planning and awareness purposes, not as a substitute for official heat safety guidance.
