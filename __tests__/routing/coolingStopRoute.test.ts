// Feature: shadow-path, Property 6: Cooling-stop route respects distance constraint

import { test as testProp, fc } from "@fast-check/vitest";
import { shortestRoute } from "../../lib/routing/shortestRoute";
import { coolingStopRoute } from "../../lib/routing/coolingStopRoute";
import type { CampusGraph, GraphEdge, GraphNode } from "../../lib/graph/types";
import { campusGraphShell } from "../helpers/graphTestUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string): GraphNode {
  return {
    id,
    name: id,
    accessible: true,
    type: "intersection",
    coordinates: [0, 0],
  };
}

function makeEdge(
  id: string,
  from: string,
  to: string,
  distanceMeters: number,
  accessible: boolean,
  shade10: number,
  shade14: number,
  shade18: number,
  hasCoolingPoint: boolean
): GraphEdge {
  return {
    id,
    from,
    to,
    distanceMeters,
    accessible,
    surfaceType: "asphalt",
    accessRestriction: "public",
    windCanyonFactor: 1,
    shadeLegacy: { "10": shade10, "14": shade14, "18": shade18 },
    hasCoolingPoint,
    hasWaterRefill: false,
    geometry: { type: "LineString", coordinates: [] },
  };
}

function buildGraph(nodes: GraphNode[], edges: GraphEdge[]): CampusGraph {
  const nodeMap = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map<string, GraphEdge>(edges.map((e) => [e.id, e]));
  const adjacency = new Map<string, GraphEdge[]>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge);
    adjacency.get(edge.to)?.push(edge);
  }

  return campusGraphShell(nodeMap, edgeMap, adjacency);
}

// ---------------------------------------------------------------------------
// Arbitrary: connected graph
// ---------------------------------------------------------------------------

const arbConnectedGraph = fc.integer({ min: 3, max: 6 }).chain((nodeCount) => {
  const nodeIds = Array.from({ length: nodeCount }, (_, i) => `n${i}`);
  return fc
    .array(
      fc
        .tuple(
          fc.integer({ min: 0, max: nodeCount - 1 }),
          fc.integer({ min: 0, max: nodeCount - 1 }),
          fc.integer({ min: 10, max: 500 }), // distanceMeters
          fc.integer({ min: 0, max: 100 }), // shade10
          fc.integer({ min: 0, max: 100 }), // shade14
          fc.integer({ min: 0, max: 100 }), // shade18
          fc.boolean() // hasCoolingPoint
        )
        .filter(([a, b]) => a !== b),
      { minLength: 2, maxLength: 6 }
    )
    .map((extraEdges) => {
      const nodes = nodeIds.map(makeNode);
      // Guaranteed chain
      const chainEdges = nodeIds.slice(0, -1).map((id, i) =>
        makeEdge(`chain-${i}`, id, nodeIds[i + 1], 100, true, 50, 30, 60, false)
      );
      const randomEdges = extraEdges.map(([a, b, dist, s10, s14, s18, cooling], idx) =>
        makeEdge(`rand-${idx}`, nodeIds[a], nodeIds[b], dist, true, s10, s14, s18, cooling)
      );
      return {
        graph: buildGraph(nodes, [...chainEdges, ...randomEdges]),
        startId: "n0",
        endId: nodeIds[nodeIds.length - 1],
      };
    });
});

// ---------------------------------------------------------------------------
// Property 6: Cooling-stop route respects distance constraint
// Validates: Requirements 3.4
// ---------------------------------------------------------------------------

testProp.prop([arbConnectedGraph], { numRuns: 100 })(
  "cooling-stop route distance is <= 1.5 * shortest route distance",
  ({ graph, startId, endId }) => {
    const shortest = shortestRoute(graph, startId, endId);
    if (!shortest) return true; // no path — skip

    const cooling = coolingStopRoute(graph, startId, endId);
    if (!cooling) return true; // no path — skip

    return cooling.distanceMeters <= 1.5 * shortest.distanceMeters + 1e-9;
  }
);
