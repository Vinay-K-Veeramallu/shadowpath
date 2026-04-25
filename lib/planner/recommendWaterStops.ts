import type { CampusGraph, GraphNode } from "../graph/types";
import type { ScheduleTransition, WaterRecommendation } from "./types";

/**
 * Calculates the Euclidean distance in meters between two [lng, lat] coordinate pairs.
 * Uses a simple equirectangular approximation suitable for short campus distances.
 */
function approximateDistanceMeters(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6_371_000; // Earth radius in meters
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const avgLat = ((a[1] + b[1]) / 2 * Math.PI) / 180;
  const dx = dLng * Math.cos(avgLat) * R;
  const dy = dLat * R;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Finds the nearest water refill point to the transition route and returns a recommendation.
 *
 * Pure function — no side effects.
 *
 * @param transition - The schedule transition to find water for
 * @param graph - The campus graph containing water refill nodes
 * @returns WaterRecommendation or null if no water refills nearby
 */
export function recommendWaterStops(
  transition: ScheduleTransition,
  graph: CampusGraph
): WaterRecommendation | null {
  // Collect all water refill nodes from the graph
  const waterPoints: GraphNode[] = [];
  const nodeValues = Array.from(graph.nodes.values());
  for (const node of nodeValues) {
    if (node.type === "water_refill") {
      waterPoints.push(node);
    }
  }

  if (waterPoints.length === 0) {
    return null;
  }

  // If no route result, we can't determine proximity — return null
  if (!transition.routeResult) {
    return null;
  }

  // Collect all node IDs along the route path
  const routeNodeIds = transition.routeResult.path;

  // Find the nearest water refill point to any node on the route
  let bestDistance = Infinity;
  let bestWaterPoint: GraphNode | null = null;

  for (const waterPoint of waterPoints) {
    for (const nodeId of routeNodeIds) {
      const routeNode = graph.nodes.get(nodeId);
      if (!routeNode) continue;

      const distance = approximateDistanceMeters(
        routeNode.coordinates,
        waterPoint.coordinates
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestWaterPoint = waterPoint;
      }
    }
  }

  if (!bestWaterPoint) {
    return null;
  }

  return {
    waterPointName: bestWaterPoint.name,
    distanceFromRouteMeters: Math.round(bestDistance),
  };
}
