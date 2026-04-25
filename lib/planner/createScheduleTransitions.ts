import type { CampusGraph } from "../graph/types";
import type { WeatherData } from "../weather/types";
import type { RouteResult } from "../routing/types";
import { computeRoutes } from "../routing/computeRoutes";
import { mapPreferences } from "./mapPreferences";
import { calculateSegmentHeatRisk } from "./calculateSegmentHeatRisk";
import { recommendCoolingBreaks } from "./recommendCoolingBreaks";
import { recommendWaterStops } from "./recommendWaterStops";
import { recommendShuttleAlternatives } from "./recommendShuttleAlternatives";
import type {
  CampusCommitment,
  PersonalHeatMode,
  RouteSegmentRisk,
  ScheduleTransition,
  ShuttleStop,
} from "./types";
import { commitmentTimeToNearestSlot } from "./commitmentTimeSlot";

/**
 * Selects the best route from computed results based on user preferences.
 *
 * - If preferShadedPaths: pick shade-aware route (if available)
 * - If preferCoolingStops: pick cooling-stop route (if available)
 * - Otherwise: pick shortest route
 * - Falls back to the first available route if the preferred type isn't found.
 */
function selectBestRoute(
  routes: RouteResult[],
  preferences: PersonalHeatMode
): RouteResult | null {
  if (routes.length === 0) return null;

  if (preferences.preferShadedPaths) {
    const shadeRoute = routes.find((r) => r.type.includes("shade-aware"));
    if (shadeRoute) return shadeRoute;
  }

  if (preferences.preferCoolingStops) {
    const coolingRoute = routes.find((r) => r.type.includes("cooling-stop"));
    if (coolingRoute) return coolingRoute;
  }

  // Default: shortest route, or first available
  const shortest = routes.find((r) => r.type.includes("shortest"));
  return shortest ?? routes[0];
}

/** Default segment risk when no route is found */
const DEFAULT_SEGMENT_RISK: RouteSegmentRisk = {
  walkingTimeMinutes: 0,
  sunExposureMinutes: 0,
  shadePercentage: 0,
  coolingAvailability: 0,
  waterAvailability: 0,
  accessibilityCompliant: false,
  confidenceLabel: "Low",
  riskLevel: "not recommended",
};

/**
 * Creates schedule transitions between consecutive campus commitments.
 *
 * 1. Sorts commitments by startTime ascending (string comparison for "HH:MM").
 * 2. For each consecutive pair, computes routes via the Route_Engine, selects
 *    the best route based on preferences, calculates segment risk, and generates
 *    cooling/water/shuttle recommendations.
 * 3. Returns exactly N-1 transitions for N commitments.
 *
 * Pure function (except for calling computeRoutes which reads the graph).
 *
 * @param commitments - Array of 2–5 campus commitments
 * @param graph - The campus graph for routing
 * @param weather - Current weather data
 * @param preferences - Personal heat mode preferences
 * @param shuttleStops - Optional array of shuttle stops for shuttle recommendations
 * @returns Array of ScheduleTransitions (length = commitments.length - 1)
 */
export function createScheduleTransitions(
  commitments: CampusCommitment[],
  graph: CampusGraph,
  weather: WeatherData,
  preferences: PersonalHeatMode,
  shuttleStops: ShuttleStop[] = []
): ScheduleTransition[] {
  // 1. Sort commitments by startTime ascending (HH:MM string comparison works)
  const sorted = [...commitments].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  const transitions: ScheduleTransition[] = [];

  // 2. For each consecutive pair, compute the transition
  for (let i = 0; i < sorted.length - 1; i++) {
    const origin = sorted[i];
    const destination = sorted[i + 1];

    const legTimeSlot = commitmentTimeToNearestSlot(origin.startTime);

    const params = mapPreferences(
      preferences,
      origin.location,
      destination.location,
      legTimeSlot
    );

    // Compute routes via the existing Route_Engine
    const routes = computeRoutes(graph, params, weather);

    // Select the best route based on preferences
    const bestRoute = selectBestRoute(routes, preferences);

    // Calculate segment risk
    const segmentRisk = bestRoute
      ? calculateSegmentHeatRisk(bestRoute, weather)
      : DEFAULT_SEGMENT_RISK;

    // Build a partial transition for recommendation functions
    const transition: ScheduleTransition = {
      origin,
      destination,
      routeResult: bestRoute,
      segmentRisk,
      coolingRecommendation: null,
      waterRecommendation: null,
      shuttleAlternative: null,
    };

    // Generate recommendations
    transition.coolingRecommendation = recommendCoolingBreaks(
      transition,
      graph
    );
    transition.waterRecommendation = recommendWaterStops(transition, graph);
    transition.shuttleAlternative = recommendShuttleAlternatives(
      transition,
      shuttleStops,
      preferences
    );

    transitions.push(transition);
  }

  return transitions;
}
