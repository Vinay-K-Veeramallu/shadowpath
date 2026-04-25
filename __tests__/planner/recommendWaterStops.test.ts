// Feature: heatshield-planner, Property 13
// Validates: Requirements 8.3, 8.4

import { describe, expect } from "vitest";
import { test as testProp, fc } from "@fast-check/vitest";
import { recommendWaterStops } from "../../lib/planner/recommendWaterStops";
import type {
  ScheduleTransition,
  CampusCommitment,
  RouteSegmentRisk,
  RiskLevel,
} from "../../lib/planner/types";
import type { RouteResult } from "../../lib/routing/types";
import type { CampusGraph, GraphNode, GraphEdge } from "../../lib/graph/types";
import { makeRouteResult as fullRouteResult, campusGraphShell } from "../helpers/graphTestUtils";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const riskLevelArb: fc.Arbitrary<RiskLevel> = fc.constantFrom(
  "lower-risk" as const,
  "higher-risk" as const,
  "not recommended" as const,
);

const segmentRiskArb: fc.Arbitrary<RouteSegmentRisk> = fc
  .record({
    walkingTimeMinutes: fc.float({ min: 0, max: 120, noNaN: true }),
    sunExposureMinutes: fc.float({ min: 0, max: 120, noNaN: true }),
    shadePercentage: fc.float({ min: 0, max: 100, noNaN: true }),
    coolingAvailability: fc.integer({ min: 0, max: 10 }),
    waterAvailability: fc.integer({ min: 0, max: 10 }),
    accessibilityCompliant: fc.boolean(),
    confidenceLabel: fc.constantFrom(
      "High" as const,
      "Medium" as const,
      "Low" as const,
    ),
    riskLevel: riskLevelArb,
  })
  .map((r) => r as RouteSegmentRisk);

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

// ---------------------------------------------------------------------------
// Graph + transition builders
// ---------------------------------------------------------------------------

/** Base coordinates near ASU campus */
const BASE_LNG = -111.93;
const BASE_LAT = 33.42;

/** Create a GraphNode at a small offset from the base coordinates */
function makeNode(
  id: string,
  name: string,
  type: GraphNode["type"],
  lngOffset = 0,
  latOffset = 0,
): GraphNode {
  return {
    id,
    name,
    accessible: true,
    type,
    coordinates: [BASE_LNG + lngOffset, BASE_LAT + latOffset],
  };
}

/** Create a minimal GraphEdge between two node IDs */
function makeEdge(from: string, to: string): GraphEdge {
  return {
    id: `${from}-${to}`,
    from,
    to,
    distanceMeters: 100,
    accessible: true,
    surfaceType: "asphalt",
    accessRestriction: "public",
    windCanyonFactor: 1,
    shadeLegacy: { "10": 50, "14": 30, "18": 60 },
    hasCoolingPoint: false,
    hasWaterRefill: false,
    geometry: { type: "LineString", coordinates: [] },
  };
}

/** Build a CampusGraph from arrays of nodes and edges */
function buildTestGraph(nodes: GraphNode[], edges: GraphEdge[]): CampusGraph {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const edgeMap = new Map<string, GraphEdge>();
  const adjacency = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    edgeMap.set(e.id, e);
    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    adjacency.get(e.from)!.push(e);
  }

  return campusGraphShell(nodeMap, edgeMap, adjacency);
}

/** Create a RouteResult whose path goes through the given node IDs */
function routeResultForPath(path: string[]): RouteResult {
  return fullRouteResult({ path });
}

/** Build a transition with a given risk level and route path */
function makeTransition(
  riskLevel: RiskLevel,
  path: string[],
): ScheduleTransition {
  return {
    origin: { location: path[0], startTime: "10:00", flexibility: "fixed", label: "Origin" },
    destination: {
      location: path[path.length - 1],
      startTime: "11:00",
      flexibility: "fixed",
      label: "Dest",
    },
    routeResult: routeResultForPath(path),
    segmentRisk: {
      walkingTimeMinutes: 10,
      sunExposureMinutes: 6,
      shadePercentage: 40,
      coolingAvailability: 0,
      waterAvailability: 0,
      accessibilityCompliant: true,
      confidenceLabel: "High",
      riskLevel,
    },
    coolingRecommendation: null,
    waterRecommendation: null,
    shuttleAlternative: null,
  };
}

// ---------------------------------------------------------------------------
// Property 13: Valid water recommendation fields
// Validates: Requirements 8.3, 8.4
// ---------------------------------------------------------------------------

describe("recommendWaterStops – P13: valid water recommendation fields", () => {
  // Graph with at least one water_refill node, used for property tests
  const graphWithWaterArb: fc.Arbitrary<{
    graph: CampusGraph;
    transition: ScheduleTransition;
  }> = fc
    .record({
      riskLevel: riskLevelArb,
      waterLngOffset: fc.float({ min: Math.fround(-0.001), max: Math.fround(0.001), noNaN: true }),
      waterLatOffset: fc.float({ min: Math.fround(-0.001), max: Math.fround(0.001), noNaN: true }),
    })
    .map(({ riskLevel, waterLngOffset, waterLatOffset }) => {
      const b1 = makeNode("b1", "Building 1", "building", 0, 0);
      const b2 = makeNode("b2", "Building 2", "building", 0.001, 0);
      const wp = makeNode(
        "wp1",
        "Test Water Fountain",
        "water_refill",
        waterLngOffset,
        waterLatOffset,
      );
      const edge = makeEdge("b1", "b2");
      const graph = buildTestGraph([b1, b2, wp], [edge]);
      const transition = makeTransition(riskLevel, ["b1", "b2"]);
      return { graph, transition };
    });

  testProp.prop([graphWithWaterArb], { numRuns: 100 })(
    "returns a recommendation with non-empty waterPointName when water refill points exist",
    ({ graph, transition }) => {
      const result = recommendWaterStops(transition, graph);

      expect(result).not.toBeNull();
      expect(result!.waterPointName).toBeTruthy();
      expect(result!.waterPointName.length).toBeGreaterThan(0);
    },
  );

  testProp.prop([graphWithWaterArb], { numRuns: 100 })(
    "distanceFromRouteMeters is non-negative",
    ({ graph, transition }) => {
      const result = recommendWaterStops(transition, graph);

      expect(result).not.toBeNull();
      expect(result!.distanceFromRouteMeters).toBeGreaterThanOrEqual(0);
    },
  );
});

// ---------------------------------------------------------------------------
// Null cases: no water refill points or no route
// ---------------------------------------------------------------------------

describe("recommendWaterStops – null cases", () => {
  testProp.prop([riskLevelArb, segmentRiskArb], { numRuns: 100 })(
    "returns null when graph has no water refill points",
    (riskLevel, segmentRisk) => {
      const b1 = makeNode("b1", "Building 1", "building", 0, 0);
      const b2 = makeNode("b2", "Building 2", "building", 0.001, 0);
      const graph = buildTestGraph([b1, b2], [makeEdge("b1", "b2")]);
      const transition = makeTransition(riskLevel, ["b1", "b2"]);
      transition.segmentRisk = { ...segmentRisk, riskLevel };

      const result = recommendWaterStops(transition, graph);
      expect(result).toBeNull();
    },
  );

  testProp.prop([riskLevelArb], { numRuns: 100 })(
    "returns null when transition has no routeResult",
    (riskLevel) => {
      const b1 = makeNode("b1", "Building 1", "building", 0, 0);
      const wp = makeNode("wp1", "Water Fountain", "water_refill", 0.001, 0);
      const graph = buildTestGraph([b1, wp], []);
      const transition = makeTransition(riskLevel, ["b1"]);
      transition.routeResult = null;

      const result = recommendWaterStops(transition, graph);
      expect(result).toBeNull();
    },
  );
});
