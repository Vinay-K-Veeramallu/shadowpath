// Feature: shadow-path, Property 10: Shade slider recomputes routes with correct time snapshot
// Validates: Requirements 6.2

import { test as testProp, fc } from "@fast-check/vitest";
import { computeRoutes } from "../../lib/routing/computeRoutes";
import type { CampusGraph, GraphEdge, GraphNode } from "../../lib/graph/types";
import { edgeShadeFraction01 } from "../../lib/graph/types";
import { campusGraphShell } from "../helpers/graphTestUtils";
import type { TimeSlotHour } from "../../lib/timeSlots";
import type { RouteParams } from "../../lib/routing/types";
import type { WeatherData } from "../../lib/weather/types";

// ---------------------------------------------------------------------------
// Helpers: build a minimal deterministic mock graph
// ---------------------------------------------------------------------------

function buildMockGraph(
  edges: Array<{
    id: string;
    shade10: number;
    shade14: number;
    shade18: number;
    distanceMeters: number;
  }>
): CampusGraph {
  const nodeA: GraphNode = {
    id: "A",
    name: "Node A",
    accessible: true,
    type: "building",
    coordinates: [-111.93, 33.42],
  };
  const nodeB: GraphNode = {
    id: "B",
    name: "Node B",
    accessible: true,
    type: "building",
    coordinates: [-111.92, 33.42],
  };

  const nodes = new Map<string, GraphNode>([
    ["A", nodeA],
    ["B", nodeB],
  ]);

  const graphEdges = new Map<string, GraphEdge>();
  const adjacency = new Map<string, GraphEdge[]>([["A", []], ["B", []]]);

  for (const e of edges) {
    const edge: GraphEdge = {
      id: e.id,
      from: "A",
      to: "B",
      distanceMeters: e.distanceMeters,
      accessible: true,
      surfaceType: "asphalt",
      accessRestriction: "public",
      windCanyonFactor: 1,
      shadeLegacy: { "10": e.shade10, "14": e.shade14, "18": e.shade18 },
      hasCoolingPoint: false,
      hasWaterRefill: false,
      geometry: {
        type: "LineString",
        coordinates: [
          [-111.93, 33.42],
          [-111.92, 33.42],
        ],
      },
    };
    graphEdges.set(e.id, edge);
    adjacency.get("A")!.push(edge);
  }

  return campusGraphShell(nodes, graphEdges, adjacency);
}

const mockWeather: WeatherData = {
  heatIndex: 105,
  temperature: 108,
  relativeHumidity: 18,
  windSpeedMps: 2.2,
  confidence: "Low",
  source: "demo-fallback",
  fetchedAt: null,
};

// ---------------------------------------------------------------------------
// Arbitrary generators
// ---------------------------------------------------------------------------

const arbShade = fc.integer({ min: 0, max: 100 });
const arbDistance = fc.integer({ min: 10, max: 500 });
const arbTime = fc.constantFrom(10 as const, 14 as const, 18 as const);

const arbEdgeSpec = fc.record({
  shade10: arbShade,
  shade14: arbShade,
  shade18: arbShade,
  distanceMeters: arbDistance,
});

const arbRouteParams = fc.record({
  origin: fc.constant("A"),
  destination: fc.constant("B"),
  timeOfDay: arbTime,
  accessibilityMode: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Property 10: Shade slider recomputes routes with correct time snapshot
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------

testProp.prop(
  [
    arbEdgeSpec,
    arbTime,
    arbRouteParams,
  ],
  { numRuns: 100 }
)(
  "shade percentages match distance-weighted shade fractions for the selected time",
  (edgeSpec, time, routeParams) => {
    const graph = buildMockGraph([
      { id: "e1", ...edgeSpec },
    ]);

    const params: RouteParams = { ...routeParams, timeOfDay: time };
    const results = computeRoutes(graph, params, mockWeather);

    if (results.length === 0) return true;

    const slot = time as TimeSlotHour;

    for (const result of results) {
      if (result.edges.length === 0) continue;

      const totalDistance = result.edges.reduce(
        (sum, e) => sum + e.distanceMeters,
        0
      );
      if (totalDistance === 0) continue;

      const expectedShade =
        result.edges.reduce(
          (sum, e) => sum + edgeShadeFraction01(e, slot) * 100 * e.distanceMeters,
          0
        ) / totalDistance;

      // Allow floating-point tolerance
      if (Math.abs(result.shadePercentage - expectedShade) > 0.001) {
        return false;
      }
    }

    return true;
  }
);
