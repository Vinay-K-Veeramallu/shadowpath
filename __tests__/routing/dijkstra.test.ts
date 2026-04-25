import { describe, it, expect } from "vitest";
import { dijkstra } from "../../lib/routing/dijkstra";
import type { CampusGraph, GraphEdge, GraphNode } from "../../lib/graph/types";
import { campusGraphShell } from "../helpers/graphTestUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, accessible = true): GraphNode {
  return {
    id,
    name: id,
    accessible,
    type: "intersection",
    coordinates: [0, 0],
  };
}

function makeEdge(
  id: string,
  from: string,
  to: string,
  distanceMeters: number,
  accessible = true
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

/**
 * Build a CampusGraph from a list of nodes and undirected edges.
 * Each edge is added to the adjacency list for both endpoints.
 */
function buildGraph(nodes: GraphNode[], edges: GraphEdge[]): CampusGraph {
  const nodeMap = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map<string, GraphEdge>(edges.map((e) => [e.id, e]));
  const adjacency = new Map<string, GraphEdge[]>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.from)!.push(edge);
    adjacency.get(edge.to)!.push(edge);
  }

  return campusGraphShell(nodeMap, edgeMap, adjacency);
}

const distWeight = (e: GraphEdge) => e.distanceMeters;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("dijkstra", () => {
  it("returns null when startId does not exist in the graph", () => {
    const graph = buildGraph([makeNode("A"), makeNode("B")], [makeEdge("e1", "A", "B", 10)]);
    expect(dijkstra(graph, "X", "B", distWeight)).toBeNull();
  });

  it("returns null when endId does not exist in the graph", () => {
    const graph = buildGraph([makeNode("A"), makeNode("B")], [makeEdge("e1", "A", "B", 10)]);
    expect(dijkstra(graph, "A", "Z", distWeight)).toBeNull();
  });

  it("returns null when no path exists between nodes", () => {
    // A-B and C-D are disconnected components
    const graph = buildGraph(
      [makeNode("A"), makeNode("B"), makeNode("C"), makeNode("D")],
      [makeEdge("e1", "A", "B", 5), makeEdge("e2", "C", "D", 5)]
    );
    expect(dijkstra(graph, "A", "D", distWeight)).toBeNull();
  });

  it("returns trivial path when start === end", () => {
    const graph = buildGraph([makeNode("A"), makeNode("B")], [makeEdge("e1", "A", "B", 10)]);
    const result = dijkstra(graph, "A", "A", distWeight);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["A"]);
    expect(result!.edges).toHaveLength(0);
    expect(result!.totalWeight).toBe(0);
  });

  it("finds the direct path between two connected nodes", () => {
    const graph = buildGraph(
      [makeNode("A"), makeNode("B")],
      [makeEdge("e1", "A", "B", 42)]
    );
    const result = dijkstra(graph, "A", "B", distWeight);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["A", "B"]);
    expect(result!.edges).toHaveLength(1);
    expect(result!.totalWeight).toBe(42);
  });

  it("finds the shortest path in a simple triangle graph", () => {
    // A --10-- B --10-- C
    //  \______20_______/
    const graph = buildGraph(
      [makeNode("A"), makeNode("B"), makeNode("C")],
      [
        makeEdge("e1", "A", "B", 10),
        makeEdge("e2", "B", "C", 10),
        makeEdge("e3", "A", "C", 20),
      ]
    );
    const result = dijkstra(graph, "A", "C", distWeight);
    expect(result).not.toBeNull();
    // A→B→C (cost 20) ties with A→C (cost 20); either is valid
    expect(result!.totalWeight).toBe(20);
    expect(result!.path[0]).toBe("A");
    expect(result!.path[result!.path.length - 1]).toBe("C");
  });

  it("prefers the cheaper path when two routes have different costs", () => {
    // A --1-- B --1-- C
    //  \______10______/
    const graph = buildGraph(
      [makeNode("A"), makeNode("B"), makeNode("C")],
      [
        makeEdge("e1", "A", "B", 1),
        makeEdge("e2", "B", "C", 1),
        makeEdge("e3", "A", "C", 10),
      ]
    );
    const result = dijkstra(graph, "A", "C", distWeight);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["A", "B", "C"]);
    expect(result!.totalWeight).toBe(2);
  });

  it("works with a custom weight function", () => {
    // Use inverse distance as weight so the longer edge is cheaper
    const graph = buildGraph(
      [makeNode("A"), makeNode("B"), makeNode("C")],
      [
        makeEdge("e1", "A", "B", 1),
        makeEdge("e2", "B", "C", 1),
        makeEdge("e3", "A", "C", 100),
      ]
    );
    // Weight = 1 / distanceMeters → longer edge has lower weight
    const result = dijkstra(graph, "A", "C", (e) => 1 / e.distanceMeters);
    expect(result).not.toBeNull();
    // A→C direct: weight = 1/100 = 0.01
    // A→B→C: weight = 1/1 + 1/1 = 2
    expect(result!.path).toEqual(["A", "C"]);
  });

  it("respects the filter predicate and skips excluded edges", () => {
    // A --accessible-- B --inaccessible-- C
    //  \___accessible_____________________/  (longer)
    const edgeAB = makeEdge("e1", "A", "B", 1, true);
    const edgeBC = makeEdge("e2", "B", "C", 1, false); // inaccessible
    const edgeAC = makeEdge("e3", "A", "C", 5, true);

    const graph = buildGraph(
      [makeNode("A"), makeNode("B"), makeNode("C")],
      [edgeAB, edgeBC, edgeAC]
    );

    const accessibleOnly = (e: GraphEdge) => e.accessible;
    const result = dijkstra(graph, "A", "C", distWeight, accessibleOnly);

    expect(result).not.toBeNull();
    // Must use A→C directly since A→B→C is blocked
    expect(result!.path).toEqual(["A", "C"]);
    expect(result!.edges.every((e) => e.accessible)).toBe(true);
  });

  it("returns null when filter blocks all paths", () => {
    const edgeAB = makeEdge("e1", "A", "B", 1, false);
    const graph = buildGraph([makeNode("A"), makeNode("B")], [edgeAB]);
    const result = dijkstra(graph, "A", "B", distWeight, (e) => e.accessible);
    expect(result).toBeNull();
  });

  it("handles bidirectional traversal (edge.to → edge.from direction)", () => {
    // Edge is defined from A to B; we query B to A
    const graph = buildGraph(
      [makeNode("A"), makeNode("B")],
      [makeEdge("e1", "A", "B", 7)]
    );
    const result = dijkstra(graph, "B", "A", distWeight);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["B", "A"]);
    expect(result!.totalWeight).toBe(7);
  });

  it("returns correct ordered edges array", () => {
    const e1 = makeEdge("e1", "A", "B", 1);
    const e2 = makeEdge("e2", "B", "C", 2);
    const e3 = makeEdge("e3", "C", "D", 3);
    const graph = buildGraph(
      [makeNode("A"), makeNode("B"), makeNode("C"), makeNode("D")],
      [e1, e2, e3]
    );
    const result = dijkstra(graph, "A", "D", distWeight);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["A", "B", "C", "D"]);
    expect(result!.edges.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    expect(result!.totalWeight).toBe(6);
  });
});
