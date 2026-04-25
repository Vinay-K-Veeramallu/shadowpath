// Feature: heatshield-planner, Property 14
// Validates: Requirements 7.4, 7.5, 14.7

import { describe, expect } from "vitest";
import { test as testProp, fc } from "@fast-check/vitest";
import { recommendShuttleAlternatives } from "../../lib/planner/recommendShuttleAlternatives";
import type {
  ScheduleTransition,
  CampusCommitment,
  RouteSegmentRisk,
  RiskLevel,
  ShuttleStop,
  PersonalHeatMode,
} from "../../lib/planner/types";
import type { RouteResult } from "../../lib/routing/types";
import { makeRouteResult } from "../helpers/graphTestUtils";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const riskLevelArb: fc.Arbitrary<RiskLevel> = fc.constantFrom(
  "lower-risk" as const,
  "higher-risk" as const,
  "not recommended" as const,
);

const defaultPreferences: PersonalHeatMode = {
  standardWalking: true,
  lowExertion: false,
  wheelchairAccessible: false,
  asthmaSensitive: false,
  preferShadedPaths: false,
  preferWaterRefillStops: false,
  preferCoolingStops: false,
  preferShuttleAlternatives: false,
};

const preferencesArb: fc.Arbitrary<PersonalHeatMode> = fc.record({
  standardWalking: fc.boolean(),
  lowExertion: fc.boolean(),
  wheelchairAccessible: fc.boolean(),
  asthmaSensitive: fc.boolean(),
  preferShadedPaths: fc.boolean(),
  preferWaterRefillStops: fc.boolean(),
  preferCoolingStops: fc.boolean(),
  preferShuttleAlternatives: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Base coordinates near ASU campus */
const BASE_LNG = -111.93;
const BASE_LAT = 33.42;

/**
 * Build a ScheduleTransition whose route origin is at the given coordinates.
 * The origin coordinates are embedded in the first edge's geometry.
 */
function makeTransitionAtCoords(
  originLng: number,
  originLat: number,
): ScheduleTransition {
  return {
    origin: { location: "b1", startTime: "10:00", flexibility: "fixed", label: "Origin" },
    destination: { location: "b2", startTime: "11:00", flexibility: "fixed", label: "Dest" },
    routeResult: makeRouteResult({
      path: ["b1", "b2"],
      edges: [
        {
          id: "b1-b2",
          from: "b1",
          to: "b2",
          distanceMeters: 200,
          accessible: true,
          surfaceType: "asphalt",
          accessRestriction: "public",
          windCanyonFactor: 1,
          shadeLegacy: { "10": 50, "14": 30, "18": 60 },
          hasCoolingPoint: false,
          hasWaterRefill: false,
          geometry: {
            type: "LineString",
            coordinates: [
              [originLng, originLat],
              [originLng + 0.001, originLat],
            ],
          },
        },
      ],
    }),
    segmentRisk: {
      walkingTimeMinutes: 10,
      sunExposureMinutes: 6,
      shadePercentage: 40,
      coolingAvailability: 0,
      waterAvailability: 0,
      accessibilityCompliant: true,
      confidenceLabel: "High",
      riskLevel: "lower-risk",
    },
    coolingRecommendation: null,
    waterRecommendation: null,
    shuttleAlternative: null,
  };
}

/** Build a shuttle stop at a given coordinate offset from base */
function makeShuttleStop(
  id: string,
  name: string,
  lngOffset: number,
  latOffset: number,
  accessible: boolean,
  waitMinutes = 8,
): ShuttleStop {
  return {
    id,
    name,
    nearbyBuildings: ["b1"],
    coordinates: [BASE_LNG + lngOffset, BASE_LAT + latOffset],
    estimatedWaitMinutes: waitMinutes,
    accessible,
  };
}

/**
 * Approximate distance in meters between two [lng, lat] pairs.
 * Mirrors the implementation's equirectangular approximation.
 */
function approxDistance(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const avgLat = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const dx = dLng * Math.cos(avgLat) * R;
  const dy = dLat * R;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Property 14: Null when no stop within 500m; valid ShuttleAlternative when
// stop exists; accessibility filtering
// Validates: Requirements 7.4, 7.5, 14.7
// ---------------------------------------------------------------------------

describe("recommendShuttleAlternatives – P14: conditional presence", () => {
  // Generator: shuttle stop within 500m of the transition origin
  const nearbyStopArb: fc.Arbitrary<{
    transition: ScheduleTransition;
    stops: ShuttleStop[];
    preferences: PersonalHeatMode;
  }> = fc
    .record({
      // Small offsets that keep the stop within ~100m of origin
      lngOffset: fc.float({ min: Math.fround(-0.0005), max: Math.fround(0.0005), noNaN: true }),
      latOffset: fc.float({ min: Math.fround(-0.0005), max: Math.fround(0.0005), noNaN: true }),
      waitMinutes: fc.integer({ min: 1, max: 30 }),
      accessible: fc.boolean(),
    })
    .map(({ lngOffset, latOffset, waitMinutes, accessible }) => {
      const transition = makeTransitionAtCoords(BASE_LNG, BASE_LAT);
      const stop = makeShuttleStop("ss1", "Nearby Stop", lngOffset, latOffset, accessible, waitMinutes);
      return {
        transition,
        stops: [stop],
        preferences: { ...defaultPreferences },
      };
    });

  testProp.prop([nearbyStopArb], { numRuns: 100 })(
    "returns a valid ShuttleAlternative when a stop is within 500m",
    ({ transition, stops, preferences }) => {
      const result = recommendShuttleAlternatives(transition, stops, preferences);

      expect(result).not.toBeNull();
      expect(result!.shuttleStopName).toBeTruthy();
      expect(result!.shuttleStopName.length).toBeGreaterThan(0);
      expect(result!.estimatedWaitMinutes).toBeGreaterThan(0);
      expect(result!.walkingDistanceMeters).toBeGreaterThanOrEqual(0);
      expect(typeof result!.accessible).toBe("boolean");
    },
  );

  // Generator: shuttle stop far away (>500m from origin)
  const farStopArb: fc.Arbitrary<{
    transition: ScheduleTransition;
    stops: ShuttleStop[];
    preferences: PersonalHeatMode;
  }> = fc
    .record({
      // Large offsets that place the stop well beyond 500m
      lngOffset: fc.float({ min: Math.fround(0.01), max: Math.fround(0.05), noNaN: true }),
      latOffset: fc.float({ min: Math.fround(0.01), max: Math.fround(0.05), noNaN: true }),
    })
    .map(({ lngOffset, latOffset }) => {
      const transition = makeTransitionAtCoords(BASE_LNG, BASE_LAT);
      const stop = makeShuttleStop("ss1", "Far Stop", lngOffset, latOffset, true);
      return {
        transition,
        stops: [stop],
        preferences: { ...defaultPreferences },
      };
    });

  testProp.prop([farStopArb], { numRuns: 100 })(
    "returns null when no shuttle stop is within 500m",
    ({ transition, stops, preferences }) => {
      const result = recommendShuttleAlternatives(transition, stops, preferences);
      expect(result).toBeNull();
    },
  );
});

describe("recommendShuttleAlternatives – P14: accessibility filtering", () => {
  testProp.prop(
    [fc.integer({ min: 1, max: 30 })],
    { numRuns: 100 },
  )(
    "excludes inaccessible stops when wheelchairAccessible is true",
    (waitMinutes) => {
      const transition = makeTransitionAtCoords(BASE_LNG, BASE_LAT);
      // Only inaccessible stop nearby
      const inaccessibleStop = makeShuttleStop(
        "ss1", "Inaccessible Stop", 0.0001, 0.0001, false, waitMinutes,
      );
      const preferences: PersonalHeatMode = {
        ...defaultPreferences,
        wheelchairAccessible: true,
      };

      const result = recommendShuttleAlternatives(
        transition, [inaccessibleStop], preferences,
      );
      expect(result).toBeNull();
    },
  );

  testProp.prop(
    [fc.integer({ min: 1, max: 30 })],
    { numRuns: 100 },
  )(
    "includes accessible stops when wheelchairAccessible is true",
    (waitMinutes) => {
      const transition = makeTransitionAtCoords(BASE_LNG, BASE_LAT);
      const accessibleStop = makeShuttleStop(
        "ss1", "Accessible Stop", 0.0001, 0.0001, true, waitMinutes,
      );
      const preferences: PersonalHeatMode = {
        ...defaultPreferences,
        wheelchairAccessible: true,
      };

      const result = recommendShuttleAlternatives(
        transition, [accessibleStop], preferences,
      );
      expect(result).not.toBeNull();
      expect(result!.accessible).toBe(true);
    },
  );

  testProp.prop(
    [fc.boolean(), fc.integer({ min: 1, max: 30 })],
    { numRuns: 100 },
  )(
    "includes inaccessible stops when wheelchairAccessible is false",
    (stopAccessible, waitMinutes) => {
      const transition = makeTransitionAtCoords(BASE_LNG, BASE_LAT);
      const stop = makeShuttleStop(
        "ss1", "Any Stop", 0.0001, 0.0001, stopAccessible, waitMinutes,
      );
      const preferences: PersonalHeatMode = {
        ...defaultPreferences,
        wheelchairAccessible: false,
      };

      const result = recommendShuttleAlternatives(transition, [stop], preferences);
      expect(result).not.toBeNull();
      expect(result!.accessible).toBe(stopAccessible);
    },
  );

  testProp.prop(
    [fc.integer({ min: 1, max: 30 }), fc.integer({ min: 1, max: 30 })],
    { numRuns: 100 },
  )(
    "selects accessible stop over closer inaccessible stop when wheelchairAccessible is true",
    (wait1, wait2) => {
      const transition = makeTransitionAtCoords(BASE_LNG, BASE_LAT);
      // Inaccessible stop very close
      const inaccessible = makeShuttleStop(
        "ss1", "Close Inaccessible", 0.00005, 0.00005, false, wait1,
      );
      // Accessible stop slightly farther but still within 500m
      const accessible = makeShuttleStop(
        "ss2", "Far Accessible", 0.0003, 0.0003, true, wait2,
      );
      const preferences: PersonalHeatMode = {
        ...defaultPreferences,
        wheelchairAccessible: true,
      };

      const result = recommendShuttleAlternatives(
        transition, [inaccessible, accessible], preferences,
      );
      expect(result).not.toBeNull();
      expect(result!.shuttleStopName).toBe("Far Accessible");
      expect(result!.accessible).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Null cases: empty stops array or no route result
// ---------------------------------------------------------------------------

describe("recommendShuttleAlternatives – null cases", () => {
  testProp.prop([preferencesArb], { numRuns: 100 })(
    "returns null when shuttle stops array is empty",
    (preferences) => {
      const transition = makeTransitionAtCoords(BASE_LNG, BASE_LAT);
      const result = recommendShuttleAlternatives(transition, [], preferences);
      expect(result).toBeNull();
    },
  );

  testProp.prop([preferencesArb], { numRuns: 100 })(
    "returns null when transition has no routeResult",
    (preferences) => {
      const transition = makeTransitionAtCoords(BASE_LNG, BASE_LAT);
      transition.routeResult = null;
      const stop = makeShuttleStop("ss1", "Nearby Stop", 0.0001, 0.0001, true);

      const result = recommendShuttleAlternatives(transition, [stop], preferences);
      expect(result).toBeNull();
    },
  );

  testProp.prop([preferencesArb], { numRuns: 100 })(
    "returns null when route has no edges",
    (preferences) => {
      const transition = makeTransitionAtCoords(BASE_LNG, BASE_LAT);
      transition.routeResult!.edges = [];
      const stop = makeShuttleStop("ss1", "Nearby Stop", 0.0001, 0.0001, true);

      const result = recommendShuttleAlternatives(transition, [stop], preferences);
      expect(result).toBeNull();
    },
  );
});
