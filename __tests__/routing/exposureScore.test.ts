// Feature: shadow-path, Property 7: Exposure_Score is always in range [0, 100]
// Feature: shadow-path, Property 8: Shade percentage monotonically decreases Exposure_Score
// Feature: shadow-path, Property 12: Sun exposure minutes is always a rounded whole number

import { test as testProp, fc } from "@fast-check/vitest";
import { computeExposureScore } from "../../lib/routing/exposureScore";

// ---------------------------------------------------------------------------
// Property 7: Exposure_Score is always in range [0, 100]
// Validates: Requirements 3.6, 4.1
// ---------------------------------------------------------------------------

testProp.prop(
  [
    fc.integer({ min: 0, max: 60 }),   // durationMinutes
    fc.integer({ min: 0, max: 100 }),  // shadePercentage
    fc.integer({ min: 80, max: 130 }), // heatIndex
    fc.integer({ min: 0, max: 10 }),   // coolingStopCount
    fc.boolean(),                       // accessibilityMode
  ],
  { numRuns: 100 }
)(
  "exposureScore is always in range [0, 100]",
  (durationMinutes, shadePercentage, heatIndex, coolingStopCount, accessibilityMode) => {
    const { exposureScore } = computeExposureScore({
      durationMinutes,
      shadePercentage,
      heatIndex,
      coolingStopCount,
      accessibilityMode,
    });

    return exposureScore >= 0 && exposureScore <= 100;
  }
);

// ---------------------------------------------------------------------------
// Property 8: Shade percentage monotonically decreases Exposure_Score
// Validates: Requirements 4.6, 11.6
// ---------------------------------------------------------------------------

testProp.prop(
  [
    fc.integer({ min: 0, max: 60 }),   // durationMinutes
    fc.integer({ min: 80, max: 130 }), // heatIndex
    fc.integer({ min: 0, max: 10 }),   // coolingStopCount
    fc.boolean(),                       // accessibilityMode
    fc.integer({ min: 0, max: 99 }),   // shade1 (s1)
    fc.integer({ min: 1, max: 100 }),  // shade2 offset (to ensure s2 > s1)
  ],
  { numRuns: 100 }
)(
  "increasing shade percentage never increases exposureScore",
  (durationMinutes, heatIndex, coolingStopCount, accessibilityMode, s1Raw, offset) => {
    const s1 = s1Raw;
    const s2 = Math.min(s1 + offset, 100);

    // Ensure s1 < s2 (skip degenerate case)
    if (s1 >= s2) return true;

    const base = { durationMinutes, heatIndex, coolingStopCount, accessibilityMode };

    const score1 = computeExposureScore({ ...base, shadePercentage: s1 }).exposureScore;
    const score2 = computeExposureScore({ ...base, shadePercentage: s2 }).exposureScore;

    return score1 >= score2;
  }
);

// ---------------------------------------------------------------------------
// Property 12: Sun exposure minutes is always a rounded whole number
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------

testProp.prop(
  [
    fc.integer({ min: 0, max: 60 }),  // durationMinutes
    fc.integer({ min: 0, max: 100 }), // shadePercentage
  ],
  { numRuns: 100 }
)(
  "sunExposureMinutes is a non-negative integer equal to Math.round(durationMinutes * (1 - shadePercentage / 100))",
  (durationMinutes, shadePercentage) => {
    const { sunExposureMinutes } = computeExposureScore({
      durationMinutes,
      shadePercentage,
      heatIndex: 100,
      coolingStopCount: 0,
      accessibilityMode: false,
    });

    const expected = Math.round(durationMinutes * (1 - shadePercentage / 100));

    return (
      sunExposureMinutes === expected &&
      Number.isInteger(sunExposureMinutes) &&
      sunExposureMinutes >= 0
    );
  }
);
