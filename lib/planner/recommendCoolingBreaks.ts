import type { CampusGraph, GraphNode } from "../graph/types";
import type { CoolingRecommendation, RiskLevel, ScheduleTransition } from "./types";

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
 * Maps a risk level to a suggested cooling break duration in minutes.
 * Higher risk → longer break.
 */
function breakMinutesForRisk(riskLevel: RiskLevel): number {
  switch (riskLevel) {
    case "lower-risk":
      return 5;
    case "higher-risk":
      return 10;
    case "not recommended":
      return 15;
  }
}

/**
 * Generates a human-readable reason string based on the risk level.
 */
function reasonForRisk(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "lower-risk":
      return "Moderate sun exposure on this segment";
    case "higher-risk":
      return "High sun exposure on this segment";
    case "not recommended":
      return "Very high sun exposure on this segment";
  }
}

/**
 * Finds the nearest cooling point to the transition route and returns a recommendation.
 *
 * Pure function — no side effects.
 *
 * @param transition - The schedule transition to find cooling for
 * @param graph - The campus graph containing cooling point nodes
 * @returns CoolingRecommendation or null if no cooling points exist in the graph
 */
export function recommendCoolingBreaks(
  transition: ScheduleTransition,
  graph: CampusGraph
): CoolingRecommendation | null {
  // Collect all cooling point nodes from the graph
  const coolingPoints: GraphNode[] = [];
  const nodeValues = Array.from(graph.nodes.values());
  for (const node of nodeValues) {
    if (node.type === "cooling_point") {
      coolingPoints.push(node);
    }
  }

  if (coolingPoints.length === 0) {
    return null;
  }

  // If no route result, we can't determine proximity — return null
  if (!transition.routeResult) {
    return null;
  }

  // Collect all node IDs along the route path
  const routeNodeIds = transition.routeResult.path;

  // Find the nearest cooling point to any node on the route
  let bestDistance = Infinity;
  let bestCoolingPoint: GraphNode | null = null;

  for (const coolingPoint of coolingPoints) {
    for (const nodeId of routeNodeIds) {
      const routeNode = graph.nodes.get(nodeId);
      if (!routeNode) continue;

      const distance = approximateDistanceMeters(
        routeNode.coordinates,
        coolingPoint.coordinates
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestCoolingPoint = coolingPoint;
      }
    }
  }

  if (!bestCoolingPoint) {
    return null;
  }

  const riskLevel = transition.segmentRisk.riskLevel;

  return {
    coolingPointName: bestCoolingPoint.name,
    distanceFromRouteMeters: Math.round(bestDistance),
    suggestedBreakMinutes: breakMinutesForRisk(riskLevel),
    reason: reasonForRisk(riskLevel),
  };
}
