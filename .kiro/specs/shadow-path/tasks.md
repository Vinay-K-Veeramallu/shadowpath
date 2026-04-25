# Implementation Plan: ShadowPath

## Overview

Implement ShadowPath as a Next.js App Router application with TypeScript, Tailwind CSS, MapLibre GL JS, and Vitest + fast-check. Tasks are ordered so each step builds on the previous: data layer → graph → route engine → scoring → UI → pages → accessibility → tests → docs.

## Tasks

- [x] 1. Project scaffolding
  - Bootstrap a Next.js 14 App Router project with TypeScript and Tailwind CSS (`create-next-app --typescript --tailwind --app`)
  - Install runtime dependencies: `maplibre-gl`, `@types/geojson`
  - Install dev/test dependencies: `vitest`, `@vitest/ui`, `@fast-check/vitest`, `fast-check`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `axe-core`, `jest-axe`
  - Configure `vitest.config.ts` with jsdom environment, coverage provider, and path aliases matching `tsconfig.json`
  - Add `test` and `test:run` scripts to `package.json`
  - Create the directory skeleton: `app/`, `lib/graph/`, `lib/routing/`, `lib/weather/`, `lib/data/`, `data/`, `components/`, `hooks/`, `contexts/`, `__tests__/routing/`, `__tests__/graph/`, `__tests__/components/`
  - Configure Tailwind with a custom `hc:` variant using `addVariant` for high-contrast overrides
  - _Requirements: 1.4, 10.1_

- [x] 2. GeoJSON campus dataset
  - Create `data/campus.geojson` as a valid GeoJSON `FeatureCollection`
  - Add at least 10 named building nodes (Point features) with `type: "building"`, `id`, `name`, `accessible`, `demoHeatIndex: 105`
  - Add at least 5 cooling-point nodes with `type: "cooling_point"`
  - Add at least 5 water-refill nodes with `type: "water_refill"`
  - Add at least 3 shade-structure nodes with `type: "intersection"` and `shadeStructures` names
  - Add walking-path edge features (LineString) connecting all nodes; each edge must include `distanceMeters`, `accessible`, `shade: { "10": N, "14": N, "18": N }`, `hasCoolingPoint`, `hasWaterRefill`, `shadeStructures`
  - Ensure the graph is fully connected (every node reachable from every other node)
  - Include at least one edge with `accessible: false` to support accessibility-mode tests
  - Include at least one edge with `hasCoolingPoint: true`
  - _Requirements: 2.1, 2.5, 6.4_

- [ ] 3. Graph types and builder
  - [x] 3.1 Define TypeScript types in `lib/graph/types.ts`
    - Export `CampusNodeProperties`, `CampusEdgeProperties`, `GraphNode`, `GraphEdge`, `CampusGraph` interfaces exactly as specified in the design
    - _Requirements: 2.3_

  - [x] 3.2 Implement `lib/graph/buildGraph.ts`
    - Parse a GeoJSON `FeatureCollection` and populate `CampusGraph` (`nodes` Map, `edges` Map, `adjacency` Map)
    - Validate that every edge references existing node IDs; throw a typed `DatasetError` if not
    - Throw `DatasetError` if the FeatureCollection is missing or malformed
    - Export `buildGraph(geojson: GeoJSON.FeatureCollection): CampusGraph`
    - _Requirements: 2.3, 2.4_

  - [x] 3.3 Implement `lib/data/loadDataset.ts`
    - Import `campus.geojson` statically and call `buildGraph`; export the resulting `CampusGraph` as a singleton
    - Catch and re-throw `DatasetError` so the UI can display the "campus data unavailable" message
    - _Requirements: 2.2, 2.4_

  - [x] 3.4 Write property test for graph serialization round-trip (P14)
    - **Property 14: Campus_Graph serialization round-trip**
    - Generate arbitrary valid GeoJSON datasets with fast-check; assert that `buildGraph(JSON.parse(JSON.stringify(geojson)))` produces identical node count, edge count, and edge weights
    - **Validates: Requirements 11.2**
    - _Test file: `__tests__/graph/buildGraph.test.ts`_

  - [x] 3.5 Write unit tests for `buildGraph`
    - Test: malformed GeoJSON throws `DatasetError` (Requirement 2.4)
    - Test: smoke-load `campus.geojson` and assert ≥10 buildings, ≥5 cooling points, ≥5 water refills, ≥3 shade structures (Requirement 2.5)
    - Test: every edge in loaded graph has `shade["10"]`, `shade["14"]`, `shade["18"]` (Requirement 6.4)
    - _Requirements: 2.1, 2.4, 2.5_

- [ ] 4. Dijkstra core and route types
  - [x] 4.1 Define route result types in `lib/routing/types.ts`
    - Export `RouteType`, `ConfidenceLabel`, `SafetyVerdict`, `RouteResult` interfaces as specified in the design
    - _Requirements: 3.1_

  - [x] 4.2 Implement `lib/routing/dijkstra.ts`
    - Implement a generic priority-queue Dijkstra with signature `dijkstra(graph, startId, endId, weightFn, filter?)` returning `{ path, edges, totalWeight } | null`
    - Use a min-heap / sorted array for the priority queue
    - Apply the `filter` predicate to exclude edges (used for accessibility mode)
    - _Requirements: 1.5, 3.2_

  - [x] 4.3 Write property test for accessibility edge exclusion (P1)
    - **Property 1: Accessibility mode excludes inaccessible edges**
    - Generate arbitrary graphs with mixed `accessible` flags; assert every edge in every returned route has `accessible === true` when `accessibilityMode` is `true`
    - **Validates: Requirements 1.5, 11.4**
    - _Test file: `__tests__/routing/accessibility.test.ts`_

- [ ] 5. Route computation functions
  - [x] 5.1 Implement `lib/routing/shortestRoute.ts`
    - Weight function: `edge.distanceMeters`; call `dijkstra` and return the minimum-distance path
    - _Requirements: 3.2_

  - [x] 5.2 Implement `lib/routing/shadeAwareRoute.ts`
    - Weight function: `edge.distanceMeters * (1 - shade[timeKey] / 100) + 0.01`
    - Accept `timeOfDay: 10 | 14 | 18` and use the corresponding shade key
    - _Requirements: 3.3, 6.2_

  - [x] 5.3 Implement `lib/routing/coolingStopRoute.ts`
    - Compute `D_min` via `shortestRoute`; run modified Dijkstra rewarding `hasCoolingPoint` edges; reject paths exceeding `1.5 * D_min`; fall back to shortest route if no valid path found
    - _Requirements: 3.4_

  - [x] 5.4 Write property test for shortest route minimum distance (P4)
    - **Property 4: Shortest route has minimum distance**
    - Generate arbitrary connected graphs; assert `shortestRoute.distanceMeters <= shadeAwareRoute.distanceMeters` and `<= coolingStopRoute.distanceMeters`
    - **Validates: Requirements 3.2**
    - _Test file: `__tests__/routing/shortestRoute.test.ts`_

  - [x] 5.5 Write property test for shade-aware route maximises shade (P5)
    - **Property 5: Shade-aware route maximises shade coverage**
    - Generate arbitrary graphs with shade values; assert `shadeAwareRoute.shadePercentage >= shortestRoute.shadePercentage`
    - **Validates: Requirements 3.3**
    - _Test file: `__tests__/routing/shadeAwareRoute.test.ts`_

  - [x] 5.6 Write property test for cooling-stop distance constraint (P6)
    - **Property 6: Cooling-stop route respects distance constraint**
    - Generate arbitrary graphs; assert `coolingStopRoute.distanceMeters <= 1.5 * shortestRoute.distanceMeters`
    - **Validates: Requirements 3.4**
    - _Test file: `__tests__/routing/coolingStopRoute.test.ts`_

  - [x] 5.7 Write property test for all three route types returned (P3)
    - **Property 3: computeRoutes returns all three route types**
    - Generate arbitrary connected graphs; assert the returned results collectively cover `"shortest"`, `"shade-aware"`, and `"cooling-stop"` (accounting for merged identical paths)
    - **Validates: Requirements 3.1**
    - _Test file: `__tests__/routing/computeRoutes.test.ts`_

- [ ] 6. Exposure score and heat safety gate
  - [x] 6.1 Implement `lib/routing/exposureScore.ts`
    - Implement `computeExposureScore` with the formula from the design; export `DEFAULT_EXPOSURE_WEIGHTS`
    - Compute `sunExposureMinutes = Math.round(durationMinutes * (1 - shadePercentage / 100))`
    - Clamp final score to [0, 100]
    - _Requirements: 4.1, 4.2, 7.2_

  - [x] 6.2 Implement `lib/routing/heatSafetyGate.ts`
    - Export `UNSAFE_THRESHOLD = 75` and `evaluateSafety(exposureScore: number): SafetyVerdict`
    - _Requirements: 5.1, 5.2, 5.6_

  - [x] 6.3 Write property test for Exposure_Score range (P7)
    - **Property 7: Exposure_Score is always in range [0, 100]**
    - Generate arbitrary valid numeric inputs; assert `computeExposureScore(...)` always returns a value in `[0, 100]`
    - **Validates: Requirements 3.6, 4.1**
    - _Test file: `__tests__/routing/exposureScore.test.ts`_

  - [x] 6.4 Write property test for shade monotonicity (P8)
    - **Property 8: Shade percentage monotonically decreases Exposure_Score**
    - Fix all inputs; vary shade from 0 to 100; assert score is non-increasing as shade increases
    - **Validates: Requirements 4.6, 11.6**
    - _Test file: `__tests__/routing/exposureScore.test.ts`_

  - [x] 6.5 Write property test for sun exposure minutes rounding (P12)
    - **Property 12: Sun exposure minutes is always a rounded whole number**
    - Generate arbitrary duration and shade values; assert `sunExposureMinutes === Math.round(durationMinutes * (1 - shadePercentage / 100))`
    - **Validates: Requirements 7.2**
    - _Test file: `__tests__/routing/exposureScore.test.ts`_

  - [x] 6.6 Write property test for Heat_Safety_Gate threshold consistency (P9)
    - **Property 9: Heat_Safety_Gate threshold is consistent across all route types**
    - Generate arbitrary scores and route types; assert `evaluateSafety(score) === "unsafe"` iff `score > 75`
    - **Validates: Requirements 5.2, 5.6**
    - _Test file: `__tests__/routing/heatSafetyGate.test.ts`_

  - [x] 6.7 Write unit tests for `heatSafetyGate`
    - Boundary tests at scores 74 (safe), 75 (safe), 76 (unsafe)
    - _Requirements: 11.3_

- [x] 7. Checkpoint — core engine complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Weather API integration
  - [x] 8.1 Define weather types in `lib/weather/types.ts`
    - Export `WeatherData` interface as specified in the design
    - _Requirements: 4.3, 4.4_

  - [x] 8.2 Implement `lib/weather/fetchWeather.ts`
    - Fetch NWS points endpoint for ASU Tempe coordinates; follow `forecastHourly` URL; find the period matching `timeOfDay`; extract temperature and heat index
    - On any failure, return demo fallback: `{ heatIndex: 105, confidence: "Low", source: "demo-fallback" }`
    - Assign confidence: `"High"` for forecasts < 6 h ahead, `"Medium"` for 6–24 h, `"Low"` for demo
    - _Requirements: 4.3, 4.4_

  - [x] 8.3 Implement `app/api/weather/route.ts`
    - Next.js Route Handler that calls `fetchWeather` server-side and returns JSON; avoids CORS issues
    - _Requirements: 4.3, 4.4_

  - [x] 8.4 Write unit tests for `fetchWeather`
    - Mock NWS failure → assert demo fallback and `confidence: "Low"` (Requirement 4.3)
    - Mock NWS success → assert live heat index and `confidence: "High"` or `"Medium"` (Requirement 4.4)
    - _Requirements: 4.3, 4.4_

- [x] 9. `computeRoutes` orchestrator
  - Implement `lib/routing/computeRoutes.ts` that calls `shortestRoute`, `shadeAwareRoute`, `coolingStopRoute`, `computeExposureScore`, and `evaluateSafety` for each path; merges identical paths; attaches `confidenceLabel`, `dataSources`, `assumptions`, and `geometry`
  - Export `computeRoutes(graph: CampusGraph, params: RouteParams, weather: WeatherData): RouteResult[]`
  - _Requirements: 3.1, 3.5, 3.6, 4.5_

- [ ] 10. React hooks and context
  - [x] 10.1 Implement `contexts/HighContrastContext.tsx`
    - Provide `highContrast: boolean` and `toggleHighContrast()` via React context
    - Persist to `localStorage`; set `data-high-contrast` attribute on `<html>` when active
    - _Requirements: 10.1, 10.2_

  - [x] 10.2 Implement `hooks/useHighContrast.ts`
    - Consume `HighContrastContext` and return `{ highContrast, toggleHighContrast }`
    - _Requirements: 10.1_

  - [x] 10.3 Implement `hooks/useWeather.ts`
    - Fetch `/api/weather` for the given `timeOfDay`; return `WeatherData`; handle loading and error states with demo fallback
    - _Requirements: 4.3, 4.4_

  - [x] 10.4 Implement `hooks/useRoutes.ts`
    - Manage `routeParams`, `routeResults`, `selectedTime`, `graphReady` state
    - Expose `triggerCompute(params)` and `handleTimeChange(time)` callbacks
    - Call `computeRoutes` synchronously on each trigger; move focus to result panel heading after computation
    - _Requirements: 1.2, 6.2, 6.3_

  - [x] 10.5 Write property test for shade slider time snapshot (P10)
    - **Property 10: Shade slider recomputes routes with correct time snapshot**
    - Generate arbitrary route params and all three time values; assert shade percentages in returned routes are derived from `edge.shade[t]`
    - **Validates: Requirements 6.2**
    - _Test file: `__tests__/routing/shadeSlider.test.ts`_

- [ ] 11. UI components
  - [x] 11.1 Implement `components/Nav.tsx`
    - Render navigation links to Home, Methodology, and Kiro Process pages
    - Include `HighContrastToggle` in the nav bar
    - Add a skip-to-content link as the first focusable element
    - _Requirements: 8.1, 9.1, 10.1_

  - [x] 11.2 Implement `components/HighContrastToggle.tsx`
    - Button that calls `toggleHighContrast()`; shows current state; keyboard-operable
    - _Requirements: 10.1, 10.3_

  - [x] 11.3 Implement `components/ShadeSlider.tsx`
    - Accessible slider with three labeled stops (10 AM, 2 PM, 6 PM)
    - Use `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`
    - Handle `ArrowLeft` / `ArrowRight` key events to advance the value
    - _Requirements: 1.6, 6.1, 6.6_

  - [x] 11.4 Implement `components/RouteForm.tsx`
    - Render origin, destination, time-of-day (via `ShadeSlider`), and accessibility mode toggle
    - Validate all fields on submit; display inline errors per field; do not call `onSubmit` if any field is empty
    - All inputs have associated `<label>` elements
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 11.5 Implement `components/HeatSafetyBadge.tsx`
    - Display safe/unsafe verdict; use `role="status"` and descriptive `aria-label`
    - Show prominent warning text when `verdict === "unsafe"`
    - _Requirements: 5.2, 5.4, 5.5_

  - [x] 11.6 Implement `components/ConfidenceBadge.tsx`
    - Display High / Medium / Low confidence label with appropriate colour coding
    - _Requirements: 4.5, 7.3_

  - [x] 11.7 Implement `components/TextRouteSummary.tsx`
    - Render a `<dl>` list with `<dt>` / `<dd>` pairs for every route result: route type, shade %, sun exposure minutes, Exposure_Score, safety verdict
    - Always visible below the map
    - _Requirements: 10.5_

  - [x] 11.8 Implement `components/RouteResultPanel.tsx`
    - Render one card per `RouteResult` showing all required fields: shade %, sun exposure minutes, Exposure_Score, Confidence_Label, Heat_Safety_Gate verdict, data sources, assumptions
    - Add `aria-live="polite"` and `aria-atomic="true"` on the container
    - Show explanatory note when `confidenceLabel === "Low"`
    - When all routes are unsafe, show shuttle / cooling-point recommendation; show no "safe" label
    - _Requirements: 5.3, 5.4, 7.1, 7.3, 7.4, 7.5_

  - [x] 11.9 Implement `components/MapView.tsx`
    - Wrap MapLibre GL JS; register `campus-edges`, `route-{type}`, and `shade-overlay` GeoJSON sources
    - Style shaded segments differently from unshaded segments for the selected time snapshot
    - Use shade colour ramp (dark green → yellow → red); switch to blue–white–orange in high contrast mode
    - Set `role="application"` and `aria-label="Campus route map"` on the wrapper div
    - Update layers on prop change without full page reload
    - _Requirements: 3.5, 6.3, 6.5, 10.2_

- [x] 12. Checkpoint — components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Home page layout
  - Implement `app/layout.tsx` with `HighContrastContext` provider, `Nav`, and skip-to-content link
  - Implement `app/page.tsx` with `RouteForm`, `MapView`, `RouteResultPanel`, and `TextRouteSummary` wired to `useRoutes` and `useWeather`
  - Display "Campus data unavailable" error and disable the form if `buildGraph` throws `DatasetError`
  - Display "No route found" message in the result panel when `computeRoutes` returns an empty array
  - _Requirements: 1.2, 2.4, 3.5, 6.3_

- [x] 14. Methodology page
  - Implement `app/methodology/page.tsx` with semantic HTML (`<article>`, `<section>`, `<h2>`)
  - Section 1: Exposure_Score formula with all variables, weights, and rationale
  - Section 2: Data sources (campus.geojson provenance, NWS API, manual seeding notes)
  - Section 3: Known limitations (hackathon data, no real-time shade sensors, static snapshots)
  - Section 4: Responsible design decisions — Heat_Safety_Gate threshold rationale, Confidence_Label system, demo-data fallback, accessibility-first routing
  - Ensure all content is keyboard-navigable and screen-reader readable
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 15. Kiro Process page
  - Implement `app/kiro-process/page.tsx`
  - Render or link to requirements.md, design.md, tasks.md, test plan summary, and experiment log
  - Add a sticky in-page table of contents with keyboard-accessible anchor links
  - Ensure keyboard navigation and screen-reader accessibility
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 16. Accessibility hardening
  - [x] 16.1 Verify and implement focus management after form submission
    - In `useRoutes`, use `useEffect` + `ref.current.focus()` to move focus to the result panel heading after `routeResults` updates
    - _Requirements: 1.4, 10.3_

  - [x] 16.2 Apply high-contrast Tailwind overrides
    - Add `hc:` variant CSS rules for all text and interactive elements; verify minimum 7:1 contrast ratio
    - _Requirements: 10.2_

  - [x] 16.3 Audit and fix ARIA attributes across all components
    - Confirm `aria-live`, `aria-atomic`, `role`, `aria-label`, `aria-valuemin/max/now/text` are present and correct on all dynamic regions and custom controls
    - _Requirements: 7.5, 10.3_

  - [x] 16.4 Run axe-core audits on key pages and components
    - Run axe-core on `RouteResultPanel`, `MethodologyPage`, `KiroProcessPage` and assert zero violations
    - _Requirements: 7.5, 8.5, 9.3_

- [ ] 17. Component and form unit tests
  - [x] 17.1 Write property test for result panel required fields (P11)
    - **Property 11: Result panel contains all required fields for any route result**
    - Generate arbitrary `RouteResult` objects; assert rendered `RouteResultPanel` contains shade %, sun exposure minutes, Exposure_Score, Confidence_Label, ≥1 data source, ≥1 assumption
    - **Validates: Requirements 7.1, 7.4**
    - _Test file: `__tests__/components/RouteResultPanel.test.tsx`_

  - [x] 17.2 Write property test for text summary mirrors results (P13)
    - **Property 13: Text route summary mirrors route results**
    - Generate arbitrary `RouteResult[]` arrays; assert `TextRouteSummary` contains text for every route type, Exposure_Score, and safety verdict
    - **Validates: Requirements 10.5**
    - _Test file: `__tests__/components/TextRouteSummary.test.tsx`_

  - [x] 17.3 Write unit tests for `RouteForm`
    - Test: all four fields present in DOM (Requirement 1.1)
    - Test: submitting with empty fields shows inline errors and does not call `onSubmit` (Requirement 1.3)
    - _Requirements: 1.1, 1.3_

  - [x] 17.4 Write unit tests for `ShadeSlider`
    - Test: ArrowRight keydown advances slider value (Requirement 6.6)
    - Test: ArrowLeft keydown decrements slider value (Requirement 6.6)
    - _Requirements: 6.1, 6.6_

  - [x] 17.5 Write unit tests for `RouteResultPanel`
    - Test: `confidenceLabel === "Low"` renders explanatory note (Requirement 7.3)
    - Test: all-unsafe results show shuttle/cooling-point recommendation and no "safe" label (Requirement 5.3, 5.4)
    - _Requirements: 5.3, 5.4, 7.3_

- [ ] 18. Form validation property test
  - [x] 18.1 Write property test for form validation (P2)
    - **Property 2: Form validation rejects incomplete submissions**
    - Generate arbitrary subsets of missing required fields; assert validation returns ≥1 error per missing field and does not invoke `computeRoutes`
    - **Validates: Requirements 1.3**
    - _Test file: `__tests__/routing/validation.test.ts`_

- [x] 19. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. README
  - Write `README.md` with: project overview, local setup instructions (`npm install`, `npm run dev`), how to run tests (`npm run test:run`), tech stack summary, and a note on the Kiro spec-driven workflow
  - _Requirements: 9.2_

- [x] 21. Demo script
  - Write `DEMO.md` with a 2-minute walkthrough script covering: loading the app, entering an origin/destination, moving the Shade_Slider, comparing the three routes, observing the Heat_Safety_Gate badge, toggling high contrast mode, and navigating to the Methodology and Kiro Process pages
  - _Requirements: 9.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 7, 12, and 19 ensure incremental validation
- All 14 correctness properties from the design are covered by property-based tests (P1–P14)
- Property tests use `@fast-check/vitest` with a minimum of 100 iterations each
- Unit tests cover boundary conditions, error paths, and example-based scenarios
- The route engine is pure TypeScript with no side effects, making it straightforward to test with fast-check generators
