# Implementation Plan: HeatShield Planner

## Overview

HeatShield Planner is an add-on to the existing ShadowPath app. Implementation follows a bottom-up approach: steering files and dataset updates first, then TypeScript types, pure utility functions, property-based tests, React hooks/components, pages, navigation updates, and documentation. All new planner logic lives in `lib/planner/` and `components/planner/` — the existing Route_Engine is called but never modified. All 63 existing ShadowPath tests must continue to pass throughout.

## Tasks

- [x] 1. Steering files and dataset foundation
  - [x] 1.1 Create steering files for the planner feature
    - Create `.kiro/steering/product.md` with product context for the HeatShield Planner add-on
    - Create `.kiro/steering/responsible-design.md` with responsible language guidelines (never use "safe", use "lower-risk" / "higher-risk" / "not recommended")
    - Create `.kiro/steering/accessibility.md` with accessibility requirements (keyboard navigation, screen reader support, ARIA labels)
    - _Requirements: 9.3, 9.4, 9.5_

  - [x] 1.2 Add shuttle stop features to campus.geojson
    - Add 3 shuttle stop Point features to `data/campus.geojson` with type `"shuttle_stop"`
    - Each stop must have: `id`, `name`, `nearbyBuildings` (array of building IDs), `estimatedWaitMinutes`, `accessible` (boolean), and coordinates
    - Stops: `ss1` University Drive Shuttle Stop (near b1/b2), `ss2` Tyler Mall Shuttle Stop (near b3/b4), `ss3` Rural Road Shuttle Stop (near b8/b9)
    - Shuttle stops are NOT added to the routing graph — they are read directly by the planner module
    - _Requirements: 7.1, 7.2_

- [x] 2. TypeScript type definitions
  - [x] 2.1 Create `lib/planner/types.ts` with all new types
    - Define: `RiskLevel`, `CampusCommitment`, `RouteSegmentRisk`, `CoolingRecommendation`, `WaterRecommendation`, `ShuttleStop`, `ShuttleAlternative`, `ScheduleTransition`, `PersonalHeatMode`, `DailyAggregateMetrics`, `DailyHeatPlan`, `HeatBudget`, `DailySafetyEvaluation`
    - Import `RouteResult` from `lib/routing/types` for the `ScheduleTransition.routeResult` field
    - All types must match the design document data models exactly
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

- [x] 3. Pure utility functions — preference mapping and schedule transitions
  - [x] 3.1 Create `lib/planner/mapPreferences.ts`
    - Implement `mapPreferences(preferences, origin, destination, timeOfDay)` → `RouteParams`
    - Map `wheelchairAccessible` → `accessibilityMode`, pass through origin/destination/timeOfDay
    - _Requirements: 2.2, 13.1_

  - [x] 3.2 Create `lib/planner/createScheduleTransitions.ts`
    - Implement `createScheduleTransitions(commitments, graph, weather, preferences)` → `ScheduleTransition[]`
    - Sort commitments by startTime ascending
    - For each consecutive pair: map preferences → RouteParams, call `computeRoutes()`, select best route based on preferences (shade-aware if preferShadedPaths, cooling-stop if preferCoolingStops, otherwise shortest), compute segment risk, generate cooling/water/shuttle recommendations
    - Return exactly N-1 transitions for N commitments
    - Handle no-route-found case: set routeResult to null, provide default segmentRisk
    - _Requirements: 1.6, 3.1, 13.1_

- [x] 4. Pure utility functions — risk and exposure calculations
  - [x] 4.1 Create `lib/planner/calculateSegmentHeatRisk.ts`
    - Implement `calculateSegmentHeatRisk(routeResult, weather)` → `RouteSegmentRisk`
    - Extract walking time, sun exposure, shade %, cooling/water counts from RouteResult
    - Derive riskLevel from exposureScore: ≤50 → "lower-risk", 51–75 → "higher-risk", >75 → "not recommended"
    - _Requirements: 3.2, 13.2_

  - [x] 4.2 Create `lib/planner/calculateDailyHeatExposure.ts`
    - Implement `calculateDailyHeatExposure(transitions)` → `DailyAggregateMetrics`
    - Aggregate: totalOutdoorMinutes = sum of walkingTimeMinutes, totalSunExposureMinutes = sum of sunExposureMinutes, averageShadePercentage = weighted average by walking time, totalCoolingStopsAvailable = sum of coolingAvailability, highestRiskSegmentIndex, estimatedReductionPercentage
    - _Requirements: 3.3, 13.3_

  - [x] 4.3 Create `lib/planner/findHighestRiskSegment.ts`
    - Implement `findHighestRiskSegment(transitions)` → `ScheduleTransition`
    - Return the transition with the highest exposureScore; ties broken by first occurrence
    - Generate at least 3 recommended actions for the highest-risk segment (leave earlier, shaded route, cooling point, refill water, shuttle, wait for cooler period)
    - _Requirements: 5.1, 5.3, 13.4_

- [x] 5. Pure utility functions — recommendations
  - [x] 5.1 Create `lib/planner/recommendCoolingBreaks.ts`
    - Implement `recommendCoolingBreaks(transition, graph)` → `CoolingRecommendation | null`
    - Find nearest cooling point node to the transition route
    - Return name, distance, suggested break duration (5–15 min based on risk level), and reason
    - Return null if no cooling points exist near the route
    - _Requirements: 8.1, 8.2, 13.5_

  - [x] 5.2 Create `lib/planner/recommendWaterStops.ts`
    - Implement `recommendWaterStops(transition, graph)` → `WaterRecommendation | null`
    - Find nearest water refill point node to the transition route
    - Return name and distance; null if none nearby
    - _Requirements: 8.3, 8.4, 13.6_

  - [x] 5.3 Create `lib/planner/recommendShuttleAlternatives.ts`
    - Implement `recommendShuttleAlternatives(transition, shuttleStops, preferences)` → `ShuttleAlternative | null`
    - Find nearest shuttle stop within 500 meters of transition origin
    - When wheelchairAccessible preference is enabled, only consider accessible stops
    - Return null if no stop within 500m
    - _Requirements: 7.3, 7.4, 7.5, 13.7_

- [x] 6. Pure utility functions — budget and safety
  - [x] 6.1 Create `lib/planner/calculateHeatBudget.ts`
    - Implement `calculateHeatBudget(dailyPlan)` → `HeatBudget`
    - totalBudget = 100, segmentConsumption = (exposureScore/100) × (walkingTime/totalOutdoorMinutes) × 100
    - consumedBudget = sum of segment consumptions, remainingBudget = totalBudget - consumedBudget
    - Invariant: consumedBudget + remainingBudget === 100
    - Include highestRiskTimeBlock, recommendedCoolingBreak, estimatedReductionPercentage
    - _Requirements: 4.2, 4.3, 13.8_

  - [x] 6.2 Create `lib/planner/evaluateDailyHeatSafety.ts`
    - Implement `evaluateDailyHeatSafety(dailyPlan, preferences)` → `DailySafetyEvaluation`
    - Collect blocked segments (exposureScore > 75)
    - Classify: all ≤50 → "lower-risk", any 51–75 none >75 → "higher-risk", any >75 → "not recommended"
    - allowed = no blocked segments
    - Generate explanation and recommendations (at least one per blocked segment)
    - When preferShuttleAlternatives + blocked segment: shuttle recommendation first
    - Never use the word "safe" in any output string
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 13.9_

- [x] 7. Checkpoint — planner engine complete
  - Ensure all utility functions compile without TypeScript errors
  - Run existing 63 ShadowPath tests to confirm no regressions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Property-based and unit tests for utility functions
  - [x] 8.1 Write property tests for createScheduleTransitions
    - **Property 1: N commitments → N-1 transitions**
    - **Property 2: Transitions sorted by start time**
    - **Property 8: Wheelchair mode excludes inaccessible edges**
    - **Property 9: Preference mapping selects correct route type**
    - **Validates: Requirements 1.6, 3.1, 2.2, 2.3, 2.4, 14.1, 14.8**
    - Test file: `__tests__/planner/createScheduleTransitions.test.ts`

  - [x] 8.2 Write unit tests for calculateSegmentHeatRisk
    - Example-based tests with known RouteResult and WeatherData inputs
    - Verify risk level thresholds at boundary values (50, 51, 75, 76)
    - **Validates: Requirements 3.2, 13.2**
    - Test file: `__tests__/planner/calculateSegmentHeatRisk.test.ts`

  - [x] 8.3 Write property tests for calculateDailyHeatExposure
    - **Property 3: Total outdoor minutes = sum of individual walking times**
    - **Validates: Requirements 3.3, 14.2**
    - Test file: `__tests__/planner/calculateDailyHeatExposure.test.ts`

  - [x] 8.4 Write property tests for findHighestRiskSegment
    - **Property 4: Returns transition with maximum exposure score**
    - **Property 16: At least 3 recommended actions for highest-risk segment**
    - **Validates: Requirements 5.1, 5.3, 14.3**
    - Test file: `__tests__/planner/findHighestRiskSegment.test.ts`

  - [x] 8.5 Write property tests for recommendCoolingBreaks
    - **Property 12: Valid cooling recommendation fields (non-empty name, 5–15 min duration, non-empty reason)**
    - **Validates: Requirements 8.1, 8.2, 14.6**
    - Test file: `__tests__/planner/recommendCoolingBreaks.test.ts`

  - [x] 8.6 Write property tests for recommendWaterStops
    - **Property 13: Valid water recommendation fields (non-empty name, non-negative distance)**
    - **Validates: Requirements 8.3, 8.4**
    - Test file: `__tests__/planner/recommendWaterStops.test.ts`

  - [x] 8.7 Write property tests for recommendShuttleAlternatives
    - **Property 14: Null when no stop within 500m; valid ShuttleAlternative when stop exists; accessibility filtering**
    - **Validates: Requirements 7.4, 7.5, 14.7**
    - Test file: `__tests__/planner/recommendShuttleAlternatives.test.ts`

  - [x] 8.8 Write property tests for calculateHeatBudget
    - **Property 5: consumedBudget + remainingBudget === totalBudget === 100**
    - **Property 15: Higher shade → lower or equal consumedBudget**
    - **Validates: Requirements 4.2, 4.3, 14.4**
    - Test file: `__tests__/planner/calculateHeatBudget.test.ts`

  - [x] 8.9 Write property tests for evaluateDailyHeatSafety
    - **Property 6: Safety classification consistent with thresholds (≤50 lower-risk, 51–75 higher-risk, >75 not recommended)**
    - **Property 7: Risk level values are always valid labels (never "safe")**
    - **Property 10: Shuttle-first recommendation when preference enabled + high risk**
    - **Property 11: Blocked segments → at least one recommendation each**
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.7, 14.5**
    - Test file: `__tests__/planner/evaluateDailyHeatSafety.test.ts`

- [x] 9. React hook — useDayPlanner
  - [x] 9.1 Create `hooks/useDayPlanner.ts`
    - Orchestrate planner state: commitments, personalHeatMode, transitions, dailyPlan, heatBudget, safetyEvaluation, highestRiskSegment
    - Expose `submitSchedule(commitments, preferences)` that calls createScheduleTransitions → calculateDailyHeatExposure → calculateHeatBudget → evaluateDailyHeatSafety → findHighestRiskSegment
    - Reuse existing `useWeather` hook for weather data
    - Manage loading and error states
    - _Requirements: 3.1, 4.5, 13.1_

- [x] 10. Planner UI components
  - [x] 10.1 Create `components/planner/DayPlannerForm.tsx`
    - Render form for 2–5 campus commitments: location dropdown, start time, optional end time, flexibility toggle, label
    - "Add Commitment" and "Remove" buttons
    - "Load Demo Schedule" button (4 commitments: 10:30 AM Coor Hall, 12:00 PM W.P. Carey, 2:00 PM Memorial Union, 4:30 PM Hayden Library)
    - Validation: min 2, max 5 commitments with error messages
    - All inputs have `<label>` elements, keyboard-navigable
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [x] 10.2 Create `components/planner/PersonalHeatModePanel.tsx`
    - Panel of toggle switches for all 8 PersonalHeatMode preferences
    - Each toggle is a labeled checkbox with proper `role` and `aria-checked`
    - Persists to React state (session duration only)
    - _Requirements: 2.1, 2.7, 2.8_

  - [x] 10.3 Create `components/planner/TransitionCard.tsx`
    - Display per-transition metrics: origin → destination, time window, walking time, sun exposure, shade %, cooling/water availability, confidence label, risk level
    - Highlight if this is the highest-risk segment
    - Show cooling, water, and shuttle recommendations when present
    - Reuse existing `ConfidenceBadge` component
    - _Requirements: 3.4, 8.5_

  - [x] 10.4 Create `components/planner/HeatBudgetDashboard.tsx`
    - Render heat budget as a segmented progress bar, color-coded by risk level
    - Display: remaining budget, consumed budget, highest-risk time block, recommended cooling break, estimated reduction
    - All visual indicators have ARIA labels
    - _Requirements: 4.1, 4.4, 4.5, 4.6_

  - [x] 10.5 Create `components/planner/HighestRiskExplanation.tsx`
    - Explanation card: time window, origin/destination, reason for high risk, risk level
    - Display at least 3 recommended actions
    - When shuttle preference enabled + "higher-risk"/"not recommended": shuttle recommendation first
    - Keyboard-navigable and screen-reader compatible
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 10.6 Create `components/planner/DailySafetyBadge.tsx`
    - Display daily risk level with responsible language
    - Color-coded: green "lower-risk", amber "higher-risk", red "not recommended"
    - Uses `role="status"` and descriptive `aria-label`
    - _Requirements: 6.3_

  - [x] 10.7 Create `components/planner/ShuttleRecommendation.tsx`
    - Display shuttle alternative: stop name, wait time, walking distance, accessibility flag
    - _Requirements: 7.3, 7.4_

  - [x] 10.8 Create `components/planner/CoolingWaterRecommendation.tsx`
    - Display cooling recommendation: point name, distance, break duration, reason
    - Display water recommendation: point name, distance
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 10.9 Create `components/planner/DailyPlanSummary.tsx`
    - Display full-day aggregates: total outdoor minutes, total sun exposure, average shade %, total cooling stops, estimated reduction vs shortest-route-only
    - Include prototype disclaimer and demo data note
    - _Requirements: 3.5, 9.1, 9.2, 9.6_

- [x] 11. Pages — Day Planner and Why This Matters
  - [x] 11.1 Create `src/app/planner/page.tsx`
    - Wire DayPlannerForm, PersonalHeatModePanel, useDayPlanner hook
    - Render TransitionCards, HeatBudgetDashboard, HighestRiskExplanation, DailyPlanSummary, DailySafetyBadge, ShuttleRecommendation, CoolingWaterRecommendation
    - Include prototype disclaimer and demo data note
    - _Requirements: 1.1, 3.4, 3.5, 9.1, 9.2_

  - [x] 11.2 Create `src/app/why-this-matters/page.tsx`
    - Sections mapping features to judging rubric: Potential Value, Implementation, Quality & Design
    - Explain full-day planner + heat budget + shuttle alternatives → Potential Value
    - Explain pure utility functions + TypeScript types + property-based tests → Implementation
    - Explain responsible language + accessibility + methodology transparency → Quality & Design
    - Keyboard-navigable and screen-reader compatible
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 12. Component tests
  - [x] 12.1 Write tests for DayPlannerForm
    - Form renders all input fields
    - Demo schedule loads 4 commitments
    - Validation errors for <2 and >5 commitments
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.5**
    - Test file: `__tests__/planner/DayPlannerForm.test.tsx`

  - [x] 12.2 Write tests for HeatBudgetDashboard
    - Dashboard renders all required fields (remaining, consumed, highest-risk block, cooling break, reduction)
    - ARIA labels present on visual indicators
    - **Validates: Requirements 4.1, 4.4, 4.6**
    - Test file: `__tests__/planner/HeatBudgetDashboard.test.tsx`

- [x] 13. Navigation and content updates
  - [x] 13.1 Update `components/Nav.tsx` with new navigation links
    - Add "Day Planner" link pointing to `/planner`
    - Add "Why This Matters" link pointing to `/why-this-matters`
    - Preserve all existing navigation links (Home, Methodology, Kiro Process)
    - _Requirements: 10.1, 15.4_

  - [x] 13.2 Update Methodology page with planner methodology
    - Extend `src/app/methodology/page.tsx` with new section explaining heat exposure estimation methodology (per-segment and daily aggregate score calculations)
    - Add statement that planner is for planning/awareness purposes, not a substitute for official heat safety guidance
    - Preserve all existing methodology content
    - _Requirements: 9.3, 9.5, 15.3_

  - [x] 13.3 Update Kiro Process page with experiment log
    - Extend `src/app/kiro-process/page.tsx` with Experiment Log section
    - Document 3 experiments: A (shortest only), B (shade-aware), C (full-day HeatShield Planner)
    - Compare results: total sun exposure, shade %, cooling stops, daily Risk_Level
    - Include brief narrative for each experiment
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 15.3_

- [x] 14. Documentation updates
  - [x] 14.1 Update README.md with HeatShield Planner feature description
    - Add section describing the Day Planner feature, heat budget, shuttle alternatives
    - _Requirements: 15.3_

  - [x] 14.2 Update DEMO.md with 2-minute demo script
    - Cover: loading demo schedule, reviewing Personal_Heat_Mode settings, viewing per-transition results, viewing Heat_Budget dashboard, reviewing highest-risk segment explanation, viewing shuttle/cooling recommendations, closing with Why This Matters page
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 15. Final checkpoint — all tests pass
  - Run the full Vitest test suite including all new planner tests and all 63 existing ShadowPath tests
  - Verify TypeScript compilation succeeds with no errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (P1–P16)
- All new code lives in `lib/planner/`, `components/planner/`, and `hooks/` — existing modules are not modified
- The only existing files modified are `components/Nav.tsx` (new links) and `data/campus.geojson` (shuttle stops)
