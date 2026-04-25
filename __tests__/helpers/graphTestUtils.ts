import type { CampusGraph, GraphEdge, GraphNode } from "../../lib/graph/types";
import type { RouteResult } from "../../lib/routing/types";
import type { UtciStress } from "../../lib/comfort/utci";

export function campusGraphShell(
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge>,
  adjacency: Map<string, GraphEdge[]>
): CampusGraph {
  return { nodes, edges, adjacency, buildings: [], trees: [], entrances: [] };
}

/** Minimal valid edge for routing tests. */
export function makeRouteResult(overrides: Partial<RouteResult> = {}): RouteResult {
  const base: RouteResult = {
    type: ["shortest"],
    path: ["a", "b"],
    edges: [],
    distanceMeters: 400,
    durationMinutes: 5,
    shadePercentage: 50,
    sunExposureMinutes: 2,
    coolingStopCount: 0,
    waterStationCount: 0,
    coolingZoneCount: 0,
    exposureScore: 40,
    confidenceLabel: "High",
    safetyVerdict: "lower-risk",
    averageUtciC: 28,
    utciStress: "no-stress" as UtciStress,
    utciStressLabel: "No thermal stress",
    indoorMeters: 0,
    dataSources: [],
    assumptions: [],
    geometry: { type: "FeatureCollection", features: [] },
  };
  return { ...base, ...overrides };
}

export function makeEdge(
  base: Pick<GraphEdge, "id" | "from" | "to"> & Partial<GraphEdge>
): GraphEdge {
  return {
    distanceMeters: 100,
    accessible: true,
    surfaceType: "asphalt",
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
    shadeLegacy: { "10": 50, "14": 50, "18": 50 },
    ...base,
  };
}
