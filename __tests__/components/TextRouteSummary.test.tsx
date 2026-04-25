// Feature: shadow-path, Property 13: Text route summary mirrors route results

import { test as testProp, fc } from "@fast-check/vitest";
import { render } from "@testing-library/react";
import type { RouteResult } from "../../lib/routing/types";
import { makeRouteResult } from "../helpers/graphTestUtils";

const arbRouteResult: fc.Arbitrary<RouteResult> = fc
  .record({
    type: fc.subarray(["shortest", "shade-aware", "cooling-stop"] as const, { minLength: 1 }),
    path: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
    distanceMeters: fc.integer({ min: 50, max: 5000 }),
    durationMinutes: fc.integer({ min: 1, max: 60 }),
    shadePercentage: fc.integer({ min: 0, max: 100 }),
    sunExposureMinutes: fc.integer({ min: 0, max: 60 }),
    coolingStopCount: fc.integer({ min: 0, max: 5 }),
    exposureScore: fc.integer({ min: 0, max: 100 }),
    confidenceLabel: fc.constantFrom("High", "Medium", "Low" as const),
    safetyVerdict: fc.constantFrom(
      "lower-risk" as const,
      "higher-risk" as const,
      "not-recommended" as const
    ),
  })
  .map((r) =>
    makeRouteResult({
      ...r,
      dataSources: ["campus.geojson"],
      assumptions: ["Walking speed"],
    })
  );

const ROUTE_TYPE_LABELS: Record<string, string> = {
  shortest: "Shortest",
  "shade-aware": "Shade-Aware",
  "cooling-stop": "Cooling Stop",
};

testProp.prop(
  [fc.array(arbRouteResult, { minLength: 1, maxLength: 3 })],
  { numRuns: 100 }
)(
  "TextRouteSummary contains text for every route type, Exposure_Score, and safety verdict",
  async (results) => {
    const { TextRouteSummary } = await import("../../components/TextRouteSummary");
    const { container } = render(<TextRouteSummary results={results} />);
    const text = container.textContent ?? "";

    for (const route of results) {
      for (const t of route.type) {
        const label = ROUTE_TYPE_LABELS[t] ?? t;
        if (!text.includes(label)) return false;
      }

      const scoreStr = route.exposureScore.toFixed(0);
      if (!text.includes(scoreStr)) return false;

      if (route.safetyVerdict === "not-recommended") {
        if (!text.includes("Not recommended")) return false;
      } else if (route.safetyVerdict === "higher-risk") {
        if (!text.includes("Higher risk")) return false;
      } else {
        if (!text.includes("Lower risk")) return false;
      }
    }

    return true;
  }
);
