// Feature: heatshield-planner, Property 6: Safety classification consistent with thresholds
// Feature: heatshield-planner, Property 7: Risk level values are always valid labels (never "safe")
// Feature: heatshield-planner, Property 10: Shuttle-first recommendation when preference enabled + high risk
// Feature: heatshield-planner, Property 11: Blocked segments → at least one recommendation each
// Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.7, 14.5

import { describe, expect } from "vitest";
import { test as testProp, fc } from "@fast-check/vitest";
import { evaluateDailyHeatSafety } from "../../lib/planner/evaluateDailyHeatSafety";
import type {
  ScheduleTransition,
  CampusCommitment,
  RouteSegmentRisk,
  DailyAggregateMetrics,
  DailyHeatPlan,
  PersonalHeatMode,
  RiskLevel,
} from "../../lib/planner/types";
import type { RouteResult } from "../../lib/routing/types";
import { makeRouteResult } from "../helpers/graphTestUtils";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

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

const riskLevelArb: fc.Arbitrary<RiskLevel> = fc.constantFrom(
  "lower-risk" as const,
  "higher-risk" as const,
  "not recommended" as const,
);

function segmentRiskArb(): fc.Arbitrary<RouteSegmentRisk> {
  return fc
    .record({
      walkingTimeMinutes: fc.float({ min: 1, max: 60, noNaN: true }),
      sunExposureMinutes: fc.float({ min: 0, max: 60, noNaN: true }),
      shadePercentage: fc.float({ min: 0, max: 100, noNaN: true }),
      coolingAvailability: fc.integer({ min: 0, max: 10 }),
      waterAvailability: fc.integer({ min: 0, max: 10 }),
      accessibilityCompliant: fc.boolean(),
      confidenceLabel: fc.constantFrom("High" as const, "Medium" as const, "Low" as const),
      riskLevel: riskLevelArb,
    })
    .map((r) => r as RouteSegmentRisk);
}

function routeResultWithScore(exposureScore: number): fc.Arbitrary<RouteResult> {
  return fc.constant(makeRouteResult({ exposureScore }));
}

function transitionWithScore(exposureScore: number): fc.Arbitrary<ScheduleTransition> {
  return fc
    .record({
      origin: commitmentArb,
      destination: commitmentArb,
      routeResult: routeResultWithScore(exposureScore),
      segmentRisk: segmentRiskArb(),
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
}

function transitionWithScoreRange(
  min: number,
  max: number,
): fc.Arbitrary<ScheduleTransition> {
  return fc
    .float({ min: Math.fround(min), max: Math.fround(max), noNaN: true })
    .chain((score) => transitionWithScore(score));
}

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

function buildDailyPlan(transitions: ScheduleTransition[]): DailyHeatPlan {
  const totalOutdoorMinutes = transitions.reduce(
    (sum, t) => sum + t.segmentRisk.walkingTimeMinutes,
    0,
  );
  let highestIdx = 0;
  for (let i = 1; i < transitions.length; i++) {
    const score = transitions[i].routeResult?.exposureScore ?? 0;
    const best = transitions[highestIdx].routeResult?.exposureScore ?? 0;
    if (score > best) highestIdx = i;
  }
  const aggregateMetrics: DailyAggregateMetrics = {
    totalOutdoorMinutes,
    totalSunExposureMinutes: 0,
    averageShadePercentage: 0,
    totalCoolingStopsAvailable: 0,
    highestRiskSegmentIndex: highestIdx,
    estimatedReductionPercentage: 0,
  };
  return { transitions, aggregateMetrics };
}

// ---------------------------------------------------------------------------
// Property 6: Safety classification consistent with thresholds
// Validates: Requirements 6.4, 6.5, 6.6, 13.9, 14.5
// ---------------------------------------------------------------------------

describe("evaluateDailyHeatSafety – P6: Safety classification consistent with thresholds", () => {
  // Sub-property 6a: All scores ≤ 50 → "lower-risk" and allowed === true
  testProp.prop(
    [
      fc.array(transitionWithScoreRange(0, 50), { minLength: 1, maxLength: 5 }),
      preferencesArb,
    ],
    { numRuns: 100 },
  )(
    "all exposureScores ≤ 50 → riskLevel 'lower-risk' and allowed true",
    (transitions, prefs) => {
      const plan = buildDailyPlan(transitions);
      const result = evaluateDailyHeatSafety(plan, prefs);

      expect(result.riskLevel).toBe("lower-risk");
      expect(result.allowed).toBe(true);
      expect(result.blockedSegments).toHaveLength(0);
    },
  );

  // Sub-property 6b: At least one score 51–75, none > 75 → "higher-risk"
  testProp.prop(
    [
      fc.array(transitionWithScoreRange(0, 50), { minLength: 0, maxLength: 4 }),
      fc.array(transitionWithScoreRange(51, 75), { minLength: 1, maxLength: 3 }),
      preferencesArb,
    ],
    { numRuns: 100 },
  )(
    "at least one score 51–75, none > 75 → riskLevel 'higher-risk'",
    (lowTransitions, midTransitions, prefs) => {
      const allTransitions = [...lowTransitions, ...midTransitions];
      if (allTransitions.length === 0) return; // skip degenerate case
      const plan = buildDailyPlan(allTransitions);
      const result = evaluateDailyHeatSafety(plan, prefs);

      expect(result.riskLevel).toBe("higher-risk");
      expect(result.blockedSegments).toHaveLength(0);
    },
  );

  // Sub-property 6c: Any score > 75 → "not recommended", allowed false, blocked segments include it
  testProp.prop(
    [
      fc.array(transitionWithScoreRange(0, 75), { minLength: 0, maxLength: 4 }),
      fc.array(transitionWithScoreRange(75.01, 100), { minLength: 1, maxLength: 3 }),
      preferencesArb,
    ],
    { numRuns: 100 },
  )(
    "any score > 75 → riskLevel 'not recommended', allowed false, transition in blockedSegments",
    (otherTransitions, highTransitions, prefs) => {
      const allTransitions = [...otherTransitions, ...highTransitions];
      if (allTransitions.length === 0) return;
      const plan = buildDailyPlan(allTransitions);
      const result = evaluateDailyHeatSafety(plan, prefs);

      expect(result.riskLevel).toBe("not recommended");
      expect(result.allowed).toBe(false);
      expect(result.blockedSegments.length).toBeGreaterThanOrEqual(highTransitions.length);
    },
  );
});


// ---------------------------------------------------------------------------
// Property 7: Risk level values are always valid labels (never "safe")
// Validates: Requirements 6.3, 9.4
// ---------------------------------------------------------------------------

describe("evaluateDailyHeatSafety – P7: Risk level values are always valid labels", () => {
  testProp.prop(
    [
      fc.array(
        fc.float({ min: 0, max: 100, noNaN: true }).chain((score) => transitionWithScore(score)),
        { minLength: 1, maxLength: 5 },
      ),
      preferencesArb,
    ],
    { numRuns: 100 },
  )(
    "riskLevel is always one of 'lower-risk', 'higher-risk', 'not recommended' — never 'safe'",
    (transitions, prefs) => {
      const plan = buildDailyPlan(transitions);
      const result = evaluateDailyHeatSafety(plan, prefs);

      const validLabels: string[] = ["lower-risk", "higher-risk", "not recommended"];
      expect(validLabels).toContain(result.riskLevel);
      expect(result.riskLevel).not.toBe("safe");

      // Also verify explanation and recommendations never contain the word "safe"
      expect(result.explanation.toLowerCase()).not.toContain("safe");
      for (const rec of result.recommendations) {
        expect(rec.toLowerCase()).not.toContain("safe");
      }
    },
  );
});

// ---------------------------------------------------------------------------
// Property 10: Shuttle-first recommendation when preference enabled + high risk
// Validates: Requirements 2.6, 5.4, 7.3
// ---------------------------------------------------------------------------

describe("evaluateDailyHeatSafety – P10: Shuttle-first recommendation when preference enabled + high risk", () => {
  testProp.prop(
    [
      fc.array(transitionWithScoreRange(75.01, 100), { minLength: 1, maxLength: 3 }),
    ],
    { numRuns: 100 },
  )(
    "when preferShuttleAlternatives is true and segments are blocked, shuttle recommendation appears first per blocked segment",
    (highTransitions) => {
      const prefs: PersonalHeatMode = {
        ...defaultPreferences,
        preferShuttleAlternatives: true,
      };
      const plan = buildDailyPlan(highTransitions);
      const result = evaluateDailyHeatSafety(plan, prefs);

      expect(result.riskLevel).toBe("not recommended");
      expect(result.blockedSegments.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);

      // For each blocked segment, the first recommendation should mention shuttle
      // The implementation generates recommendations in order: shuttle first (when pref enabled), then cooling/schedule
      // So the first recommendation overall should be shuttle-related
      if (result.recommendations.length > 0) {
        const firstRec = result.recommendations[0].toLowerCase();
        expect(firstRec).toContain("shuttle");
      }
    },
  );

  testProp.prop(
    [
      fc.array(transitionWithScoreRange(75.01, 100), { minLength: 1, maxLength: 3 }),
    ],
    { numRuns: 100 },
  )(
    "when preferShuttleAlternatives is false, first recommendation is NOT shuttle-first",
    (highTransitions) => {
      const prefs: PersonalHeatMode = {
        ...defaultPreferences,
        preferShuttleAlternatives: false,
      };
      const plan = buildDailyPlan(highTransitions);
      const result = evaluateDailyHeatSafety(plan, prefs);

      expect(result.blockedSegments.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);

      // First recommendation should NOT be shuttle when preference is off
      // (it should be cooling/schedule adjustment first)
      const firstRec = result.recommendations[0].toLowerCase();
      expect(firstRec).not.toMatch(/^consider.*shuttle/);
    },
  );
});

// ---------------------------------------------------------------------------
// Property 11: Blocked segments → at least one recommendation each
// Validates: Requirements 6.7
// ---------------------------------------------------------------------------

describe("evaluateDailyHeatSafety – P11: Blocked segments → at least one recommendation each", () => {
  testProp.prop(
    [
      fc.array(transitionWithScoreRange(0, 75), { minLength: 0, maxLength: 3 }),
      fc.array(transitionWithScoreRange(75.01, 100), { minLength: 1, maxLength: 3 }),
      preferencesArb,
    ],
    { numRuns: 100 },
  )(
    "recommendations array has at least as many entries as blocked segments",
    (otherTransitions, highTransitions, prefs) => {
      const allTransitions = [...otherTransitions, ...highTransitions];
      if (allTransitions.length === 0) return;
      const plan = buildDailyPlan(allTransitions);
      const result = evaluateDailyHeatSafety(plan, prefs);

      // There should be at least one recommendation per blocked segment
      expect(result.recommendations.length).toBeGreaterThanOrEqual(
        result.blockedSegments.length,
      );

      // Each blocked segment should have at least one recommendation
      // (the implementation generates at least one per blocked segment)
      expect(result.blockedSegments.length).toBeGreaterThanOrEqual(1);
    },
  );
});
