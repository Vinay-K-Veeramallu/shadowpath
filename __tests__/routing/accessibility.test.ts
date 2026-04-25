// Feature: shadow-path, Property 1: Accessibility mode excludes inaccessible edges

import { test as testProp, fc } from "@fast-check/vitest";
import { dijkstra } from "../../lib/routing/dijkstra";
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
  accessible: boolean
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
    shadeLegacy: { "10": 0, "14": 0, "18": 0 },
    hasCoolingPoint: false,
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
// Arbitrary: graph with mixed accessible flags + guaranteed accessible chain
// ---------------------------------------------------------------------------

/**
 * Generates a graph with:
 * - 3–6 nodes (IDs: "n0", "n1", …)
 * - 3–8 random edges with random accessible boolean
 * - A guaranteed accessible chain from n0 → n1 → … → nLast
 *   so there is always at least one accessible path.
 */
const arbGraph = fc
  .integer({ min: 3, max: 6 })
  .chain((nodeCount) => {
    const nodeIds = Array.from({ length: nodeCount }, (_, i) => `n${i}`);
    const lastId = nodeIds[nodeIds.length - 1];

    // Random extra edges (may or may not be accessible)
    const arbExtraEdges = fc.array(
      fc
        .tuple(
          fc.integer({ min: 0, max: nodeCount - 1 }),
          fc.integer({ min: 0, max: nodeCount - 1 }),
          fc.boolean()
        )
        .filter(([a, b]) => a !== b),
      { minLength: 3, maxLength: 8 }
    );

    return arbExtraEdges.map((extraEdges) => {
      const nodes = nodeIds.map(makeNode);

      // Guaranteed accessible chain: n0 → n1 → n2 → … → nLast
      const chainEdges: GraphEdge[] = [];
      for (let i = 0; i < nodeIds.length - 1; i++) {
        chainEdges.push(
          makeEdge(`chain-${i}`, nodeIds[i], nodeIds[i + 1], 10, true)
        );
      }

      // Extra random edges (deduplicated by id)
      const seen = new Set<string>();
      const randomEdges: GraphEdge[] = [];
      extraEdges.forEach(([a, b, accessible], idx) => {
        const edgeId = `rand-${idx}`;
        if (!seen.has(edgeId)) {
          seen.add(edgeId);
          randomEdges.push(
            makeEdge(edgeId, nodeIds[a], nodeIds[b], 10 + idx, accessible)
          );
        }
      });

      const allEdges = [...chainEdges, ...randomEdges];
      const graph = buildGraph(nodes, allEdges);

      return { graph, startId: "n0", endId: lastId };
    });
  });

// ---------------------------------------------------------------------------
// Property 1: Accessibility mode excludes inaccessible edges
// Validates: Requirements 1.5, 11.4
// ---------------------------------------------------------------------------

testProp.prop([arbGraph], { numRuns: 100 })(
  "every edge in the returned route has accessible === true when filter is applied",
  ({ graph, startId, endId }) => {
    const accessibilityFilter = (edge: GraphEdge) => edge.accessible === true;

    const result = dijkstra(
      graph,
      startId,
      endId,
      (edge) => edge.distanceMeters,
      accessibilityFilter
    );

    // A guaranteed accessible chain exists, so result must not be null
    if (result === null) {
      throw new Error(
        `Expected a path to exist (guaranteed accessible chain from ${startId} to ${endId})`
      );
    }

    // Every edge in the returned route must be accessible
    for (const edge of result.edges) {
      if (edge.accessible !== true) {
        return false;
      }
    }

    return true;
  }
);
