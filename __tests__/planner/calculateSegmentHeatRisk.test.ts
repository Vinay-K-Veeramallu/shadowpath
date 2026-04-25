// Feature: heatshield-planner
// Unit tests for calculateSegmentHeatRisk
// Validates: Requirements 3.2, 13.2

import { describe, it, expect } from "vitest";
import { calculateSegmentHeatRisk } from "../../lib/planner/calculateSegmentHeatRisk";
import type { RouteResult } from "../../lib/routing/types";
import type { WeatherData } from "../../lib/weather/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultWeather: WeatherData = {
  heatIndex: 105,
  temperature: 100,
  relativeHumidity: 18,
  windSpeedMps: 2.2,
  confidence: "High",
  source: "nws-live",
  fetchedAt: null,
};

/**
 * Build a minimal RouteResult with a specific exposureScore.
 * Other fields are set to sensible defaults.
 */
const sampleEdge = {
  id: "e-b1-b2",
  from: "b1",
  to: "b2",
  distanceMeters: 200,
  accessible: true,
  surfaceType: "asphalt" as const,
  accessRestriction: "public" as const,
  windCanyonFactor: 1,
  shadeLegacy: { "10": 60, "14": 30, "18": 70 },
  hasCoolingPoint: false,
  hasWaterRefill: true,
  geometry: {
    type: "LineString" as const,
    coordinates: [
      [-111.93, 33.42],
      [-111.929, 33.421],
    ],
  },
};

function makeRouteResult(overrides: Partial<RouteResult> = {}): RouteResult {
  const defaults: RouteResult = {
    type: ["shortest"],
    path: ["b1", "b2"],
    edges: [sampleEdge],
    distanceMeters: 200,
    durationMinutes: 5,
    shadePercentage: 40,
    sunExposureMinutes: 3,
    coolingStopCount: 0,
    waterStationCount: 1,
    coolingZoneCount: 0,
    exposureScore: 50,
    confidenceLabel: "High",
    safetyVerdict: "lower-risk",
    averageUtciC: 30,
    utciStress: "no-stress",
    utciStressLabel: "No thermal stress",
    indoorMeters: 0,
    dataSources: ["demo"],
    assumptions: [],
    geometry: { type: "FeatureCollection", features: [] },
  };
  return { ...defaults, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateSegmentHeatRisk", () => {
  // -----------------------------------------------------------------------
  // Boundary: exposureScore = 50 → "lower-risk"
  // -----------------------------------------------------------------------
  it('returns "lower-risk" when exposureScore is exactly 50', () => {
    const route = makeRouteResult({ exposureScore: 50 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.riskLevel).toBe("lower-risk");
  });

  // -----------------------------------------------------------------------
  // Boundary: exposureScore = 51 → "higher-risk"
  // -----------------------------------------------------------------------
  it('returns "higher-risk" when exposureScore is exactly 51', () => {
    const route = makeRouteResult({ exposureScore: 51 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.riskLevel).toBe("higher-risk");
  });

  // -----------------------------------------------------------------------
  // Boundary: exposureScore = 75 → "higher-risk"
  // -----------------------------------------------------------------------
  it('returns "higher-risk" when exposureScore is exactly 75', () => {
    const route = makeRouteResult({ exposureScore: 75 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.riskLevel).toBe("higher-risk");
  });

  // -----------------------------------------------------------------------
  // Boundary: exposureScore = 76 → "not recommended"
  // -----------------------------------------------------------------------
  it('returns "not recommended" when exposureScore is exactly 76', () => {
    const route = makeRouteResult({ exposureScore: 76 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.riskLevel).toBe("not recommended");
  });

  // -----------------------------------------------------------------------
  // Low-end: exposureScore = 0 → "lower-risk"
  // -----------------------------------------------------------------------
  it('returns "lower-risk" when exposureScore is 0', () => {
    const route = makeRouteResult({ exposureScore: 0 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.riskLevel).toBe("lower-risk");
  });

  // -----------------------------------------------------------------------
  // High-end: exposureScore = 100 → "not recommended"
  // -----------------------------------------------------------------------
  it('returns "not recommended" when exposureScore is 100', () => {
    const route = makeRouteResult({ exposureScore: 100 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.riskLevel).toBe("not recommended");
  });

  // -----------------------------------------------------------------------
  // Metric extraction: walkingTimeMinutes, sunExposureMinutes, shadePercentage
  // -----------------------------------------------------------------------
  it("extracts walkingTimeMinutes from routeResult.durationMinutes", () => {
    const route = makeRouteResult({ durationMinutes: 12 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.walkingTimeMinutes).toBe(12);
  });

  it("extracts sunExposureMinutes from routeResult.sunExposureMinutes", () => {
    const route = makeRouteResult({ sunExposureMinutes: 7 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.sunExposureMinutes).toBe(7);
  });

  it("extracts shadePercentage from routeResult.shadePercentage", () => {
    const route = makeRouteResult({ shadePercentage: 65 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.shadePercentage).toBe(65);
  });

  // -----------------------------------------------------------------------
  // Metric extraction: coolingAvailability from coolingStopCount
  // -----------------------------------------------------------------------
  it("extracts coolingAvailability from routeResult.coolingStopCount", () => {
    const route = makeRouteResult({ coolingStopCount: 3 });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.coolingAvailability).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Metric extraction: waterAvailability = count of edges with hasWaterRefill
  // -----------------------------------------------------------------------
  it("counts waterAvailability from edges with hasWaterRefill", () => {
    const route = makeRouteResult({
      edges: [
        {
          id: "e1", from: "b1", to: "b2", distanceMeters: 100, accessible: true,
          surfaceType: "asphalt", accessRestriction: "public", windCanyonFactor: 1,
          shadeLegacy: { "10": 50, "14": 50, "18": 50 }, hasCoolingPoint: false,
          hasWaterRefill: true,
          geometry: { type: "LineString", coordinates: [[-111.93, 33.42], [-111.929, 33.421]] },
        },
        {
          id: "e2", from: "b2", to: "b3", distanceMeters: 100, accessible: true,
          surfaceType: "asphalt", accessRestriction: "public", windCanyonFactor: 1,
          shadeLegacy: { "10": 50, "14": 50, "18": 50 }, hasCoolingPoint: false,
          hasWaterRefill: false,
          geometry: { type: "LineString", coordinates: [[-111.929, 33.421], [-111.928, 33.422]] },
        },
        {
          id: "e3", from: "b3", to: "b4", distanceMeters: 100, accessible: true,
          surfaceType: "asphalt", accessRestriction: "public", windCanyonFactor: 1,
          shadeLegacy: { "10": 50, "14": 50, "18": 50 }, hasCoolingPoint: false,
          hasWaterRefill: true,
          geometry: { type: "LineString", coordinates: [[-111.928, 33.422], [-111.927, 33.423]] },
        },
      ],
    });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.waterAvailability).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Metric extraction: accessibilityCompliant (all edges accessible)
  // -----------------------------------------------------------------------
  it("returns accessibilityCompliant true when all edges are accessible", () => {
    const route = makeRouteResult({
      edges: [
        {
          id: "e1", from: "b1", to: "b2", distanceMeters: 100, accessible: true,
          surfaceType: "asphalt", accessRestriction: "public", windCanyonFactor: 1,
          shadeLegacy: { "10": 50, "14": 50, "18": 50 }, hasCoolingPoint: false, hasWaterRefill: false,
          geometry: { type: "LineString", coordinates: [[-111.93, 33.42], [-111.929, 33.421]] },
        },
      ],
    });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.accessibilityCompliant).toBe(true);
  });

  it("returns accessibilityCompliant false when any edge is not accessible", () => {
    const route = makeRouteResult({
      edges: [
        {
          id: "e1", from: "b1", to: "b2", distanceMeters: 100, accessible: true,
          surfaceType: "asphalt", accessRestriction: "public", windCanyonFactor: 1,
          shadeLegacy: { "10": 50, "14": 50, "18": 50 }, hasCoolingPoint: false, hasWaterRefill: false,
          geometry: { type: "LineString", coordinates: [[-111.93, 33.42], [-111.929, 33.421]] },
        },
        {
          id: "e2", from: "b2", to: "b3", distanceMeters: 100, accessible: false,
          surfaceType: "asphalt", accessRestriction: "public", windCanyonFactor: 1,
          shadeLegacy: { "10": 50, "14": 50, "18": 50 }, hasCoolingPoint: false, hasWaterRefill: false,
          geometry: { type: "LineString", coordinates: [[-111.929, 33.421], [-111.928, 33.422]] },
        },
      ],
    });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.accessibilityCompliant).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Metric extraction: confidenceLabel
  // -----------------------------------------------------------------------
  it("extracts confidenceLabel from routeResult", () => {
    const route = makeRouteResult({ confidenceLabel: "Low" });
    const result = calculateSegmentHeatRisk(route, defaultWeather);
    expect(result.confidenceLabel).toBe("Low");
  });

  // -----------------------------------------------------------------------
  // Risk level never contains "safe"
  // -----------------------------------------------------------------------
  it('never returns a riskLevel containing the word "safe"', () => {
    for (const score of [0, 25, 50, 51, 60, 75, 76, 90, 100]) {
      const route = makeRouteResult({ exposureScore: score });
      const result = calculateSegmentHeatRisk(route, defaultWeather);
      expect(result.riskLevel).not.toContain("safe");
    }
  });
});
