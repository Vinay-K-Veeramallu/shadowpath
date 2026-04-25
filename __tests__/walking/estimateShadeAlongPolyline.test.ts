import { describe, it, expect } from "vitest";
import type { CampusGraph, GraphEdge, GraphNode } from "../../lib/graph/types";
import { campusGraphShell } from "../helpers/graphTestUtils";
import { estimateShadePercentAlongPolyline } from "../../lib/walking/estimateShadeAlongPolyline";

function graphOneShadedEdge(): CampusGraph {
  const n1: GraphNode = {
    id: "a",
    name: "A",
    accessible: true,
    type: "building",
    coordinates: [-111.94, 33.42],
  };
  const n2: GraphNode = {
    id: "b",
    name: "B",
    accessible: true,
    type: "building",
    coordinates: [-111.93, 33.42],
  };
  const edge: GraphEdge = {
    id: "e1",
    from: "a",
    to: "b",
    distanceMeters: 500,
    accessible: true,
    surfaceType: "concrete",
    accessRestriction: "public",
    windCanyonFactor: 1,
    hasCoolingPoint: false,
    hasWaterRefill: false,
    geometry: {
      type: "LineString",
      coordinates: [
        [-111.94, 33.42],
        [-111.93, 33.42],
      ],
    },
    shadeLegacy: { "10": 90, "14": 90, "18": 90 },
  };
  const nodes = new Map([
    ["a", n1],
    ["b", n2],
  ]);
  const edges = new Map([["e1", edge]]);
  const adjacency = new Map<string, GraphEdge[]>([
    ["a", [edge]],
    ["b", [edge]],
  ]);
  return campusGraphShell(nodes, edges, adjacency);
}

describe("estimateShadePercentAlongPolyline", () => {
  it("returns high shade when polyline hugs a very shady edge", () => {
    const g = graphOneShadedEdge();
    const line: GeoJSON.LineString = {
      type: "LineString",
      coordinates: [
        [-111.9399, 33.4199],
        [-111.9301, 33.4201],
      ],
    };
    const pct = estimateShadePercentAlongPolyline(line, g, 10);
    expect(pct).toBeGreaterThan(60);
  });
});
