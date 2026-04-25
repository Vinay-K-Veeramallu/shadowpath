# Requirements Document

## Introduction

ShadowPath is a mobile-first campus routing web application built for the Kiro Spark Challenge (Environment Accountability Guardrail). The app helps ASU students, staff, and visitors navigate the Tempe campus more safely during extreme heat by comparing a fastest route against shade-aware and cooling-stop routes. ShadowPath connects the macro problem of climate resilience to the micro-action of choosing a walking path, surfacing a heat exposure score, a Heat Safety Logic Gate, and a time-travel shade slider so users can make informed, safety-conscious decisions before they step outside.

---

## Glossary

- **App**: The ShadowPath Next.js web application.
- **Route_Engine**: The pure TypeScript module that computes and scores candidate routes.
- **Heat_Safety_Gate**: The logic component that evaluates predicted heat exposure and determines whether a route may be labeled safe.
- **Exposure_Score**: A numeric value (0–100) representing predicted heat exposure for a given route, derived from walking duration, shade percentage, heat index, cooling stop availability, and accessibility constraints.
- **Shade_Slider**: The UI control that lets users select a time-of-day snapshot (10 AM, 2 PM, or 6 PM) to compare how shade coverage changes across the day.
- **Campus_Graph**: The in-memory weighted graph built from the preloaded Tempe campus GeoJSON dataset.
- **GeoJSON_Dataset**: The local static dataset containing buildings, walking path edges, cooling points, water refill points, shade structures, and accessibility flags for the ASU Tempe campus.
- **Cooling_Point**: A campus location (e.g., air-conditioned building entrance, misting station) that reduces heat exposure when included in a route.
- **Water_Refill_Point**: A campus location with a water fountain or bottle-fill station.
- **Shade_Structure**: A physical structure (tree canopy, pergola, covered walkway) that provides shade coverage along a path segment.
- **Accessibility_Flag**: A boolean attribute on a path edge or node indicating wheelchair/mobility-device compatibility.
- **Confidence_Label**: A categorical indicator (High / Medium / Low) expressing the reliability of a route's Exposure_Score given data completeness and forecast availability.
- **Methodology_Page**: A dedicated app page explaining how estimates are generated, listing data limitations, and documenting responsible design decisions.
- **Kiro_Process_Page**: A dedicated app page displaying the project's requirements, design, tasks, tests, and experiment log.
- **Weather_API**: The National Weather Service API (weather.gov) used to fetch current or forecast temperature and heat index data.
- **Overpass_API**: The OpenStreetMap Overpass API referenced as a supplementary data source for campus path geometry.

---

## Requirements

### Requirement 1: Route Input and Selection

**User Story:** As an ASU campus user, I want to enter an origin, destination, time of day, and accessibility mode so that the app can compute routes tailored to my current situation.

#### Acceptance Criteria

1. THE App SHALL provide an input form with fields for origin, destination, time of day, and accessibility mode.
2. WHEN a user submits the route form with all required fields populated, THE Route_Engine SHALL compute candidate routes and return results within 2 seconds on a modern mobile device.
3. IF a user submits the route form with one or more required fields empty, THEN THE App SHALL display an inline validation error identifying each missing field and SHALL NOT invoke the Route_Engine.
4. THE App SHALL support keyboard navigation for all form fields and controls, meeting WCAG 2.1 AA focus management requirements.
5. WHERE accessibility mode is enabled, THE Route_Engine SHALL exclude path edges whose Accessibility_Flag is false from all candidate routes.
6. THE App SHALL provide at least three time-of-day options: 10 AM, 2 PM, and 6 PM, selectable via the Shade_Slider.

---

### Requirement 2: Preloaded Campus Dataset

**User Story:** As a developer, I want a preloaded GeoJSON dataset for the ASU Tempe campus so that the app functions fully offline without requiring live map API calls.

#### Acceptance Criteria

1. THE GeoJSON_Dataset SHALL include features for buildings, walking path edges, cooling points, water refill points, shade structures, and accessibility flags.
2. THE App SHALL load the GeoJSON_Dataset from local static files at application startup without making external network requests to map tile servers.
3. WHEN the GeoJSON_Dataset is loaded, THE Route_Engine SHALL construct the Campus_Graph in memory before processing any route request.
4. IF the GeoJSON_Dataset file is missing or malformed, THEN THE App SHALL display a clear error message stating that campus data is unavailable and SHALL NOT attempt to compute routes.
5. THE GeoJSON_Dataset SHALL include at minimum 10 named buildings, 5 cooling points, 5 water refill points, and 3 shade structures representative of the ASU Tempe campus.

---

### Requirement 3: Multi-Route Computation

**User Story:** As a campus user, I want to see a shortest route, a shade-aware route, and a cooling-stop route side by side so that I can choose the option that best balances speed and safety.

#### Acceptance Criteria

1. WHEN a route request is submitted, THE Route_Engine SHALL compute a shortest route, a shade-aware route, and a cooling-stop route for the given origin–destination pair.
2. THE Route_Engine SHALL compute the shortest route by minimising total walking distance in meters.
3. THE Route_Engine SHALL compute the shade-aware route by maximising cumulative shade coverage percentage across path edges, using the shade data corresponding to the selected time-of-day snapshot.
4. THE Route_Engine SHALL compute the cooling-stop route by maximising the number of Cooling_Points visited while keeping total walking distance within 150% of the shortest route distance.
5. WHEN two or more route types produce identical paths, THE App SHALL display them as a single result with a label indicating which route types it satisfies.
6. THE Route_Engine SHALL assign an Exposure_Score to each computed route before returning results.

---

### Requirement 4: Heat Exposure Score

**User Story:** As a campus user, I want a heat exposure score for each route so that I can understand the relative safety of my options before I start walking.

#### Acceptance Criteria

1. THE Route_Engine SHALL compute an Exposure_Score between 0 and 100 for each candidate route, where 0 represents minimal heat exposure and 100 represents maximum heat exposure.
2. THE Route_Engine SHALL incorporate walking duration (in minutes), shade percentage (0–100), heat index (°F), cooling stop count, and accessibility constraint status as inputs to the Exposure_Score formula.
3. WHEN live Weather_API data is unavailable, THE Route_Engine SHALL use a demo heat index value drawn from the GeoJSON_Dataset and SHALL attach a Confidence_Label of "Low" to the affected route scores.
4. WHEN live Weather_API data is available, THE Route_Engine SHALL use the forecast heat index for the selected time-of-day snapshot and SHALL attach a Confidence_Label of "High" or "Medium" based on forecast confidence.
5. THE App SHALL display the Exposure_Score alongside a Confidence_Label for each route result.
6. FOR ALL valid route inputs, the Exposure_Score computed for the shade-aware route SHALL be less than or equal to the Exposure_Score computed for the shortest route when shade coverage on the shade-aware route exceeds that of the shortest route (metamorphic property).

---

### Requirement 5: Heat Safety Logic Gate

**User Story:** As a campus user, I want the app to warn me when predicted heat exposure is dangerously high so that I am never misled into believing an unsafe route is safe.

#### Acceptance Criteria

1. THE Heat_Safety_Gate SHALL evaluate the Exposure_Score of each candidate route before the App displays results.
2. WHEN a route's Exposure_Score exceeds 75, THE Heat_Safety_Gate SHALL mark that route as unsafe and THE App SHALL display a prominent warning label stating the route is not recommended.
3. WHEN all candidate routes are marked unsafe, THE App SHALL recommend waiting, taking a campus shuttle, or visiting the nearest Cooling_Point, and SHALL NOT label any route as safe.
4. IF a route is marked unsafe by the Heat_Safety_Gate, THEN THE App SHALL NOT display a "safe" label or any equivalent positive safety indicator for that route.
5. THE App SHALL display the Heat_Safety_Gate outcome for every route result, regardless of whether the route is marked safe or unsafe.
6. THE Heat_Safety_Gate SHALL apply the same threshold logic consistently across all three route types (shortest, shade-aware, cooling-stop).

---

### Requirement 6: Time-Travel Shade Slider

**User Story:** As a campus user, I want to compare how shade coverage and route recommendations change at different times of day so that I can plan my walk for the coolest window.

#### Acceptance Criteria

1. THE App SHALL render the Shade_Slider as an accessible UI control with labeled positions for 10 AM, 2 PM, and 6 PM.
2. WHEN the user moves the Shade_Slider to a new time-of-day position, THE Route_Engine SHALL recompute all candidate routes and Exposure_Scores using the shade data for the selected time snapshot.
3. WHEN the Shade_Slider position changes, THE App SHALL update the map display and result panel within 1 second without a full page reload.
4. THE GeoJSON_Dataset SHALL include distinct shade coverage values per path edge for each of the three time-of-day snapshots (10 AM, 2 PM, 6 PM).
5. THE App SHALL visually differentiate shaded path segments from unshaded segments on the map for the currently selected time snapshot.
6. THE Shade_Slider SHALL be operable via keyboard arrow keys in addition to pointer input.

---

### Requirement 7: Result Explanation Panel

**User Story:** As a campus user, I want a clear explanation of each route result so that I understand what the numbers mean and can trust the recommendations.

#### Acceptance Criteria

1. THE App SHALL display a result explanation panel for each computed route containing: shade percentage, sun exposure minutes, Exposure_Score, Confidence_Label, data sources used, and key assumptions.
2. THE App SHALL display sun exposure minutes as a whole number rounded to the nearest minute.
3. WHEN the Confidence_Label is "Low", THE App SHALL display an explanatory note stating that live weather data was unavailable and a demo heat index was used.
4. THE App SHALL list at least one data source and at least one assumption in the result explanation panel for every route result.
5. THE App SHALL render the result explanation panel in a manner that is readable by screen readers, with appropriate ARIA labels on all dynamic content regions.

---

### Requirement 8: Methodology Page

**User Story:** As a responsible user or evaluator, I want a methodology page that explains how the app generates its estimates so that I can assess the reliability of the recommendations.

#### Acceptance Criteria

1. THE App SHALL include a Methodology_Page accessible from the main navigation.
2. THE Methodology_Page SHALL explain the Exposure_Score formula, including each input variable and its weight or contribution.
3. THE Methodology_Page SHALL list all known data limitations, including the use of manually seeded hackathon data and the absence of real-time shade sensor data.
4. THE Methodology_Page SHALL document at least three responsible design decisions, including the Heat_Safety_Gate threshold rationale and the Confidence_Label system.
5. THE Methodology_Page SHALL be navigable via keyboard and readable by screen readers.

---

### Requirement 9: Kiro Process Page

**User Story:** As a hackathon evaluator, I want a Kiro Process page that shows the full development process so that I can verify the app was built using the Kiro spec-driven workflow.

#### Acceptance Criteria

1. THE App SHALL include a Kiro_Process_Page accessible from the main navigation.
2. THE Kiro_Process_Page SHALL display the contents of or links to the requirements document, design document, task list, test plan, and experiment log.
3. THE Kiro_Process_Page SHALL be navigable via keyboard and readable by screen readers.

---

### Requirement 10: Accessibility and High Contrast Mode

**User Story:** As a user with visual or mobility impairments, I want the app to support high contrast mode and full keyboard navigation so that I can use it safely and independently.

#### Acceptance Criteria

1. THE App SHALL provide a high contrast mode toggle accessible from the main navigation or settings area.
2. WHEN high contrast mode is active, THE App SHALL apply a colour scheme with a minimum contrast ratio of 7:1 for all text and interactive elements against their backgrounds.
3. THE App SHALL ensure all interactive elements are reachable and operable via keyboard Tab and Enter/Space keys.
4. THE App SHALL provide visible focus indicators on all interactive elements that meet WCAG 2.1 AA minimum focus visibility requirements.
5. WHERE the App displays map content, THE App SHALL provide a non-map text summary of route results so that users who cannot perceive the map can still access route information.

---

### Requirement 11: Route Scoring Unit Tests

**User Story:** As a developer, I want comprehensive unit tests for the Route_Engine and Heat_Safety_Gate so that I can verify correctness and prevent regressions.

#### Acceptance Criteria

1. THE Route_Engine test suite SHALL include tests that verify the Exposure_Score for a fully shaded route is less than or equal to the Exposure_Score for an equivalent unshaded route under identical heat index conditions (invariant property).
2. THE Route_Engine test suite SHALL include a round-trip property test verifying that serialising a Campus_Graph to JSON and deserialising it produces a graph with identical node count, edge count, and edge weights.
3. THE Heat_Safety_Gate test suite SHALL include tests covering: Exposure_Score below threshold (safe), Exposure_Score equal to threshold (boundary), and Exposure_Score above threshold (unsafe).
4. THE Route_Engine test suite SHALL include tests verifying that enabling accessibility mode excludes all edges with Accessibility_Flag false from computed routes.
5. THE Route_Engine test suite SHALL be implemented using Vitest and SHALL pass without errors before the feature is considered complete.
6. WHEN the Exposure_Score formula inputs are held constant and only the shade percentage is varied from 0% to 100%, THE Route_Engine SHALL produce monotonically non-increasing Exposure_Scores (metamorphic property).
