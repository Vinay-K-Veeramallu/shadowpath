import type {
  PersonalHeatMode,
  ScheduleTransition,
  ShuttleAlternative,
  ShuttleStop,
} from "./types";

/**
 * Maximum walking distance (in meters) to consider a shuttle stop reachable.
 */
const MAX_SHUTTLE_DISTANCE_METERS = 500;

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
  const avgLat = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const dx = dLng * Math.cos(avgLat) * R;
  const dy = dLat * R;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Extracts the origin coordinates from a transition's route result.
 * Uses the first coordinate of the first edge's geometry LineString.
 *
 * Returns null if no route result or no edges are available.
 */
function getOriginCoordinates(
  transition: ScheduleTransition
): [number, number] | null {
  if (
    !transition.routeResult ||
    !transition.routeResult.edges ||
    transition.routeResult.edges.length === 0
  ) {
    return null;
  }

  const firstEdge = transition.routeResult.edges[0];
  const coords = firstEdge.geometry.coordinates;
  if (!coords || coords.length === 0) {
    return null;
  }

  return coords[0] as [number, number];
}

/**
 * Finds the nearest shuttle stop within 500 meters of the transition origin.
 *
 * Pure function — no side effects.
 *
 * @param transition - The schedule transition
 * @param shuttleStops - Array of shuttle stops from the GeoJSON dataset
 * @param preferences - Personal heat mode preferences (for accessibility filtering)
 * @returns ShuttleAlternative or null if no stop within 500m
 */
export function recommendShuttleAlternatives(
  transition: ScheduleTransition,
  shuttleStops: ShuttleStop[],
  preferences: PersonalHeatMode
): ShuttleAlternative | null {
  if (shuttleStops.length === 0) {
    return null;
  }

  const originCoords = getOriginCoordinates(transition);
  if (!originCoords) {
    return null;
  }

  // Filter by accessibility when wheelchair preference is enabled
  const candidates = preferences.wheelchairAccessible
    ? shuttleStops.filter((stop) => stop.accessible)
    : shuttleStops;

  let bestDistance = Infinity;
  let bestStop: ShuttleStop | null = null;

  for (const stop of candidates) {
    const distance = approximateDistanceMeters(originCoords, stop.coordinates);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestStop = stop;
    }
  }

  if (!bestStop || bestDistance > MAX_SHUTTLE_DISTANCE_METERS) {
    return null;
  }

  return {
    shuttleStopName: bestStop.name,
    estimatedWaitMinutes: bestStop.estimatedWaitMinutes,
    walkingDistanceMeters: Math.round(bestDistance),
    accessible: bestStop.accessible,
  };
}
