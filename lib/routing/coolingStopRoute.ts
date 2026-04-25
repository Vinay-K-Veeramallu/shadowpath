import { dijkstra } from "./dijkstra";
import { shortestRoute } from "./shortestRoute";
import type { CampusGraph, GraphEdge } from "../graph/types";
import type { AccessLevel } from "../graph/types";
import { edgeAllowedForAccess } from "./access";

const COOLING_BONUS = 200;

export interface CoolingStopRouteResult {
  path: string[];
  edges: GraphEdge[];
  distanceMeters: number;
  coolingStopCount: number;
}

export function coolingStopRoute(
  graph: CampusGraph,
  startId: string,
  endId: string,
  accessibilityMode = false,
  accessLevel: AccessLevel = "student"
): CoolingStopRouteResult | null {
  const shortest = shortestRoute(graph, startId, endId, accessibilityMode, accessLevel);
  if (!shortest) return null;

  const dMin = shortest.distanceMeters;
  const maxDistance = 1.5 * dMin;

  const filter = (e: GraphEdge) => {
    if (!edgeAllowedForAccess(e, accessLevel)) return false;
    if (accessibilityMode && !e.accessible) return false;
    return true;
  };
  const weightFn = (e: GraphEdge) =>
    Math.max(0.01, e.distanceMeters - (e.hasCoolingPoint ? COOLING_BONUS : 0));

  const result = dijkstra(graph, startId, endId, weightFn, filter);

  if (result) {
    const actualDistance = result.edges.reduce((sum, e) => sum + e.distanceMeters, 0);
    if (actualDistance <= maxDistance) {
      const coolingStopCount = result.edges.filter((e) => e.hasCoolingPoint).length;
      return {
        path: result.path,
        edges: result.edges,
        distanceMeters: actualDistance,
        coolingStopCount,
      };
    }
  }

  return {
    path: shortest.path,
    edges: shortest.edges,
    distanceMeters: shortest.distanceMeters,
    coolingStopCount: shortest.edges.filter((e) => e.hasCoolingPoint).length,
  };
}
