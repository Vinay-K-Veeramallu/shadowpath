# Requirements Document

## Introduction

Comfort-Aware Routing is a major upgrade to the ShadowPath routing engine that replaces all mock/demo data with real OpenStreetMap and weather data, introduces dynamic shadow computation from building footprints and tree canopies using solar geometry, expands the time-of-day slider from 3 static snapshots to 8 continuous 2-hour slots, and replaces the custom 0–100 exposure score with a research-backed UTCI-based thermal comfort metric incorporating multi-factor comfort inputs. The upgrade draws on published research from CoolWalks (Nature 2025), MIT Cooling Path, and CoolPath Tool (2025) to deliver scientifically grounded pedestrian thermal comfort routing for the ASU Tempe campus. All existing ShadowPath and HeatShield Planner functionality must continue to work.

---

## Glossary

- **App**: The ShadowPath / HeatShield Planner Next.js web application.
- **Route_Engine**: The pure TypeScript module that computes and scores candidate routes.
- **Campus_Graph**: The in-memory weighted graph built from campus geospatial data.
- **Overpass_API**: The OpenStreetMap Overpass API used to fetch building footprints, tree locations, walking paths, and POI data for the ASU Tempe campus area.
- **NWS_API**: The National Weather Service API (weather.gov) used to fetch real-time and forecast weather data.
- **SunCalc**: A JavaScript library that computes solar position (azimuth, altitude) for any datetime and geographic coordinate.
- **Shadow_Engine**: The module that computes building and tree canopy shadow polygons dynamically using solar geometry, building footprint polygons, building heights, tree locations, canopy radii, and canopy density.
- **Building_Footprint**: A GeoJSON Polygon representing the ground-level outline of a building, sourced from OpenStreetMap.
- **Tree_Canopy**: A circular or polygonal representation of a tree's shade-casting crown, defined by location, height, canopy radius, and canopy density.
- **Shade_Fraction**: A value between 0 and 1 representing the proportion of a path edge that is covered by shadow (building shadow, tree canopy shadow, or both) at a given time.
- **UTCI**: Universal Thermal Climate Index — a research-backed thermal comfort metric that combines air temperature, mean radiant temperature, wind speed, and humidity into a single value in degrees Celsius.
- **MRT**: Mean Radiant Temperature — the weighted average temperature of all surfaces and radiation sources surrounding a pedestrian, influenced by shade, surface albedo, and solar radiation.
- **Surface_Type**: The material classification of a path segment (asphalt, grass, covered_walkway, indoor) affecting surface albedo and radiant heat contribution.
- **Wind_Canyon_Effect**: The modification of wind speed along a path segment caused by adjacent tall buildings creating street canyon aerodynamics.
- **Cooling_Zone**: A location providing active cooling (air-conditioned building entrance, misting station) that reduces thermal stress when visited.
- **Data_Pipeline**: The module that fetches, transforms, and caches real geospatial data from the Overpass_API into the campus GeoJSON format.
- **Time_Slot**: One of 8 two-hour intervals (6 AM, 8 AM, 10 AM, 12 PM, 2 PM, 4 PM, 6 PM, 8 PM) for which shadow and comfort values are computed.
- **Exposure_Score**: The legacy 0–100 custom score, replaced by UTCI-based comfort scoring in this upgrade.
- **Comfort_Score**: The UTCI-based thermal comfort value (in °C) assigned to each route, replacing the legacy Exposure_Score.
- **Access_Restriction**: A classification on path edges indicating who may use the path (public, student_only, staff_only).
- **Shade_Slider**: The UI control that lets users select a Time_Slot to view shadow coverage and route recommendations for that time.

---

## Requirements

### Requirement 1: Real Building Data from OpenStreetMap

**User Story:** As a developer, I want to fetch real building footprints, heights, and names from OpenStreetMap so that shadow computation uses actual building geometry instead of hand-seeded point data.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL fetch building features from the Overpass_API for the ASU Tempe campus bounding box (approximately 33.41°N to 33.43°N, -111.94°W to -111.92°W).
2. WHEN fetching building data, THE Data_Pipeline SHALL retrieve building footprint polygons, building height values (from the `height` or `building:levels` OSM tags), and building name values (from the `name` OSM tag).
3. THE Data_Pipeline SHALL represent each building as a GeoJSON Feature with a Polygon geometry (Building_Footprint) instead of a Point geometry.
4. IF a building lacks an explicit height tag, THEN THE Data_Pipeline SHALL estimate height using the `building:levels` tag multiplied by 3.5 meters per level, defaulting to 10 meters when neither tag is present.
5. THE Data_Pipeline SHALL produce a campus GeoJSON file containing at minimum 20 named buildings with polygon footprints for the ASU Tempe campus.
6. THE Data_Pipeline SHALL include a `heightMeters` numeric property on each building feature.

---

### Requirement 2: Real Tree and Canopy Data from OpenStreetMap

**User Story:** As a developer, I want to fetch real tree locations and canopy dimensions from OpenStreetMap so that tree shadow computation uses actual vegetation data.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL fetch tree features from the Overpass_API for the ASU Tempe campus bounding box, querying nodes tagged with `natural=tree`.
2. WHEN fetching tree data, THE Data_Pipeline SHALL retrieve tree location coordinates, species (from the `species` or `genus` OSM tag), and canopy diameter (from the `diameter_crown` tag).
3. IF a tree lacks a `diameter_crown` tag, THEN THE Data_Pipeline SHALL assign a default canopy radius of 4 meters.
4. THE Data_Pipeline SHALL assign a default tree height of 8 meters when no height tag is present.
5. THE Data_Pipeline SHALL assign a canopy density value between 0 and 1 based on species type, defaulting to 0.7 for unclassified trees.
6. THE Data_Pipeline SHALL represent each tree as a GeoJSON Feature with a Point geometry and properties including `heightMeters`, `canopyRadiusMeters`, `canopyDensity`, and `species`.

---

### Requirement 3: Real Walking Path Data from OpenStreetMap

**User Story:** As a developer, I want to fetch real walking path geometries from OpenStreetMap so that the routing graph reflects actual campus walkways.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL fetch pedestrian path features from the Overpass_API for the ASU Tempe campus bounding box, querying ways tagged with `highway=footway`, `highway=path`, `highway=pedestrian`, or `highway=steps`.
2. THE Data_Pipeline SHALL represent each path as a GeoJSON Feature with a LineString geometry and compute `distanceMeters` from the actual coordinate geometry using geodesic distance calculation.
3. THE Data_Pipeline SHALL assign a `surfaceType` property to each path edge based on the OSM `surface` tag, mapping to one of: `asphalt`, `grass`, `concrete`, `paving_stones`, `covered_walkway`, or `unknown`.
4. THE Data_Pipeline SHALL assign an `accessible` boolean property to each path edge, setting it to false for paths tagged with `highway=steps` or `wheelchair=no`.
5. THE Data_Pipeline SHALL generate graph node features at path intersections and at building/POI connection points, linking the path network into a connected graph.
6. THE Data_Pipeline SHALL produce a walking path network containing at minimum 50 path edges for the ASU Tempe campus.

---

### Requirement 4: Real POI Data from OpenStreetMap

**User Story:** As a developer, I want to fetch real cooling points, water fountains, shade structures, and shuttle stops from OpenStreetMap so that routing recommendations use actual campus amenity locations.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL fetch water fountain locations from the Overpass_API using the `amenity=drinking_water` tag and represent each as a `water_refill` node feature.
2. THE Data_Pipeline SHALL fetch shade structure locations from the Overpass_API using tags such as `amenity=shelter`, `covered=yes`, or `building=roof` and represent each as metadata on nearby path edges.
3. THE Data_Pipeline SHALL fetch public transit stop locations from the Overpass_API using the `highway=bus_stop` or `public_transport=platform` tags and represent each as a `shuttle_stop` node feature.
4. THE Data_Pipeline SHALL identify cooling zone locations by querying buildings tagged with `amenity=university`, `building=university`, or `air_conditioning=yes` and represent each as a `cooling_point` node feature at the building entrance.
5. IF the Overpass_API returns fewer than 3 features for any POI category, THEN THE Data_Pipeline SHALL log a warning and supplement with manually curated fallback data for that category.
6. THE Data_Pipeline SHALL assign an `accessible` boolean property to each POI feature based on available OSM accessibility tags.

---

### Requirement 5: Data Pipeline Caching and Regeneration

**User Story:** As a developer, I want the data pipeline to cache fetched data and support regeneration so that the app does not make redundant API calls and can be rebuilt from fresh data when needed.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL write the generated campus GeoJSON file to `data/campus.geojson`, replacing the existing hand-seeded file.
2. THE Data_Pipeline SHALL be executable as a standalone Node.js script (e.g., `npm run generate-data`) that fetches from the Overpass_API and NWS_API and writes the output file.
3. WHEN the generated `data/campus.geojson` file already exists and is less than 24 hours old, THE Data_Pipeline SHALL skip Overpass_API fetches and reuse the cached file unless a `--force` flag is provided.
4. THE Data_Pipeline SHALL validate the generated GeoJSON against the Campus_Graph schema before writing, ensuring all node references in edges are valid.
5. IF the Overpass_API is unreachable, THEN THE Data_Pipeline SHALL fall back to the most recently cached `data/campus.geojson` file and log a warning.

---

### Requirement 6: Dynamic Building Shadow Computation

**User Story:** As a campus user, I want building shadows to be computed dynamically based on actual solar position so that shade information is accurate for any time of day, not just pre-baked snapshots.

#### Acceptance Criteria

1. THE Shadow_Engine SHALL compute the solar azimuth and altitude for a given datetime and the ASU Tempe campus coordinates (33.4255°N, 111.9400°W) using the SunCalc library.
2. WHEN computing building shadows, THE Shadow_Engine SHALL project each Building_Footprint polygon into a shadow polygon based on the building height and the solar azimuth and altitude at the requested time.
3. THE Shadow_Engine SHALL compute the Shade_Fraction for each path edge by calculating the geometric intersection of the path edge geometry with all building shadow polygons, dividing the shaded length by the total edge length.
4. WHEN the solar altitude is at or below 0 degrees (nighttime or twilight), THE Shadow_Engine SHALL assign a Shade_Fraction of 1.0 to all path edges.
5. THE Shadow_Engine SHALL compute shadows for any arbitrary datetime, not limited to predefined time slots.
6. THE Shadow_Engine SHALL complete shadow computation for the full campus path network within 3 seconds on a modern desktop machine.

---

### Requirement 7: Dynamic Tree Canopy Shadow Computation

**User Story:** As a campus user, I want tree canopy shadows to be included in shade calculations so that routes through tree-lined paths are properly credited for their shade coverage.

#### Acceptance Criteria

1. THE Shadow_Engine SHALL compute a circular shadow projection for each Tree_Canopy based on the tree height, canopy radius, and the solar azimuth and altitude at the requested time.
2. THE Shadow_Engine SHALL scale the effective shade contribution of each tree shadow by the tree's canopy density value (0 to 1), where a density of 1.0 provides full shade and 0.0 provides no shade.
3. THE Shadow_Engine SHALL combine building shadow polygons and tree canopy shadow circles into a unified shade layer, avoiding double-counting where building and tree shadows overlap on the same path segment.
4. THE Shadow_Engine SHALL add the tree canopy shade contribution to the per-edge Shade_Fraction computed from building shadows.
5. WHEN a path edge passes through multiple tree canopy shadows, THE Shadow_Engine SHALL compute the cumulative shaded length accounting for overlapping canopies.

---

### Requirement 8: Continuous Time Slot Shade Slider

**User Story:** As a campus user, I want to select from 8 two-hour time slots throughout the day so that I can plan my walk for any part of the day, not just 3 fixed times.

#### Acceptance Criteria

1. THE Shade_Slider SHALL provide 8 selectable Time_Slots: 6 AM, 8 AM, 10 AM, 12 PM, 2 PM, 4 PM, 6 PM, and 8 PM.
2. WHEN the user selects a Time_Slot, THE Shadow_Engine SHALL compute shadow polygons and Shade_Fractions dynamically for that time using solar geometry, not pre-stored values.
3. WHEN the user selects a Time_Slot, THE Route_Engine SHALL recompute all candidate routes and comfort scores using the dynamically computed Shade_Fractions for the selected time.
4. WHEN the Shade_Slider position changes, THE App SHALL update the map display and result panel within 2 seconds without a full page reload.
5. THE Shade_Slider SHALL be operable via keyboard arrow keys in addition to pointer input.
6. THE Shade_Slider SHALL display the currently selected time as a human-readable label (e.g., "2 PM").
7. THE App SHALL maintain backward compatibility by mapping the legacy time keys ("10", "14", "18") to the corresponding new Time_Slots for any code that references the old format.

---

### Requirement 9: Multi-Factor Comfort-Aware Edge Scoring

**User Story:** As a campus user, I want each path segment scored using multiple thermal comfort factors so that the routing engine accounts for shade, wind, surface material, and indoor paths — not just shade percentage alone.

#### Acceptance Criteria

1. THE Route_Engine SHALL compute a per-edge UTCI value incorporating: air temperature, mean radiant temperature (derived from Shade_Fraction and surface albedo), wind speed (modified by Wind_Canyon_Effect), and relative humidity.
2. THE Route_Engine SHALL compute the Wind_Canyon_Effect for each path edge based on the ratio of adjacent building heights to street width, reducing effective wind speed in narrow canyons and increasing it in open areas.
3. THE Route_Engine SHALL assign a surface albedo value to each path edge based on its Surface_Type: asphalt (0.1), concrete (0.3), grass (0.25), paving_stones (0.2), covered_walkway (0.4), indoor (0.0).
4. THE Route_Engine SHALL apply a MRT reduction for covered walkway and indoor path segments, reflecting reduced solar radiation exposure.
5. THE Route_Engine SHALL incorporate the Surface_Type into the MRT calculation, where higher albedo surfaces contribute less to radiant heat load.
6. WHEN computing the comfort-aware route, THE Route_Engine SHALL use the per-edge UTCI value as the primary cost factor, weighted by edge distance.

---

### Requirement 10: Indoor Through-Building Path Support

**User Story:** As a campus user, I want the routing engine to consider paths through air-conditioned buildings so that I can reduce heat exposure by cutting through buildings when possible.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL identify indoor path segments by detecting OSM paths that pass through building footprint polygons or are tagged with `indoor=yes` or `tunnel=building_passage`.
2. THE Route_Engine SHALL assign indoor path edges a fixed comfortable UTCI value (approximately 22°C) regardless of outdoor weather conditions.
3. THE Route_Engine SHALL apply a configurable indoor preference bonus in the comfort-aware cost function, making indoor paths more attractive during high-heat conditions.
4. THE App SHALL visually distinguish indoor path segments on the map using a distinct line style (e.g., dashed line or different color).
5. THE Route_Engine SHALL track total indoor distance per route and include `indoorMeters` in the route result.

---

### Requirement 11: Access Restriction Support

**User Story:** As a campus user, I want the routing engine to respect path access restrictions so that routes only include paths I am allowed to use.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL assign an Access_Restriction value to each path edge based on OSM `access` tags, classifying paths as `public`, `student_only`, or `staff_only`.
2. THE Route_Engine SHALL accept a user access level parameter (public, student, staff) and exclude path edges whose Access_Restriction exceeds the user's access level.
3. WHEN the user access level is `public`, THE Route_Engine SHALL exclude edges with Access_Restriction of `student_only` or `staff_only`.
4. WHEN the user access level is `student`, THE Route_Engine SHALL exclude edges with Access_Restriction of `staff_only`.
5. THE App SHALL default the user access level to `student` and provide a selector to change it.

---

### Requirement 12: UTCI-Based Comfort Score Replacement

**User Story:** As a campus user, I want route scores based on the UTCI thermal comfort index so that the displayed comfort metric reflects actual thermal stress rather than an arbitrary weighted average.

#### Acceptance Criteria

1. THE Route_Engine SHALL compute a distance-weighted average UTCI value (in °C) for each candidate route, replacing the legacy Exposure_Score as the primary comfort metric.
2. THE Route_Engine SHALL compute the route-level UTCI by averaging per-edge UTCI values weighted by edge distance in meters.
3. THE App SHALL display the route Comfort_Score as a UTCI value in degrees Celsius alongside a human-readable stress category label (No thermal stress, Moderate heat stress, Strong heat stress, Very strong heat stress, Extreme heat stress).
4. THE App SHALL display a UTCI stress color indicator using the standard UTCI color scale: green (no stress, < 26°C), yellow (moderate, 26–32°C), orange (strong, 32–38°C), red (very strong, 38–46°C), dark red (extreme, ≥ 46°C).
5. THE Heat_Safety_Gate SHALL use UTCI thresholds instead of the legacy Exposure_Score threshold: routes with average UTCI ≥ 38°C SHALL be classified as "not recommended", routes with UTCI between 32°C and 38°C as "higher-risk", and routes with UTCI < 32°C as "lower-risk".
6. THE Route_Engine SHALL continue to compute the legacy Exposure_Score for backward compatibility with the HeatShield Planner, but the UTCI Comfort_Score SHALL be the primary displayed metric.

---

### Requirement 13: Cooling Zone and Water Station Integration

**User Story:** As a campus user, I want the routing engine to factor in cooling zones and water refill stations so that comfort-aware routes prefer paths near these amenities during high-heat conditions.

#### Acceptance Criteria

1. WHEN computing the comfort-aware route, THE Route_Engine SHALL apply a cost reduction to edges adjacent to or passing through Cooling_Zones, proportional to the cooling benefit.
2. WHEN computing the comfort-aware route, THE Route_Engine SHALL apply a minor cost reduction to edges adjacent to Water_Refill_Points.
3. THE App SHALL display cooling zone and water station locations as distinct icons on the map.
4. THE Route_Engine SHALL include counts of cooling zones and water stations along each route in the route result.

---

### Requirement 14: Real-Time Weather Integration Enhancement

**User Story:** As a campus user, I want the app to use real-time weather data for all comfort factors so that UTCI computation reflects current conditions, not just temperature.

#### Acceptance Criteria

1. THE NWS_API client SHALL fetch air temperature, relative humidity, wind speed, and wind direction for the selected Time_Slot.
2. THE NWS_API client SHALL provide weather data for all 8 Time_Slots, not just the legacy 3 time snapshots.
3. WHEN live NWS_API data is available, THE Route_Engine SHALL use the fetched air temperature, humidity, and wind speed as inputs to the per-edge UTCI computation.
4. IF the NWS_API is unreachable, THEN THE Route_Engine SHALL use fallback weather values (temperature 42°C, humidity 18%, wind 2.2 m/s) and attach a Confidence_Label of "Low".
5. THE App SHALL display the weather data source and confidence level alongside route results.

---

### Requirement 15: Graph and Type System Upgrade

**User Story:** As a developer, I want the graph data model and TypeScript types updated to support polygon footprints, dynamic shade, surface types, access restrictions, and UTCI scoring so that the codebase is type-safe for the new feature set.

#### Acceptance Criteria

1. THE `GraphNode` type SHALL be extended with optional fields: `footprintPolygon` (GeoJSON Polygon), `heightMeters` (number), `canopyRadiusMeters` (number), `canopyDensity` (number), and `species` (string).
2. THE `GraphEdge` type SHALL be extended with fields: `surfaceType` (string enum), `accessRestriction` (string enum), and `windCanyonFactor` (number between 0 and 2).
3. THE `GraphEdge` type SHALL replace the static `shade` record (`Record<"10"|"14"|"18", number>`) with a `computeShade(datetime: Date): number` method or equivalent dynamic shade lookup.
4. THE `RouteResult` type SHALL include `averageUtciC` (number), `utciStress` (UtciStress category), `utciStressLabel` (string), and `indoorMeters` (number) as required fields instead of optional fields.
5. THE `RouteParams` type SHALL be extended with `accessLevel` (string enum: "public" | "student" | "staff") and `timeSlot` (number representing hour: 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20).
6. THE `buildGraph` function SHALL be updated to parse polygon geometries for buildings, tree canopy properties, surface types, and access restrictions from the new GeoJSON format.

---

### Requirement 16: Backward Compatibility and Existing Feature Preservation

**User Story:** As an existing ShadowPath user, I want all existing features to continue working after the upgrade so that the comfort-aware routing enhancement does not break my current workflow.

#### Acceptance Criteria

1. THE App SHALL preserve the existing home page route comparison feature (origin, destination, time-of-day, accessibility mode) without removing any existing functionality.
2. THE App SHALL preserve the HeatShield Planner add-on functionality, including day planner, heat budget dashboard, and all planner computations.
3. THE Route_Engine SHALL continue to produce `shortest`, `shade-aware`, `cooling-stop`, and `comfort-aware` route types.
4. WHEN the legacy 3-slot time values (10, 14, 18) are used by existing code, THE Route_Engine SHALL map them to the corresponding new Time_Slots and compute dynamic shade values for those times.
5. THE App SHALL continue to compute and include the legacy Exposure_Score in route results for backward compatibility with the HeatShield Planner.
6. ALL existing tests SHALL continue to pass after the upgrade, with test updates limited to accommodating the expanded time slot type and new required fields on route results.

---

### Requirement 17: Shadow and UTCI Computation Tests

**User Story:** As a developer, I want comprehensive tests for the shadow engine and UTCI computation so that I can verify correctness of the dynamic shadow and thermal comfort calculations.

#### Acceptance Criteria

1. THE test suite SHALL include a property test verifying that for all valid solar altitudes above 0°, building shadow length increases as solar altitude decreases (metamorphic property).
2. THE test suite SHALL include a property test verifying that the Shade_Fraction for any path edge is always in the range [0, 1] for all valid inputs (invariant property).
3. THE test suite SHALL include a property test verifying that when solar altitude is at or below 0°, the Shade_Fraction for all path edges equals 1.0 (boundary condition).
4. THE test suite SHALL include a property test verifying that the UTCI value increases monotonically as air temperature increases, holding all other inputs constant (metamorphic property).
5. THE test suite SHALL include a property test verifying that the UTCI value for an indoor edge is always less than the UTCI value for an equivalent outdoor fully sun-exposed edge when outdoor temperature exceeds 30°C (metamorphic property).
6. THE test suite SHALL include a property test verifying that combining building and tree shadows never produces a Shade_Fraction greater than 1.0 for any path edge (invariant property).
7. THE test suite SHALL include a round-trip property test verifying that generating campus GeoJSON from the Data_Pipeline and parsing it back through `buildGraph` produces a valid Campus_Graph with consistent node and edge counts.
8. THE test suite SHALL be implemented using Vitest with fast-check and SHALL pass without errors before the feature is considered complete.

