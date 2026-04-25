# Requirements Document

## Introduction

HeatShield Planner is an add-on feature for the existing ShadowPath campus routing application. While ShadowPath handles single-route comparison between two campus locations, HeatShield Planner extends the app into a full-day heat-risk planner with the tagline "Plan your school day around heat, not just time." Users enter 2–5 campus commitments for their day, and the planner calculates route segments between each commitment, produces per-transition heat-risk analysis, aggregates a daily heat exposure budget, identifies the highest-risk segment, and recommends cooling breaks, water refills, and shuttle alternatives. The feature preserves all existing ShadowPath functionality and builds on top of the existing Route_Engine, Campus_Graph, and GeoJSON_Dataset.

---

## Glossary

- **App**: The ShadowPath / HeatShield Planner Next.js web application.
- **Route_Engine**: The existing pure TypeScript module that computes and scores candidate routes between two campus locations.
- **Day_Planner**: The new full-day schedule input page where users enter 2–5 campus commitments.
- **Campus_Commitment**: A single entry in the user's daily schedule, consisting of a campus location, start time, optional end time, flexibility flag, and label.
- **Schedule_Transition**: A walking segment between two consecutive Campus_Commitments, computed by the Route_Engine.
- **Personal_Heat_Mode**: A set of user-selected preferences that affect route recommendations and heat-risk calculations (e.g., wheelchair-accessible, asthma-sensitive, prefer shaded paths).
- **Daily_Heat_Plan**: The complete output of the planner: all Schedule_Transitions with per-segment and full-day aggregate metrics.
- **Heat_Budget**: A dashboard model representing daily heat exposure budget consumption, where each walking segment consumes budget and shaded routes, cooling stops, and shuttles reduce risk.
- **Heat_Safety_Gate**: The logic component that evaluates predicted heat exposure and determines risk level. Extended from the existing single-route gate to full-day evaluation.
- **Daily_Safety_Evaluation**: The output of the full-day Heat_Safety_Gate, including allowed status, risk level, blocked segments, explanation, and recommendations.
- **Exposure_Score**: A numeric value (0–100) representing predicted heat exposure for a given route segment.
- **Segment_Risk**: A per-transition risk assessment including walking time, sun exposure, shade percentage, cooling/water availability, accessibility, confidence, and heat-risk level.
- **Shuttle_Stop**: A campus transit stop with an identifier, name, nearby building associations, coordinates, estimated wait time, and accessibility flag.
- **Shuttle_Alternative**: A recommendation to use a campus shuttle instead of walking during a high-risk segment.
- **Cooling_Recommendation**: A recommendation to take a cooling break at a nearby Cooling_Point, including location, suggested duration, and reason.
- **Water_Recommendation**: A recommendation to refill water at a nearby Water_Refill_Point along a transition route.
- **Campus_Graph**: The in-memory weighted graph built from the preloaded Tempe campus GeoJSON dataset.
- **GeoJSON_Dataset**: The local static dataset containing buildings, walking path edges, cooling points, water refill points, shuttle stops, shade structures, and accessibility flags.
- **Confidence_Label**: A categorical indicator (High / Medium / Low) expressing the reliability of a score given data completeness and forecast availability.
- **Risk_Level**: A categorical label for heat risk: "lower-risk", "higher-risk", or "not recommended". The App never uses the word "safe".
- **Why_This_Matters_Page**: A dedicated page mapping the feature to hackathon judging rubric categories (Potential Value, Implementation, Quality & Design).
- **Experiment_Log**: A page or section documenting three experiments (shortest only, shade-aware, full-day planner) and comparing results.

---

## Requirements

### Requirement 1: Day Planner Schedule Input

**User Story:** As a campus user, I want to enter my daily campus commitments so that the planner can calculate heat-optimised routes between each one.

#### Acceptance Criteria

1. THE App SHALL provide a Day_Planner page where users can enter between 2 and 5 Campus_Commitments.
2. WHEN a user adds a Campus_Commitment, THE Day_Planner SHALL collect a campus location, start time, optional end time, flexibility flag (flexible or fixed), and a text label.
3. THE Day_Planner SHALL provide a preloaded demo schedule containing four commitments: 10:30 AM Coor Hall, 12:00 PM W.P. Carey, 2:00 PM Memorial Union, and 4:30 PM Hayden Library.
4. IF a user submits the Day_Planner with fewer than 2 commitments, THEN THE App SHALL display a validation error stating that at least 2 commitments are required and SHALL NOT invoke the planner computation.
5. IF a user submits the Day_Planner with more than 5 commitments, THEN THE App SHALL display a validation error stating that a maximum of 5 commitments is allowed and SHALL NOT invoke the planner computation.
6. THE Day_Planner SHALL sort Campus_Commitments by start time in ascending order before computing transitions.
7. THE Day_Planner SHALL be accessible via keyboard navigation and readable by screen readers, with appropriate labels on all input fields.

---

### Requirement 2: Personal Heat Mode Settings

**User Story:** As a campus user, I want to configure personal heat mode preferences so that route recommendations account for my specific needs and comfort level.

#### Acceptance Criteria

1. THE App SHALL provide a Personal_Heat_Mode settings panel with the following toggleable options: Standard walking, Low exertion, Wheelchair-accessible, Asthma-sensitive, Prefer shaded paths, Prefer water refill stops, Prefer cooling stops, and Prefer shuttle alternatives during high-risk periods.
2. WHEN the Wheelchair-accessible preference is enabled, THE Route_Engine SHALL exclude path edges whose Accessibility_Flag is false from all computed transitions.
3. WHEN the Prefer shaded paths preference is enabled, THE Route_Engine SHALL prioritise shade-aware routes for each Schedule_Transition.
4. WHEN the Prefer cooling stops preference is enabled, THE Route_Engine SHALL prioritise routes that pass through Cooling_Points for each Schedule_Transition.
5. WHEN the Prefer water refill stops preference is enabled, THE Route_Engine SHALL prioritise routes that pass through Water_Refill_Points for each Schedule_Transition.
6. WHEN the Prefer shuttle alternatives preference is enabled and a Schedule_Transition is classified as "higher-risk" or "not recommended", THE App SHALL recommend a Shuttle_Alternative for that transition.
7. THE Personal_Heat_Mode settings panel SHALL persist selections for the duration of the user session.
8. THE Personal_Heat_Mode settings panel SHALL be accessible via keyboard and readable by screen readers.

---

### Requirement 3: Daily Heat Exposure Planner Computation

**User Story:** As a campus user, I want the planner to calculate route segments between each of my commitments so that I can see per-transition and full-day heat exposure metrics.

#### Acceptance Criteria

1. WHEN a user submits a valid schedule, THE App SHALL use the existing Route_Engine to compute route segments between each pair of consecutive Campus_Commitments, producing one Schedule_Transition per pair.
2. THE App SHALL compute the following metrics for each Schedule_Transition: walking time in minutes, sun exposure in minutes, shade percentage, cooling point availability (count), water refill availability (count), accessibility compliance, Confidence_Label, and Risk_Level.
3. THE App SHALL compute the following full-day aggregate metrics: total outdoor walking minutes, total sun exposure minutes, average shade percentage across all transitions, total cooling stops available, identification of the highest-risk segment, and estimated heat exposure reduction compared to shortest-route-only planning.
4. THE App SHALL display per-transition metrics in a list or card layout ordered by schedule time.
5. THE App SHALL display full-day aggregate metrics in a summary section above or below the per-transition details.
6. IF no route exists between two consecutive commitments, THEN THE App SHALL display a message for that transition stating that no walking route was found and SHALL recommend a shuttle or alternative transport.

---

### Requirement 4: Heat Budget Visualisation

**User Story:** As a campus user, I want to see a heat budget dashboard so that I can understand how much of my daily heat exposure budget each walking segment consumes.

#### Acceptance Criteria

1. THE App SHALL display a Heat_Budget dashboard showing daily heat exposure budget consumption as a visual indicator (progress bar, gauge, or equivalent).
2. THE Heat_Budget SHALL represent each walking segment as consuming a portion of the daily budget proportional to its Exposure_Score and duration.
3. THE Heat_Budget SHALL represent shaded routes, cooling stops, and shuttle alternatives as reducing consumed budget.
4. THE Heat_Budget dashboard SHALL display: remaining budget, consumed budget, highest-risk time block, recommended cooling break timing, and estimated reduction compared to default shortest-route-only planning.
5. THE Heat_Budget dashboard SHALL update when the user modifies schedule commitments or Personal_Heat_Mode preferences.
6. THE Heat_Budget dashboard SHALL be accessible via keyboard and readable by screen readers, with ARIA labels on all visual indicators.

---

### Requirement 5: Highest-Risk Segment Explanation

**User Story:** As a campus user, I want a clear explanation of my highest-risk walking segment so that I understand why it is risky and what actions I can take to reduce exposure.

#### Acceptance Criteria

1. THE App SHALL identify the Schedule_Transition with the highest Exposure_Score and display it as the highest-risk segment.
2. THE App SHALL display an explanation card for the highest-risk segment containing: the transition time window, origin and destination locations, the reason the segment is high-risk (e.g., low shade, high heat exposure, long duration), and the Risk_Level.
3. THE App SHALL display at least three recommended actions for the highest-risk segment, selected from: leave earlier, choose a shaded route, stop at a cooling point, refill water, use a shuttle, or wait for a cooler period.
4. WHEN the user has the Prefer shuttle alternatives preference enabled and the highest-risk segment is classified as "higher-risk" or "not recommended", THE App SHALL include a shuttle recommendation as the first recommended action.
5. THE highest-risk segment explanation card SHALL be accessible via keyboard and readable by screen readers.

---

### Requirement 6: Upgraded Heat Safety Logic Gate

**User Story:** As a campus user, I want the safety gate to evaluate my entire day plan so that I receive responsible risk assessments that never mislead me into thinking a route or day is safe.

#### Acceptance Criteria

1. THE Heat_Safety_Gate SHALL be extended with a `evaluateDailyHeatSafety` function that accepts a Daily_Heat_Plan and Personal_Heat_Mode preferences as inputs.
2. THE `evaluateDailyHeatSafety` function SHALL return a Daily_Safety_Evaluation containing: allowed status (boolean), Risk_Level, list of blocked segments, a human-readable explanation, and a list of recommendations.
3. THE App SHALL use the Risk_Level labels "lower-risk", "higher-risk", and "not recommended" for all route and day-level assessments. THE App SHALL NOT use the word "safe" in any user-facing label or description.
4. WHEN any Schedule_Transition has an Exposure_Score exceeding 75, THE Heat_Safety_Gate SHALL classify that transition as "not recommended" and SHALL include it in the blocked segments list.
5. WHEN all Schedule_Transitions have Exposure_Scores at or below 50, THE Heat_Safety_Gate SHALL classify the daily plan as "lower-risk".
6. WHEN at least one Schedule_Transition has an Exposure_Score between 51 and 75 and none exceed 75, THE Heat_Safety_Gate SHALL classify the daily plan as "higher-risk".
7. WHEN a transition is blocked, THE Heat_Safety_Gate SHALL recommend at least one alternative action (shuttle, cooling break, schedule adjustment) in the recommendations list.
8. THE existing single-route Heat_Safety_Gate logic SHALL continue to function for the original ShadowPath route comparison feature without modification to its behaviour.

---

### Requirement 7: Shuttle Alternative Support

**User Story:** As a campus user, I want shuttle recommendations during high-risk walking segments so that I have a viable alternative to walking in dangerous heat.

#### Acceptance Criteria

1. THE GeoJSON_Dataset SHALL be extended with Shuttle_Stop features containing: a unique identifier, name, list of nearby building identifiers, coordinates, estimated wait time in minutes, and an accessibility flag.
2. THE GeoJSON_Dataset SHALL include at least 3 Shuttle_Stop features representative of ASU Tempe campus transit stops.
3. WHEN a Schedule_Transition is classified as "higher-risk" or "not recommended", THE App SHALL identify the nearest Shuttle_Stop to the transition origin and display a Shuttle_Alternative recommendation.
4. THE Shuttle_Alternative recommendation SHALL include: shuttle stop name, estimated wait time, walking distance from transition origin to shuttle stop, and whether the shuttle stop is wheelchair-accessible.
5. WHERE the Wheelchair-accessible Personal_Heat_Mode preference is enabled, THE App SHALL only recommend Shuttle_Stops with an accessibility flag of true.

---

### Requirement 8: Water Refill and Cooling Break Recommendations

**User Story:** As a campus user, I want recommendations for water refills and cooling breaks along my route so that I can reduce heat exposure during my day.

#### Acceptance Criteria

1. WHEN computing a Schedule_Transition, THE App SHALL identify the nearest Cooling_Point along or adjacent to the route and include it in a Cooling_Recommendation.
2. THE Cooling_Recommendation SHALL include: cooling point name, estimated walking distance from the route, suggested cooling break duration in minutes, and a reason for the recommendation.
3. WHEN computing a Schedule_Transition, THE App SHALL identify the nearest Water_Refill_Point along or adjacent to the route and include it in a Water_Recommendation.
4. THE Water_Recommendation SHALL include: water refill point name and estimated walking distance from the route.
5. WHEN a Schedule_Transition has a Risk_Level of "higher-risk" or "not recommended", THE App SHALL display the Cooling_Recommendation and Water_Recommendation prominently alongside the transition details.
6. THE Cooling_Recommendation and Water_Recommendation SHALL use data from the existing GeoJSON_Dataset cooling point and water refill features.

---

### Requirement 9: Responsible Language and Methodology Updates

**User Story:** As a responsible developer, I want the app to use cautious language and transparent methodology disclosures so that users understand the limitations and do not treat the planner as medical or safety advice.

#### Acceptance Criteria

1. THE App SHALL display a prototype disclaimer on the Day_Planner page stating that the planner uses demo data and estimated calculations for educational and planning purposes only.
2. THE App SHALL display a note on the Day_Planner results page stating that all campus data is manually seeded for the hackathon and does not reflect real-time conditions.
3. THE App SHALL include an explanation of the heat exposure estimation methodology on the Methodology_Page, covering how per-segment and daily aggregate scores are calculated.
4. THE App SHALL NOT make medical claims or guarantee safety in any user-facing text. All risk language SHALL use "lower-risk", "higher-risk", or "not recommended".
5. THE App SHALL state on the Methodology_Page that the planner is intended for planning and awareness purposes and is not a substitute for official heat safety guidance.
6. THE App SHALL display Confidence_Labels on all per-transition and daily aggregate metrics.

---

### Requirement 10: Why This Matters Page (Judging Rubric Mapping)

**User Story:** As a hackathon evaluator, I want a page that maps the HeatShield Planner features to judging rubric categories so that I can quickly assess the project's value, implementation quality, and design.

#### Acceptance Criteria

1. THE App SHALL include a Why_This_Matters_Page accessible from the main navigation.
2. THE Why_This_Matters_Page SHALL contain sections mapping features to the following rubric categories: Potential Value, Implementation, and Quality & Design.
3. THE Why_This_Matters_Page SHALL explain how the full-day planner, heat budget, and shuttle alternatives address the Potential Value rubric.
4. THE Why_This_Matters_Page SHALL explain how the pure utility functions, TypeScript types, and property-based tests address the Implementation rubric.
5. THE Why_This_Matters_Page SHALL explain how responsible language, accessibility, and methodology transparency address the Quality & Design rubric.
6. THE Why_This_Matters_Page SHALL be navigable via keyboard and readable by screen readers.

---

### Requirement 11: Kiro Experiment Log

**User Story:** As a hackathon evaluator, I want an experiment log comparing three planning approaches so that I can see the iterative improvement from shortest-only to shade-aware to full-day planning.

#### Acceptance Criteria

1. THE App SHALL include an Experiment_Log section on the Kiro_Process_Page or as a standalone page accessible from the navigation.
2. THE Experiment_Log SHALL document three experiments: Experiment A (shortest route only), Experiment B (shade-aware routing), and Experiment C (full-day HeatShield Planner).
3. THE Experiment_Log SHALL compare results across the three experiments using metrics such as total sun exposure minutes, shade percentage, cooling stop usage, and daily Risk_Level.
4. THE Experiment_Log SHALL include a brief narrative for each experiment describing the approach, findings, and limitations.

---

### Requirement 12: TypeScript Type Definitions

**User Story:** As a developer, I want well-defined TypeScript types for all new data structures so that the codebase remains type-safe and self-documenting.

#### Acceptance Criteria

1. THE codebase SHALL define a `CampusCommitment` type with fields for location (string), startTime (string or Date), optional endTime, flexibility ("flexible" | "fixed"), and label (string).
2. THE codebase SHALL define a `ScheduleTransition` type with fields for origin commitment, destination commitment, route result, Segment_Risk metrics, Cooling_Recommendation, Water_Recommendation, and optional Shuttle_Alternative.
3. THE codebase SHALL define a `PersonalHeatMode` type with boolean fields for each preference option listed in Requirement 2.
4. THE codebase SHALL define a `DailyHeatPlan` type containing an array of Schedule_Transitions and full-day aggregate metrics.
5. THE codebase SHALL define a `HeatBudget` type with fields for total budget, consumed budget, remaining budget, highest-risk time block, recommended cooling break, and estimated reduction percentage.
6. THE codebase SHALL define a `RouteSegmentRisk` type with fields for walking time, sun exposure, shade percentage, cooling availability, water availability, accessibility compliance, Confidence_Label, and Risk_Level.
7. THE codebase SHALL define a `CoolingRecommendation` type with fields for cooling point name, distance from route, suggested break duration, and reason.
8. THE codebase SHALL define a `ShuttleAlternative` type with fields for shuttle stop name, estimated wait time, walking distance to stop, and accessibility flag.
9. THE codebase SHALL define a `DailySafetyEvaluation` type with fields for allowed (boolean), Risk_Level, blocked segments (array), explanation (string), and recommendations (array of strings).

---

### Requirement 13: Pure Utility Functions

**User Story:** As a developer, I want pure utility functions for all planner computations so that the logic is testable, composable, and free of side effects.

#### Acceptance Criteria

1. THE codebase SHALL implement a `createScheduleTransitions` function that accepts an array of Campus_Commitments and a Campus_Graph and returns an array of Schedule_Transitions.
2. THE codebase SHALL implement a `calculateSegmentHeatRisk` function that accepts a route result and weather data and returns a RouteSegmentRisk.
3. THE codebase SHALL implement a `calculateDailyHeatExposure` function that accepts an array of Schedule_Transitions and returns full-day aggregate metrics (total outdoor minutes, total sun exposure, average shade percentage, total cooling stops).
4. THE codebase SHALL implement a `findHighestRiskSegment` function that accepts an array of Schedule_Transitions and returns the transition with the highest Exposure_Score.
5. THE codebase SHALL implement a `recommendCoolingBreaks` function that accepts a Schedule_Transition and the Campus_Graph and returns a Cooling_Recommendation.
6. THE codebase SHALL implement a `recommendWaterStops` function that accepts a Schedule_Transition and the Campus_Graph and returns a Water_Recommendation.
7. THE codebase SHALL implement a `recommendShuttleAlternatives` function that accepts a Schedule_Transition and the Campus_Graph and returns a Shuttle_Alternative or null if no shuttle stop is nearby.
8. THE codebase SHALL implement a `calculateHeatBudget` function that accepts a Daily_Heat_Plan and returns a HeatBudget.
9. THE codebase SHALL implement an `evaluateDailyHeatSafety` function that accepts a Daily_Heat_Plan and Personal_Heat_Mode preferences and returns a Daily_Safety_Evaluation.
10. ALL utility functions listed in this requirement SHALL be pure functions with no side effects, accepting explicit inputs and returning explicit outputs.

---

### Requirement 14: Test Coverage

**User Story:** As a developer, I want comprehensive tests for all new planner logic so that I can verify correctness and prevent regressions.

#### Acceptance Criteria

1. THE test suite SHALL include tests verifying that `createScheduleTransitions` produces exactly N-1 transitions for N commitments (invariant property).
2. THE test suite SHALL include tests verifying that `calculateDailyHeatExposure` returns total outdoor minutes equal to the sum of individual transition walking times (invariant property).
3. THE test suite SHALL include tests verifying that `findHighestRiskSegment` returns the transition whose Exposure_Score is greater than or equal to all other transitions' Exposure_Scores.
4. THE test suite SHALL include tests verifying that `calculateHeatBudget` returns a consumed budget plus remaining budget equal to the total budget (invariant property).
5. THE test suite SHALL include tests verifying that `evaluateDailyHeatSafety` classifies a plan as "not recommended" when any transition Exposure_Score exceeds 75.
6. THE test suite SHALL include tests verifying that `recommendCoolingBreaks` returns a valid Cooling_Recommendation with a non-empty cooling point name and a positive suggested duration.
7. THE test suite SHALL include tests verifying that `recommendShuttleAlternatives` returns null when no Shuttle_Stop exists within a reasonable distance and returns a valid Shuttle_Alternative when one does.
8. THE test suite SHALL include tests verifying that enabling the Wheelchair-accessible Personal_Heat_Mode preference excludes inaccessible edges from all computed transitions (invariant property).
9. THE test suite SHALL be implemented using Vitest and SHALL pass without errors before the feature is considered complete.
10. THE test suite SHALL NOT break any of the existing 63 ShadowPath tests across 17 files.

---

### Requirement 15: Existing Feature Preservation

**User Story:** As an existing ShadowPath user, I want the original single-route comparison feature to continue working exactly as before so that the new planner does not break my current workflow.

#### Acceptance Criteria

1. THE App SHALL preserve the existing home page route comparison feature (origin, destination, time-of-day, accessibility mode) without modification to its behaviour or UI.
2. THE App SHALL preserve the existing map display, route result panel, text route summary, and all existing components without breaking changes.
3. THE App SHALL preserve the existing Methodology_Page and Kiro_Process_Page content, extending them with new sections rather than replacing existing content.
4. THE App SHALL preserve all existing navigation links and add new navigation entries for the Day_Planner and Why_This_Matters_Page.
5. THE existing 63 tests across 17 files SHALL continue to pass without modification after the HeatShield Planner feature is implemented.

---

### Requirement 16: Updated Demo Script

**User Story:** As a hackathon presenter, I want an updated 2-minute demo script that walks through the HeatShield Planner flow so that I can present the feature clearly to judges.

#### Acceptance Criteria

1. THE project SHALL include an updated demo script document covering the full HeatShield Planner flow in approximately 2 minutes.
2. THE demo script SHALL include steps for: loading the demo schedule, reviewing Personal_Heat_Mode settings, viewing per-transition results, viewing the Heat_Budget dashboard, reviewing the highest-risk segment explanation, and viewing shuttle/cooling recommendations.
3. THE demo script SHALL reference the Why_This_Matters_Page as a closing step to connect the demo to judging criteria.
