// Feature: shadow-path, Property 11: Result panel contains all required fields for any route result

import { test as testProp, fc } from "@fast-check/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RouteResultPanel } from "../../components/RouteResultPanel";
import { HighContrastContext } from "../../contexts/HighContrastContext";
import type { RouteResult } from "../../lib/routing/types";
import { makeRouteResult } from "../helpers/graphTestUtils";

function withHighContrast(ui: React.ReactElement) {
  return (
    <HighContrastContext.Provider value={{ highContrast: false, toggleHighContrast: () => {} }}>
      {ui}
    </HighContrastContext.Provider>
  );
}

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
      assumptions: ["Walking speed: 80 meters/minute"],
    })
  );

testProp.prop([arbRouteResult], { numRuns: 100 })(
  "RouteResultPanel renders shade %, sun exposure, Exposure_Score, Confidence_Label, data source, and assumption",
  (route) => {
    const { container } = render(
      withHighContrast(<RouteResultPanel results={[route]} loading={false} />)
    );
    const text = container.textContent ?? "";

    const shadeStr = `${route.shadePercentage.toFixed(0)}%`;
    if (!text.includes(shadeStr)) return false;

    const sunStr = `${route.sunExposureMinutes}`;
    if (!text.includes(sunStr)) return false;

    const scoreStr = route.exposureScore.toFixed(0);
    if (!text.includes(scoreStr)) return false;

    if (!text.includes(route.confidenceLabel)) return false;

    const hasDataSource = route.dataSources.some((ds) => text.includes(ds));
    if (!hasDataSource) return false;

    const hasAssumption = route.assumptions.some((a) => text.includes(a));
    if (!hasAssumption) return false;

    return true;
  }
);

describe("RouteResultPanel unit tests", () => {
  const baseRoute = makeRouteResult({
    type: ["shortest"],
    path: ["a", "b"],
    distanceMeters: 300,
    durationMinutes: 4,
    shadePercentage: 50,
    sunExposureMinutes: 2,
    coolingStopCount: 0,
    exposureScore: 40,
    confidenceLabel: "High",
    safetyVerdict: "lower-risk",
    dataSources: ["campus.geojson"],
    assumptions: ["Average walking speed 5 km/h"],
  });

  it("renders explanatory note when confidenceLabel is Low", () => {
    const lowRoute: RouteResult = {
      ...baseRoute,
      confidenceLabel: "Low",
    };
    render(withHighContrast(<RouteResultPanel results={[lowRoute]} loading={false} />));
    expect(screen.getByText(/backup conditions|demo/i)).toBeTruthy();
  });

  it("shows shuttle/cooling-point recommendation when all routes are not recommended", () => {
    const unsafeRoute: RouteResult = {
      ...baseRoute,
      safetyVerdict: "not-recommended",
      exposureScore: 80,
      averageUtciC: 40,
    };
    render(withHighContrast(<RouteResultPanel results={[unsafeRoute]} loading={false} />));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/shuttle|cooling point/i);
  });

  it("does not show lower-risk label when all routes are not recommended", () => {
    const unsafeRoute: RouteResult = {
      ...baseRoute,
      safetyVerdict: "not-recommended",
      exposureScore: 80,
      averageUtciC: 40,
    };
    const { container } = render(
      withHighContrast(<RouteResultPanel results={[unsafeRoute]} loading={false} />)
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\bLower risk\b/);
  });
});
