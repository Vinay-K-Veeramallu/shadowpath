import { describe, it, expect } from "vitest";
import {
  computeUtci,
  utciStressCategory,
  utciStressPenalty,
  fahrenheitToCelsius,
  saturationVaporKpa,
  vaporPressureKpa,
} from "../../lib/comfort/utci";
import { computeEdgeComfort, averageUtci } from "../../lib/comfort/edgeComfort";
import type { GraphEdge } from "../../lib/graph/types";

const phoenixWeather = {
  airTempF: 108,
  windSpeedMps: 2.0,
  relativeHumidity: 18,
};

function makeEdge(overrides: Partial<GraphEdge>): GraphEdge {
  return {
    id: "e",
    from: "a",
    to: "b",
    distanceMeters: 100,
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
        [-111.93, 33.42],
        [-111.92, 33.42],
      ],
    },
    ...overrides,
  };
}

describe("UTCI conversions", () => {
  it("converts Fahrenheit to Celsius accurately", () => {
    expect(fahrenheitToCelsius(32)).toBeCloseTo(0, 5);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100, 5);
    expect(fahrenheitToCelsius(108)).toBeCloseTo(42.222, 2);
  });

  it("computes Magnus saturation vapor pressure with positive monotonicity", () => {
    expect(saturationVaporKpa(20)).toBeLessThan(saturationVaporKpa(40));
    expect(saturationVaporKpa(0)).toBeGreaterThan(0);
  });

  it("partial vapor pressure scales with humidity", () => {
    const lo = vaporPressureKpa(40, 10);
    const hi = vaporPressureKpa(40, 80);
    expect(hi).toBeGreaterThan(lo);
  });
});

describe("computeUtci", () => {
  it("is monotonically increasing in MRT", () => {
    const base = { airTempC: 40, windSpeedMps: 2, relativeHumidity: 20 };
    const utciShade = computeUtci({ ...base, mrtC: 42 });
    const utciSun = computeUtci({ ...base, mrtC: 70 });
    expect(utciSun).toBeGreaterThan(utciShade);
  });

  it("is monotonically decreasing in wind speed", () => {
    const base = { airTempC: 40, mrtC: 60, relativeHumidity: 20 };
    const calm = computeUtci({ ...base, windSpeedMps: 0.5 });
    const breezy = computeUtci({ ...base, windSpeedMps: 8 });
    expect(breezy).toBeLessThan(calm);
  });

  it("clamps wind to the operational range so cost stays finite", () => {
    const u1 = computeUtci({ airTempC: 30, mrtC: 35, windSpeedMps: 0, relativeHumidity: 30 });
    const u2 = computeUtci({ airTempC: 30, mrtC: 35, windSpeedMps: 0.5, relativeHumidity: 30 });
    const u3 = computeUtci({ airTempC: 30, mrtC: 35, windSpeedMps: 100, relativeHumidity: 30 });
    const u4 = computeUtci({ airTempC: 30, mrtC: 35, windSpeedMps: 17, relativeHumidity: 30 });
    expect(u1).toBeCloseTo(u2, 5);
    expect(u3).toBeCloseTo(u4, 5);
  });
});

describe("utciStressCategory", () => {
  it("maps thresholds correctly", () => {
    expect(utciStressCategory(20)).toBe("no-stress");
    expect(utciStressCategory(28)).toBe("moderate");
    expect(utciStressCategory(35)).toBe("strong");
    expect(utciStressCategory(40)).toBe("very-strong");
    expect(utciStressCategory(50)).toBe("extreme");
  });

  it("stressPenalty is 0 below 26 and 1 above 46", () => {
    expect(utciStressPenalty(10)).toBe(0);
    expect(utciStressPenalty(26)).toBe(0);
    expect(utciStressPenalty(46)).toBe(1);
    expect(utciStressPenalty(60)).toBe(1);
    expect(utciStressPenalty(36)).toBeCloseTo(0.5, 5);
  });
});

describe("computeEdgeComfort", () => {
  it("indoor edges report comfortable UTCI regardless of weather", () => {
    const edge = makeEdge({ isIndoor: true });
    const comfort = computeEdgeComfort(edge, 14, phoenixWeather);
    expect(comfort.isIndoor).toBe(true);
    expect(comfort.stress).toBe("no-stress");
    expect(comfort.stressPenalty).toBe(0);
  });

  it("more shade reduces stress penalty on outdoor edges", () => {
    const sunny = makeEdge({ shadeLegacy: { "10": 0, "14": 0, "18": 0 } });
    const shaded = makeEdge({ shadeLegacy: { "10": 100, "14": 100, "18": 100 } });
    const sunnyUtci = computeEdgeComfort(sunny, 14, phoenixWeather).utciC;
    const shadedUtci = computeEdgeComfort(shaded, 14, phoenixWeather).utciC;
    expect(sunnyUtci).toBeGreaterThan(shadedUtci);
  });
});

describe("averageUtci", () => {
  it("returns 0 for empty edges", () => {
    expect(averageUtci([], 14, phoenixWeather)).toBe(0);
  });

  it("is distance-weighted", () => {
    const longSunny = makeEdge({
      id: "long",
      distanceMeters: 900,
      shadeLegacy: { "10": 0, "14": 0, "18": 0 },
    });
    const shortShaded = makeEdge({
      id: "short",
      distanceMeters: 100,
      shadeLegacy: { "10": 100, "14": 100, "18": 100 },
    });
    const avg = averageUtci([longSunny, shortShaded], 14, phoenixWeather);
    const sunnyOnly = computeEdgeComfort(longSunny, 14, phoenixWeather).utciC;
    const shadedOnly = computeEdgeComfort(shortShaded, 14, phoenixWeather).utciC;
    // Should be much closer to sunny than shaded value
    expect(Math.abs(avg - sunnyOnly)).toBeLessThan(Math.abs(avg - shadedOnly));
  });
});
