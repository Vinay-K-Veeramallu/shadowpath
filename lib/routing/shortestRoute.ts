import { dijkstra } from "./dijkstra";
import type { CampusGraph, GraphEdge } from "../graph/types";
import type { AccessLevel } from "../graph/types";
import { edgeAllowedForAccess } from "./access";

export interface ShortestRouteResult {
  path: string[];
  edges: GraphEdge[];
  distanceMeters: number;
}

export function shortestRoute(
  graph: CampusGraph,
  startId: string,
  endId: string,
  accessibilityMode = false,
  accessLevel: AccessLevel = "student"
): ShortestRouteResult | null {
  const filter = (e: GraphEdge) => {
    if (!edgeAllowedForAccess(e, accessLevel)) return false;
    if (accessibilityMode && !e.accessible) return false;
    return true;
  };
  const result = dijkstra(graph, startId, endId, (e) => e.distanceMeters, filter);
  if (!result) return null;
  return {
    path: result.path,
    edges: result.edges,
    distanceMeters: result.totalWeight,
  };
}
