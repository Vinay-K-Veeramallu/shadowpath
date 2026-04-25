import type { RouteResult } from "../routing/types";
import type { WeatherData } from "../weather/types";
import type { RiskLevel, RouteSegmentRisk } from "./types";

/**
 * Calculates per-segment heat risk metrics from a RouteResult and weather data.
 *
 * Pure function — no side effects.
 *
 * @param routeResult - The computed route result from the Route_Engine
 * @param weather - Current weather data
 * @returns RouteSegmentRisk with all risk metrics
 */
export function calculateSegmentHeatRisk(
  routeResult: RouteResult,
  weather: WeatherData
): RouteSegmentRisk {
  void weather;
  const walkingTimeMinutes = routeResult.durationMinutes;
  const sunExposureMinutes = routeResult.sunExposureMinutes;
  const shadePercentage = routeResult.shadePercentage;
  const coolingAvailability = routeResult.coolingStopCount;
  const waterAvailability = routeResult.edges.filter(
    (e) => e.hasWaterRefill
  ).length;
  const accessibilityCompliant = routeResult.edges.every(
    (e) => e.accessible
  );
  const confidenceLabel = routeResult.confidenceLabel;

  let riskLevel: RiskLevel;
  if (routeResult.exposureScore <= 50) {
    riskLevel = "lower-risk";
  } else if (routeResult.exposureScore <= 75) {
    riskLevel = "higher-risk";
  } else {
    riskLevel = "not recommended";
  }

  return {
    walkingTimeMinutes,
    sunExposureMinutes,
    shadePercentage,
    coolingAvailability,
    waterAvailability,
    accessibilityCompliant,
    confidenceLabel,
    riskLevel,
  };
}
