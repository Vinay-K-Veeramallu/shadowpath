import { dijkstra } from "./dijkstra";
import type { CampusGraph, GraphEdge } from "../graph/types";
import { edgeShadeFraction01 } from "../graph/types";
import type { TimeSlotHour } from "../timeSlots";
import { edgeAllowedForAccess } from "./access";
import type { AccessLevel } from "../graph/types";

export interface ShadeAwareRouteResult {
  path: string[];
  edges: GraphEdge[];
  distanceMeters: number;
  shadePercentage: number;
}

export function shadeAwareRoute(
  graph: CampusGraph,
  startId: string,
  endId: string,
  timeSlot: TimeSlotHour,
  accessibilityMode = false,
  accessLevel: AccessLevel = "student"
): ShadeAwareRouteResult | null {
  const filter = (e: GraphEdge) => {
    if (!edgeAllowedForAccess(e, accessLevel)) return false;
    if (accessibilityMode && !e.accessible) return false;
    return true;
  };
  const weightFn = (e: GraphEdge) =>
    e.distanceMeters * (1 - edgeShadeFraction01(e, timeSlot)) + 0.01;
  const result = dijkstra(graph, startId, endId, weightFn, filter);
  if (!result) return null;

  const totalDistance = result.edges.reduce((sum, e) => sum + e.distanceMeters, 0);
  const shadePercentage =
    totalDistance > 0
      ? (result.edges.reduce(
          (sum, e) => sum + edgeShadeFraction01(e, timeSlot) * 100 * e.distanceMeters,
          0
        ) /
          totalDistance)
      : 0;

  return {
    path: result.path,
    edges: result.edges,
    distanceMeters: result.edges.reduce((sum, e) => sum + e.distanceMeters, 0),
    shadePercentage,
  };
}
