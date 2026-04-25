import { dijkstra } from "./dijkstra";
import type { CampusGraph, GraphEdge, AccessLevel } from "../graph/types";
import {
  computeEdgeComfort,
  type EdgeWeatherSnapshot,
} from "../comfort/edgeComfort";
import type { TimeSlotHour } from "../timeSlots";
import { edgeAllowedForAccess } from "./access";

export interface ComfortWeights {
  distance: number;
  comfort: number;
  indoor: number;
}

export const DEFAULT_COMFORT_WEIGHTS: ComfortWeights = {
  distance: 0.4,
  comfort: 0.5,
  indoor: 0.1,
};

export const COMFORT_DETOUR_LIMIT = 2.0;

const PENALTY_SCALE_METERS = 100;
const INDOOR_BONUS_METERS = 55;

export interface ComfortAwareRouteResult {
  path: string[];
  edges: GraphEdge[];
  distanceMeters: number;
  indoorMeters: number;
  weights: ComfortWeights;
}

export function comfortAwareRoute(
  graph: CampusGraph,
  startId: string,
  endId: string,
  timeSlot: TimeSlotHour,
  weather: EdgeWeatherSnapshot,
  accessibilityMode = false,
  weights: ComfortWeights = DEFAULT_COMFORT_WEIGHTS,
  accessLevel: AccessLevel = "student"
): ComfortAwareRouteResult | null {
  const filter = (e: GraphEdge) => {
    if (!edgeAllowedForAccess(e, accessLevel)) return false;
    if (accessibilityMode && !e.accessible) return false;
    return true;
  };

  const weightFn = (edge: GraphEdge): number => {
    const comfort = computeEdgeComfort(edge, timeSlot, weather);
    const outdoorHot = comfort.utciC > 32 && !comfort.isIndoor;
    const amenityRelief =
      (edge.hasCoolingPoint ? 48 : 0) + (edge.hasWaterRefill ? 14 : 0);

    const distanceTerm = weights.distance * edge.distanceMeters;
    const comfortTerm =
      weights.comfort * comfort.stressPenalty * PENALTY_SCALE_METERS;
    const indoorBonus =
      comfort.isIndoor ? weights.indoor * INDOOR_BONUS_METERS : 0;
    const amenityBonus = outdoorHot ? weights.comfort * amenityRelief : 0;

    return Math.max(0.01, distanceTerm + comfortTerm - indoorBonus - amenityBonus);
  };

  const result = dijkstra(graph, startId, endId, weightFn, filter);
  if (!result) return null;

  const distanceMeters = result.edges.reduce((sum, e) => sum + e.distanceMeters, 0);
  const indoorMeters = result.edges
    .filter((e) => e.isIndoor === true)
    .reduce((sum, e) => sum + e.distanceMeters, 0);

  return {
    path: result.path,
    edges: result.edges,
    distanceMeters,
    indoorMeters,
    weights,
  };
}
