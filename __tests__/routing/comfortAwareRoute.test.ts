import { describe, it, expect } from "vitest";
import { campusGraph } from "../../lib/data/loadDataset";
import {
  comfortAwareRoute,
  DEFAULT_COMFORT_WEIGHTS,
} from "../../lib/routing/comfortAwareRoute";
import { shortestRoute } from "../../lib/routing/shortestRoute";

const phoenixWeather = {
  airTempF: 108,
  windSpeedMps: 2.0,
  relativeHumidity: 18,
};

describe("comfortAwareRoute", () => {
  it("returns null for an unknown node", () => {
    const result = comfortAwareRoute(
      campusGraph,
      "does-not-exist",
      "b2",
      14,
      phoenixWeather
    );
    expect(result).toBeNull();
  });

  it("returns a connected path between known buildings", () => {
    const result = comfortAwareRoute(campusGraph, "b1", "b3", 14, phoenixWeather);
    expect(result).not.toBeNull();
    expect(result!.path[0]).toBe("b1");
    expect(result!.path[result!.path.length - 1]).toBe("b3");
    expect(result!.distanceMeters).toBeGreaterThan(0);
  });

  it("strongly biased comfort weights prefer indoor edges when available", () => {
    const indoorBiased = comfortAwareRoute(
      campusGraph,
      "b1",
      "b2",
      14,
      phoenixWeather,
      false,
      { distance: 0.05, comfort: 0.5, indoor: 0.9 }
    );
    expect(indoorBiased).not.toBeNull();
    expect(indoorBiased!.indoorMeters).toBeGreaterThan(0);
  });

  it("distance-biased weights match the shortest path on simple A-B segments", () => {
    const direct = comfortAwareRoute(
      campusGraph,
      "b1",
      "b2",
      14,
      phoenixWeather,
      false,
      { distance: 1.0, comfort: 0.0, indoor: 0.0 }
    );
    const shortest = shortestRoute(campusGraph, "b1", "b2");
    expect(direct).not.toBeNull();
    expect(shortest).not.toBeNull();
    expect(direct!.distanceMeters).toBeLessThanOrEqual(shortest!.distanceMeters * 1.05);
  });

  it("default weights produce a finite, non-empty edge list", () => {
    const result = comfortAwareRoute(
      campusGraph,
      "b1",
      "b9",
      14,
      phoenixWeather,
      false,
      DEFAULT_COMFORT_WEIGHTS
    );
    expect(result).not.toBeNull();
    expect(result!.edges.length).toBeGreaterThan(0);
    expect(Number.isFinite(result!.distanceMeters)).toBe(true);
  });
});
