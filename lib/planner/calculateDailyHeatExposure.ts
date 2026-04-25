import type { ScheduleTransition, DailyAggregateMetrics } from "./types";

/**
 * Aggregates per-transition metrics into full-day heat exposure metrics.
 *
 * - totalOutdoorMinutes = sum of walkingTimeMinutes
 * - totalSunExposureMinutes = sum of sunExposureMinutes
 * - averageShadePercentage = weighted average of shadePercentage by walkingTimeMinutes
 * - totalCoolingStopsAvailable = sum of coolingAvailability
 * - highestRiskSegmentIndex = index of transition with highest exposureScore
 * - estimatedReductionPercentage = average shade percentage as proxy for reduction vs shortest-route-only
 *
 * Validates: Requirements 3.3, 13.3
 */
export function calculateDailyHeatExposure(
  transitions: ScheduleTransition[]
): DailyAggregateMetrics {
  if (transitions.length === 0) {
    return {
      totalOutdoorMinutes: 0,
      totalSunExposureMinutes: 0,
      averageShadePercentage: 0,
      totalCoolingStopsAvailable: 0,
      highestRiskSegmentIndex: -1,
      estimatedReductionPercentage: 0,
    };
  }

  let totalOutdoorMinutes = 0;
  let totalSunExposureMinutes = 0;
  let totalCoolingStopsAvailable = 0;
  let weightedShadeSum = 0;
  let highestExposureScore = -1;
  let highestRiskSegmentIndex = 0;

  for (let i = 0; i < transitions.length; i++) {
    const { segmentRisk, routeResult } = transitions[i];

    totalOutdoorMinutes += segmentRisk.walkingTimeMinutes;
    totalSunExposureMinutes += segmentRisk.sunExposureMinutes;
    totalCoolingStopsAvailable += segmentRisk.coolingAvailability;
    weightedShadeSum +=
      segmentRisk.shadePercentage * segmentRisk.walkingTimeMinutes;

    const exposureScore = routeResult?.exposureScore ?? 0;
    if (exposureScore > highestExposureScore) {
      highestExposureScore = exposureScore;
      highestRiskSegmentIndex = i;
    }
  }

  const averageShadePercentage =
    totalOutdoorMinutes > 0 ? weightedShadeSum / totalOutdoorMinutes : 0;

  // Use average shade percentage as a proxy for estimated reduction vs shortest-route-only
  const estimatedReductionPercentage = averageShadePercentage;

  return {
    totalOutdoorMinutes,
    totalSunExposureMinutes,
    averageShadePercentage,
    totalCoolingStopsAvailable,
    highestRiskSegmentIndex,
    estimatedReductionPercentage,
  };
}
