// Feature: heatshield-planner, Property 5: consumedBudget + remainingBudget === totalBudget === 100
// Feature: heatshield-planner, Property 15: Higher shade → lower or equal consumedBudget
// Validates: Requirements 4.2, 4.3, 14.4

import { describe, expect } from "vitest";
import { test as testProp, fc } from "@fast-check/vitest";
import { calculateHeatBudget } from "../../lib/planner/calculateHeatBudget";
import type {
  ScheduleTransition,
  CampusCommitment,
  RouteSegmentRisk,
  DailyAggregateMetrics,
  DailyHeatPlan,
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
  "not recommended" as const,
);

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
          `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      ),
    flexibility: fc.constantFrom("flexible" as const, "fixed" as const),
    label: fc.string({ minLength: 1, maxLength: 20 }),
  })
  .map((c) => c as CampusCommitment);

/** Generate a RouteSegmentRisk with a given walkingTimeMinutes */
function segmentRiskWithWalkingTime(
  walkingTimeMinutes: number,
): fc.Arbitrary<RouteSegmentRisk> {
  return fc
    .record({
      sunExposureMinutes: fc.float({ min: 0, max: 120, noNaN: true }),
      shadePercentage: fc.float({ min: 0, max: 100, noNaN: true }),
      coolingAvailability: fc.integer({ min: 0, max: 10 }),
      waterAvailability: fc.integer({ min: 0, max: 10 }),
      accessibilityCompliant: fc.boolean(),
      confidenceLabel: fc.constantFrom(
        "High" as const,
        "Medium" as const,
        "Low" as const,
      ),
      riskLevel: riskLevelArb,
    })
    .map(
      (r) =>
        ({
          ...r,
          walkingTimeMinutes,
        }) as RouteSegmentRisk,
    );
}

/** Generate a RouteResult with a specific exposureScore */
function routeResultWithScore(
  exposureScore: number,
): fc.Arbitrary<RouteResult> {
  return fc.constant(makeRouteResult({ exposureScore }));
}

/**
 * Generate a consistent DailyHeatPlan where totalOutdoorMinutes equals
 * the sum of all transitions' walkingTimeMinutes.
 *
 * Each transition has a non-null routeResult with a random exposureScore (0–100)
 * and a random walkingTimeMinutes (1–60).
 */
const dailyHeatPlanArb: fc.Arbitrary<DailyHeatPlan> = fc
  .array(
    fc.record({
      exposureScore: fc.float({ min: 0, max: 100, noNaN: true }),
      walkingTimeMinutes: fc.float({ min: 1, max: 60, noNaN: true, noDefaultInfinity: true }),
    }),
    { minLength: 1, maxLength: 5 },
  )
  .chain((segments) => {
    const totalOutdoorMinutes = segments.reduce(
      (sum, s) => sum + s.walkingTimeMinutes,
      0,
    );

    // Find the index with the highest exposureScore
    let highestIdx = 0;
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].exposureScore > segments[highestIdx].exposureScore) {
        highestIdx = i;
      }
    }

    // Build transitions from the segments
    const transitionArbs = segments.map((seg) =>
      fc
        .record({
          origin: commitmentArb,
          destination: commitmentArb,
          routeResult: routeResultWithScore(seg.exposureScore),
          segmentRisk: segmentRiskWithWalkingTime(seg.walkingTimeMinutes),
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
            }) as ScheduleTransition,
        ),
    );

    return fc.tuple(...transitionArbs).map((transitions) => {
      const aggregateMetrics: DailyAggregateMetrics = {
        totalOutdoorMinutes,
        totalSunExposureMinutes: 0,
        averageShadePercentage: 0,
        totalCoolingStopsAvailable: 0,
        highestRiskSegmentIndex: highestIdx,
        estimatedReductionPercentage: 0,
      };

      return { transitions, aggregateMetrics } as DailyHeatPlan;
    });
  });

// ---------------------------------------------------------------------------
// Property 5: consumedBudget + remainingBudget === totalBudget === 100
// Validates: Requirements 4.2, 4.3, 14.4
// ---------------------------------------------------------------------------

describe("calculateHeatBudget – P5: consumedBudget + remainingBudget === totalBudget === 100", () => {
  testProp.prop([dailyHeatPlanArb], { numRuns: 100 })(
    "totalBudget is always 100 and consumedBudget + remainingBudget equals totalBudget",
    (plan) => {
      const result = calculateHeatBudget(plan);

      // totalBudget must always be 100
      expect(result.totalBudget).toBe(100);

      // consumedBudget + remainingBudget should equal 100 (floating-point tolerance)
      expect(result.consumedBudget + result.remainingBudget).toBeCloseTo(100, 5);
    },
  );
});

// ---------------------------------------------------------------------------
// Property 15: Higher shade → lower or equal consumedBudget
// Validates: Requirements 4.2, 4.3, 14.4
// ---------------------------------------------------------------------------

/**
 * Generate a pair of DailyHeatPlans: a base plan and a "higher shade" variant.
 * The variant has lower or equal exposureScores on every transition,
 * simulating the effect of higher shade coverage.
 * All other fields (walkingTimeMinutes, totalOutdoorMinutes, etc.) are identical.
 */
const pairedPlansArb: fc.Arbitrary<{ base: DailyHeatPlan; shadier: DailyHeatPlan }> = fc
  .array(
    fc.record({
      baseExposureScore: fc.float({ min: 0, max: 100, noNaN: true }),
      reductionFactor: fc.float({ min: 0, max: 1, noNaN: true }),
      walkingTimeMinutes: fc.float({ min: 1, max: 60, noNaN: true, noDefaultInfinity: true }),
    }),
    { minLength: 1, maxLength: 5 },
  )
  .chain((segments) => {
    const totalOutdoorMinutes = segments.reduce(
      (sum, s) => sum + s.walkingTimeMinutes,
      0,
    );

    // Find highest exposure index for base plan
    let highestIdx = 0;
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].baseExposureScore > segments[highestIdx].baseExposureScore) {
        highestIdx = i;
      }
    }

    // Build paired transitions
    const pairedTransitionArbs = segments.map((seg) => {
      const shadierExposureScore = seg.baseExposureScore * seg.reductionFactor;

      return fc
        .record({
          origin: commitmentArb,
          destination: commitmentArb,
          segmentRisk: segmentRiskWithWalkingTime(seg.walkingTimeMinutes),
        })
        .map(({ origin, destination, segmentRisk }) => {
          const baseTransition: ScheduleTransition = {
            origin,
            destination,
            routeResult: makeRouteResult({
              exposureScore: seg.baseExposureScore,
            }),
            segmentRisk,
            coolingRecommendation: null,
            waterRecommendation: null,
            shuttleAlternative: null,
          };

          const shadierTransition: ScheduleTransition = {
            origin,
            destination,
            routeResult: makeRouteResult({
              exposureScore: shadierExposureScore,
            }),
            segmentRisk,
            coolingRecommendation: null,
            waterRecommendation: null,
            shuttleAlternative: null,
          };

          return { base: baseTransition, shadier: shadierTransition };
        });
    });

    return fc.tuple(...pairedTransitionArbs).map((pairs) => {
      const baseTransitions = pairs.map((p) => p.base);
      const shadierTransitions = pairs.map((p) => p.shadier);

      const aggregateMetrics: DailyAggregateMetrics = {
        totalOutdoorMinutes,
        totalSunExposureMinutes: 0,
        averageShadePercentage: 0,
        totalCoolingStopsAvailable: 0,
        highestRiskSegmentIndex: highestIdx,
        estimatedReductionPercentage: 0,
      };

      return {
        base: { transitions: baseTransitions, aggregateMetrics } as DailyHeatPlan,
        shadier: { transitions: shadierTransitions, aggregateMetrics } as DailyHeatPlan,
      };
    });
  });

describe("calculateHeatBudget – P15: Higher shade → lower or equal consumedBudget", () => {
  testProp.prop([pairedPlansArb], { numRuns: 100 })(
    "a plan with lower exposureScores (higher shade) has lower or equal consumedBudget",
    ({ base, shadier }) => {
      const baseResult = calculateHeatBudget(base);
      const shadierResult = calculateHeatBudget(shadier);

      // The shadier plan should consume less or equal budget
      expect(shadierResult.consumedBudget).toBeLessThanOrEqual(
        baseResult.consumedBudget + 1e-9, // tiny epsilon for floating-point
      );
    },
  );
});
