// Feature: heatshield-planner, Property 3: Total outdoor minutes = sum of individual walking times
// Validates: Requirements 3.3, 14.2

import { describe, expect } from "vitest";
import { test as testProp, fc } from "@fast-check/vitest";
import { calculateDailyHeatExposure } from "../../lib/planner/calculateDailyHeatExposure";
import type {
  ScheduleTransition,
  CampusCommitment,
  RouteSegmentRisk,
  RiskLevel,
} from "../../lib/planner/types";
import type { RouteResult } from "../../lib/routing/types";
import { makeRouteResult } from "../helpers/graphTestUtils";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a valid RiskLevel */
const riskLevelArb: fc.Arbitrary<RiskLevel> = fc.constantFrom(
  "lower-risk" as const,
  "higher-risk" as const,
  "not recommended" as const
);

/** Generate a RouteSegmentRisk with an arbitrary walkingTimeMinutes */
const segmentRiskArb: fc.Arbitrary<RouteSegmentRisk> = fc
  .record({
    walkingTimeMinutes: fc.float({ min: 0, max: 120, noNaN: true }),
    sunExposureMinutes: fc.float({ min: 0, max: 120, noNaN: true }),
    shadePercentage: fc.float({ min: 0, max: 100, noNaN: true }),
    coolingAvailability: fc.integer({ min: 0, max: 10 }),
    waterAvailability: fc.integer({ min: 0, max: 10 }),
    accessibilityCompliant: fc.boolean(),
    confidenceLabel: fc.constantFrom(
      "High" as const,
      "Medium" as const,
      "Low" as const
    ),
    riskLevel: riskLevelArb,
  })
  .map((r) => r as RouteSegmentRisk);

/** Generate a minimal CampusCommitment */
const commitmentArb: fc.Arbitrary<CampusCommitment> = fc
  .record({
    location: fc.constantFrom("b1", "b2", "b3", "b4", "b5"),
    startTime: fc
      .record({
        hour: fc.integer({ min: 6, max: 20 }),
        minute: fc.integer({ min: 0, max: 59 }),
      })
      .map(
        ({ hour, minute }) =>
          `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      ),
    flexibility: fc.constantFrom("flexible" as const, "fixed" as const),
    label: fc.string({ minLength: 1, maxLength: 20 }),
  })
  .map((c) => c as CampusCommitment);

/** Generate a minimal RouteResult with a random exposureScore */
const routeResultArb: fc.Arbitrary<RouteResult> = fc
  .record({
    exposureScore: fc.float({ min: 0, max: 100, noNaN: true }),
  })
  .map(({ exposureScore }) => makeRouteResult({ exposureScore }));

/** Generate a ScheduleTransition with arbitrary segmentRisk values */
const transitionArb: fc.Arbitrary<ScheduleTransition> = fc
  .record({
    origin: commitmentArb,
    destination: commitmentArb,
    routeResult: fc.option(routeResultArb, { nil: null }),
    segmentRisk: segmentRiskArb,
  })
  .map(
    ({ origin, destination, routeResult, segmentRisk }) =>
      ({
        origin,
        destination,
        routeResult,
        segmentRisk,
        coolingRecommendation: null,
        waterRecommendation: null,
        shuttleAlternative: null,
      } as ScheduleTransition)
  );

/** Generate an array of 1–10 transitions */
const transitionsArb = fc.array(transitionArb, {
  minLength: 1,
  maxLength: 10,
});

// ---------------------------------------------------------------------------
// Property 3: Total outdoor minutes = sum of individual walking times
// Validates: Requirements 3.3, 14.2
// ---------------------------------------------------------------------------

describe("calculateDailyHeatExposure – P3: totalOutdoorMinutes = sum of walkingTimeMinutes", () => {
  testProp.prop([transitionsArb], { numRuns: 100 })(
    "totalOutdoorMinutes equals the sum of each transition's segmentRisk.walkingTimeMinutes",
    (transitions) => {
      const result = calculateDailyHeatExposure(transitions);

      const expectedTotal = transitions.reduce(
        (sum, t) => sum + t.segmentRisk.walkingTimeMinutes,
        0
      );

      // Use closeTo for floating-point tolerance
      expect(result.totalOutdoorMinutes).toBeCloseTo(expectedTotal, 5);
    }
  );
});
