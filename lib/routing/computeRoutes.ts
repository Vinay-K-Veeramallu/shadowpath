import type { CampusGraph, GraphEdge } from "../graph/types";
import { edgeShadeFraction01 } from "../graph/types";
import type { WeatherData } from "../weather/types";
import type { RouteParams, RouteResult, RouteType } from "./types";
import { shortestRoute } from "./shortestRoute";
import { shadeAwareRoute } from "./shadeAwareRoute";
import { coolingStopRoute } from "./coolingStopRoute";
import {
  comfortAwareRoute,
  DEFAULT_COMFORT_WEIGHTS,
} from "./comfortAwareRoute";
import { computeExposureScore } from "./exposureScore";
import { evaluateSafetyFromUtci } from "./heatSafetyGate";
import { averageUtci } from "../comfort/edgeComfort";
import { utciStressCategory, utciStressLabel } from "../comfort/utci";
import { attachShadeForDatetime } from "../shadow/shadeFractions";
import { resolveRouteTimeSlot, dateTimeForSlot } from "../timeSlots";
import type { TimeSlotHour } from "../timeSlots";
import type { AccessLevel } from "../graph/types";

function computeWeightedShade(edges: GraphEdge[], timeSlot: TimeSlotHour): number {
  const totalDistance = edges.reduce((sum, e) => sum + e.distanceMeters, 0);
  if (totalDistance === 0) return 0;
  return (
    edges.reduce(
      (sum, e) => sum + edgeShadeFraction01(e, timeSlot) * 100 * e.distanceMeters,
      0
    ) / totalDistance
  );
}

function buildGeometry(edges: GraphEdge[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: edges.map((edge) => ({
      type: "Feature" as const,
      properties: { edgeId: edge.id, isIndoor: edge.isIndoor === true },
      geometry: edge.geometry,
    })),
  };
}

function pathKey(path: string[]): string {
  return path.join(",");
}

export function computeRoutes(
  graph: CampusGraph,
  params: RouteParams,
  weather: WeatherData
): RouteResult[] {
  const timeSlot = resolveRouteTimeSlot(params);
  const accessLevel: AccessLevel = params.accessLevel ?? "student";
  const { origin, destination, accessibilityMode } = params;
  const comfortWeights = params.comfortWeights ?? DEFAULT_COMFORT_WEIGHTS;
  const edgeWeather = {
    airTempF: weather.temperature,
    windSpeedMps: weather.windSpeedMps,
    relativeHumidity: weather.relativeHumidity,
  };

  const when = dateTimeForSlot(timeSlot, params.forecastDate);
  attachShadeForDatetime(graph, when, timeSlot);

  const shortest = shortestRoute(graph, origin, destination, accessibilityMode, accessLevel);
  const shadeAware = shadeAwareRoute(
    graph,
    origin,
    destination,
    timeSlot,
    accessibilityMode,
    accessLevel
  );
  const cooling = coolingStopRoute(
    graph,
    origin,
    destination,
    accessibilityMode,
    accessLevel
  );
  const comfort = comfortAwareRoute(
    graph,
    origin,
    destination,
    timeSlot,
    edgeWeather,
    accessibilityMode,
    comfortWeights,
    accessLevel
  );

  const candidates: Array<{
    type: RouteType;
    path: string[];
    edges: GraphEdge[];
    distanceMeters: number;
    coolingStopCount: number;
  }> = [];

  if (shortest) {
    candidates.push({
      type: "shortest",
      path: shortest.path,
      edges: shortest.edges,
      distanceMeters: shortest.distanceMeters,
      coolingStopCount: shortest.edges.filter((e) => e.hasCoolingPoint).length,
    });
  }

  if (shadeAware) {
    candidates.push({
      type: "shade-aware",
      path: shadeAware.path,
      edges: shadeAware.edges,
      distanceMeters: shadeAware.distanceMeters,
      coolingStopCount: shadeAware.edges.filter((e) => e.hasCoolingPoint).length,
    });
  }

  if (cooling) {
    candidates.push({
      type: "cooling-stop",
      path: cooling.path,
      edges: cooling.edges,
      distanceMeters: cooling.distanceMeters,
      coolingStopCount: cooling.coolingStopCount,
    });
  }

  if (comfort) {
    candidates.push({
      type: "comfort-aware",
      path: comfort.path,
      edges: comfort.edges,
      distanceMeters: comfort.distanceMeters,
      coolingStopCount: comfort.edges.filter((e) => e.hasCoolingPoint).length,
    });
  }

  if (candidates.length === 0) return [];

  const mergedMap = new Map<
    string,
    {
      types: RouteType[];
      path: string[];
      edges: GraphEdge[];
      distanceMeters: number;
      coolingStopCount: number;
    }
  >();

  for (const candidate of candidates) {
    const key = pathKey(candidate.path);
    const existing = mergedMap.get(key);
    if (existing) {
      existing.types.push(candidate.type);
    } else {
      mergedMap.set(key, {
        types: [candidate.type],
        path: candidate.path,
        edges: candidate.edges,
        distanceMeters: candidate.distanceMeters,
        coolingStopCount: candidate.coolingStopCount,
      });
    }
  }

  const dataSources: string[] = ["ASU Tempe campus.geojson"];
  if (graph.buildings.length > 0) {
    dataSources.push("OpenStreetMap building footprints (Overpass)");
  }
  if (graph.trees.length > 0) {
    dataSources.push("OpenStreetMap tree data (Overpass)");
  }
  if (weather.source !== "demo-fallback") {
    dataSources.push("National Weather Service API");
  } else {
    dataSources.push("Fallback weather (42 °C class conditions)");
  }

  const assumptions: string[] = [
    "Walking speed: 80 meters/minute",
    "Shade from solar geometry (SunCalc) when building/tree data present; else legacy snapshots",
    `Weather: ${weather.source}`,
    "UTCI via simplified Brode 4-term approximation; wind modified by street-canyon factor",
    "Indoor edges assume ~22 °C climate-controlled conditions",
  ];

  const results: RouteResult[] = [];

  for (const merged of mergedMap.values()) {
    const durationMinutes = merged.distanceMeters / 80;
    const shadePercentage = computeWeightedShade(merged.edges, timeSlot);

    const { exposureScore, sunExposureMinutes } = computeExposureScore({
      durationMinutes,
      shadePercentage,
      heatIndex: weather.heatIndex,
      coolingStopCount: merged.coolingStopCount,
      accessibilityMode,
      cloudCoverPct: weather.cloudCoverPct,
    });

    const averageUtciC = averageUtci(merged.edges, timeSlot, edgeWeather);
    const safetyVerdict = evaluateSafetyFromUtci(averageUtciC);
    const geometry = buildGeometry(merged.edges);
    const utciStress = utciStressCategory(averageUtciC);
    const indoorMeters = merged.edges
      .filter((e) => e.isIndoor === true)
      .reduce((sum, e) => sum + e.distanceMeters, 0);

    const coolingZoneCount = merged.edges.filter((e) => e.hasCoolingPoint).length;
    const waterStationCount = merged.edges.filter((e) => e.hasWaterRefill).length;

    results.push({
      type: merged.types,
      path: merged.path,
      edges: merged.edges,
      distanceMeters: merged.distanceMeters,
      durationMinutes,
      shadePercentage,
      sunExposureMinutes,
      coolingStopCount: merged.coolingStopCount,
      waterStationCount,
      coolingZoneCount,
      exposureScore,
      confidenceLabel: weather.confidence,
      safetyVerdict,
      averageUtciC,
      utciStress,
      utciStressLabel: utciStressLabel(utciStress),
      indoorMeters,
      dataSources,
      assumptions,
      geometry,
    });
  }

  return results;
}
