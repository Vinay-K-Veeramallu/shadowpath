import { describe, it, expect } from "vitest";
import { test as testProp, fc } from "@fast-check/vitest";
import { computeUtci } from "../../lib/comfort/utci";
import { computeEdgeComfort } from "../../lib/comfort/edgeComfort";
import type { GraphEdge, GraphNode, BuildingFootprintSpec } from "../../lib/graph/types";
import { edgeShadeFraction01 } from "../../lib/graph/types";
import { attachShadeForDatetime, shadowLengthMeters } from "../../lib/shadow/shadeFractions";
import { buildGraph } from "../../lib/graph/buildGraph";
function lineEdge(id: string, from: string, to: string, coords: [number, number][]): GraphEdge {
  return {
    id,
    from,
    to,
    distanceMeters: 120,
    accessible: true,
    surfaceType: "asphalt",
    accessRestriction: "public",
    windCanyonFactor: 1,
    shadeLegacy: { "10": 50, "14": 50, "18": 50 },
    hasCoolingPoint: false,
    hasWaterRefill: false,
    geometry: { type: "LineString", coordinates: coords },
  };
}

function node(id: string, lng: number, lat: number): GraphNode {
  return {
    id,
    name: id,
    accessible: true,
    type: "intersection",
    coordinates: [lng, lat],
  };
}

function graphWithBuildingSouthOfEdge(
  buildingHeight: number,
  edgeCoords: [number, number][]
): import("../../lib/graph/types").CampusGraph {
  const mid = edgeCoords[1];
  const poly: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [mid[0] - 0.00015, mid[1] - 0.00025],
        [mid[0] + 0.00015, mid[1] - 0.00025],
        [mid[0] + 0.00015, mid[1] - 0.00045],
        [mid[0] - 0.00015, mid[1] - 0.00045],
        [mid[0] - 0.00015, mid[1] - 0.00025],
      ],
    ],
  };
  const b: BuildingFootprintSpec = {
    id: "bld-test",
    polygon: poly,
    heightMeters: buildingHeight,
  };
  const n1 = node("n1", edgeCoords[0][0], edgeCoords[0][1]);
  const n2 = node("n2", edgeCoords[1][0], edgeCoords[1][1]);
  const edge = lineEdge("e1", "n1", "n2", edgeCoords);
  const nodes = new Map<string, GraphNode>([
    ["n1", n1],
    ["n2", n2],
  ]);
  const edges = new Map<string, GraphEdge>([["e1", edge]]);
  const adjacency = new Map<string, GraphEdge[]>([
    ["n1", [edge]],
    ["n2", [edge]],
  ]);
  return { nodes, edges, adjacency, buildings: [b], trees: [], entrances: [] };
}

describe("shadow / UTCI property tests", () => {
  testProp.prop(
    [fc.date({ noInvalidDate: true })],
    { numRuns: 40 }
  )("shade fraction is always in [0,1] after attachShadeForDatetime", (d) => {
    const coords: [number, number][] = [
      [-111.94, 33.425],
      [-111.939, 33.425],
    ];
    const g = graphWithBuildingSouthOfEdge(25, coords);
    attachShadeForDatetime(g, d, 14);
    for (const e of g.edges.values()) {
      const f = e.shadeFraction ?? edgeShadeFraction01(e, 14);
      if (f < 0 || f > 1) return false;
    }
    return true;
  });

  it("assigns shade fraction 1.0 for all edges when sun is below the horizon", () => {
    const coords: [number, number][] = [
      [-111.94, 33.425],
      [-111.939, 33.425],
    ];
    const g = graphWithBuildingSouthOfEdge(30, coords);
    const night = new Date("2024-01-15T04:00:00-07:00");
    attachShadeForDatetime(g, night, 14);
    for (const e of g.edges.values()) {
      expect(e.shadeFraction).toBe(1);
    }
  });

  testProp.prop([fc.double({ min: 5, max: 45, noNaN: true })], { numRuns: 80 })(
    "UTCI increases monotonically with air temperature (other inputs fixed)",
    (ta) => {
      const u1 = computeUtci({
        airTempC: ta,
        mrtC: ta + 5,
        windSpeedMps: 2,
        relativeHumidity: 30,
      });
      const u2 = computeUtci({
        airTempC: ta + 0.5,
        mrtC: ta + 5.5,
        windSpeedMps: 2,
        relativeHumidity: 30,
      });
      return u2 >= u1;
    }
  );

  it("indoor edge UTCI is below a fully sun-exposed outdoor edge when outdoor air > 30°C", () => {
    const outdoor = lineEdge("eo", "a", "b", [
      [-111.94, 33.42],
      [-111.93, 33.42],
    ]);
    const indoor: GraphEdge = {
      ...outdoor,
      id: "ei",
      isIndoor: true,
      surfaceType: "indoor",
    };
    const weather = { airTempF: 100, windSpeedMps: 2, relativeHumidity: 20 };
    const uOut = computeEdgeComfort(outdoor, 14, weather).utciC;
    const uIn = computeEdgeComfort(indoor, 14, weather).utciC;
    expect(uIn).toBeLessThan(uOut);
  });

  testProp.prop(
    [
      fc.double({ min: 5, max: 40, noNaN: true }),
      fc.double({ min: 0.05, max: 1.2, noNaN: true }),
      fc.double({ min: 0.05, max: 1.2, noNaN: true }),
    ],
    { numRuns: 100 }
  )(
    "shadow length on plane increases as solar altitude decreases (both above horizon)",
    (h, altHigh, altLow) => {
      if (altHigh <= altLow) return true;
      const Lh = shadowLengthMeters(h, altHigh);
      const Ll = shadowLengthMeters(h, altLow);
      if (!Number.isFinite(Lh) || !Number.isFinite(Ll)) return true;
      return Ll >= Lh - 1e-9;
    }
  );

  it("round-trip: minimal GeoJSON parses through buildGraph with valid refs", () => {
    const fcj: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            type: "intersection",
            id: "x1",
            name: "X1",
            accessible: true,
          },
          geometry: { type: "Point", coordinates: [-111.94, 33.42] },
        },
        {
          type: "Feature",
          properties: {
            type: "intersection",
            id: "x2",
            name: "X2",
            accessible: true,
          },
          geometry: { type: "Point", coordinates: [-111.93, 33.42] },
        },
        {
          type: "Feature",
          properties: {
            type: "path",
            id: "xe",
            fromNodeId: "x1",
            toNodeId: "x2",
            distanceMeters: 100,
            accessible: true,
            shade: { "10": 40, "14": 40, "18": 40 },
            hasCoolingPoint: false,
            hasWaterRefill: false,
            shadeStructures: [],
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [-111.94, 33.42],
              [-111.93, 33.42],
            ],
          },
        },
      ],
    };
    const g = buildGraph(fcj);
    expect(g.nodes.size).toBe(2);
    expect(g.edges.size).toBe(1);
  });
});
