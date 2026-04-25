// Feature: heatshield-planner, Properties 4, 16
// Validates: Requirements 5.1, 5.3, 14.3

import { describe, expect } from "vitest";
import { test as testProp, fc } from "@fast-check/vitest";
import {
  findHighestRiskSegment,
  generateRecommendedActions,
} from "../../lib/planner/findHighestRiskSegment";
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
  "not recommended" as const,
);

/** Generate a RouteSegmentRisk */
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
      "Low" as const,
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
          `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      ),
    flexibility: fc.constantFrom("flexible" as const, "fixed" as const),
    label: fc.string({ minLength: 1, maxLength: 20 }),
  })
  .map((c) => c as CampusCommitment);

/** Generate a RouteResult with a specific exposureScore */
function routeResultWithScore(
  scoreArb: fc.Arbitrary<number>,
): fc.Arbitrary<RouteResult> {
  return scoreArb.map((exposureScore) => makeRouteResult({ exposureScore }));
}

/** Generate a RouteResult with a random exposureScore 0–100 */
const routeResultArb: fc.Arbitrary<RouteResult> = routeResultWithScore(
  fc.float({ min: 0, max: 100, noNaN: true }),
);

/** Generate a ScheduleTransition with a non-null routeResult */
const transitionWithRouteArb: fc.Arbitrary<ScheduleTransition> = fc
  .record({
    origin: commitmentArb,
    destination: commitmentArb,
    routeResult: routeResultArb,
    segmentRisk: segmentRiskArb,
  })
  .map(({ origin, destination, routeResult, segmentRisk }) => ({
    origin,
    destination,
    routeResult,
    segmentRisk,
    coolingRecommendation: null,
    waterRecommendation: null,
    shuttleAlternative: null,
  }));

/** Generate a ScheduleTransition with an optional (possibly null) routeResult */
const transitionArb: fc.Arbitrary<ScheduleTransition> = fc
  .record({
    origin: commitmentArb,
    destination: commitmentArb,
    routeResult: fc.option(routeResultArb, { nil: null }),
    segmentRisk: segmentRiskArb,
  })
  .map(({ origin, destination, routeResult, segmentRisk }) => ({
    origin,
    destination,
    routeResult,
    segmentRisk,
    coolingRecommendation: null,
    waterRecommendation: null,
    shuttleAlternative: null,
  }));

/**
 * Generate a non-empty array of transitions where at least one has a non-null routeResult.
 * This is the precondition for Property 4.
 */
const transitionsWithAtLeastOneRouteArb: fc.Arbitrary<ScheduleTransition[]> = fc
  .record({
    // At least one transition with a non-null routeResult
    required: transitionWithRouteArb,
    // 0–9 additional transitions (may have null routeResult)
    others: fc.array(transitionArb, { minLength: 0, maxLength: 9 }),
    // Where to insert the required transition
    insertIdx: fc.nat(),
  })
  .map(({ required, others, insertIdx }) => {
    const idx = insertIdx % (others.length + 1);
    const result = [...others];
    result.splice(idx, 0, required);
    return result;
  });

// ---------------------------------------------------------------------------
// Property 4: Highest-risk segment has maximum exposure score
// Validates: Requirements 5.1, 13.4, 14.3
// ---------------------------------------------------------------------------

describe("findHighestRiskSegment – P4: returns transition with maximum exposure score", () => {
  testProp.prop([transitionsWithAtLeastOneRouteArb], { numRuns: 100 })(
    "returned transition has exposureScore >= all other transitions' exposure scores",
    (transitions) => {
      const result = findHighestRiskSegment(transitions);

      const resultScore = result.routeResult?.exposureScore ?? 0;

      for (const t of transitions) {
        const score = t.routeResult?.exposureScore ?? 0;
        expect(resultScore).toBeGreaterThanOrEqual(score);
      }
    },
  );

  testProp.prop([transitionsWithAtLeastOneRouteArb], { numRuns: 100 })(
    "ties are broken by first occurrence (lowest index)",
    (transitions) => {
      const result = findHighestRiskSegment(transitions);
      const resultScore = result.routeResult?.exposureScore ?? 0;

      // Find the first index with the maximum score
      let firstMaxIdx = 0;
      let maxScore = transitions[0].routeResult?.exposureScore ?? 0;
      for (let i = 1; i < transitions.length; i++) {
        const score = transitions[i].routeResult?.exposureScore ?? 0;
        if (score > maxScore) {
          maxScore = score;
          firstMaxIdx = i;
        }
      }

      // The result should be the same object as the first-occurrence max
      expect(result).toBe(transitions[firstMaxIdx]);
    },
  );
});

// ---------------------------------------------------------------------------
// Property 16: Highest-risk segment explanation has at least 3 recommended actions
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------

describe("findHighestRiskSegment – P16: at least 3 recommended actions for highest-risk segment", () => {
  testProp.prop([transitionsWithAtLeastOneRouteArb], { numRuns: 100 })(
    "generateRecommendedActions returns at least 3 items for the highest-risk segment",
    (transitions) => {
      const highestRisk = findHighestRiskSegment(transitions);
      const actions = generateRecommendedActions(highestRisk);

      expect(actions.length).toBeGreaterThanOrEqual(3);
    },
  );

  testProp.prop([transitionWithRouteArb], { numRuns: 100 })(
    "generateRecommendedActions returns at least 3 items for any transition",
    (transition) => {
      const actions = generateRecommendedActions(transition);

      expect(actions.length).toBeGreaterThanOrEqual(3);
      // All actions should be non-empty strings
      for (const action of actions) {
        expect(typeof action).toBe("string");
        expect(action.length).toBeGreaterThan(0);
      }
    },
  );
});
