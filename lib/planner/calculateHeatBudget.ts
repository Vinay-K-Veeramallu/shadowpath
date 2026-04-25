import type { DailyHeatPlan, HeatBudget } from "./types";

/**
 * Formats a time string (HH:MM or similar) into a human-readable 12-hour format.
 * E.g., "14:00" → "2:00 PM"
 */
function formatTime(time: string): string {
  const parts = time.split(":");
  if (parts.length < 2) return time;

  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];

  if (isNaN(hours)) return time;

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Computes the heat budget for a daily plan.
 *
 * - totalBudget = 100 (constant)
 * - For each transition: segmentConsumption = (exposureScore / 100) × (walkingTimeMinutes / totalOutdoorMinutes) × 100
 * - consumedBudget = sum(segmentConsumption)
 * - remainingBudget = totalBudget - consumedBudget
 * - Invariant: consumedBudget + remainingBudget === totalBudget (=== 100)
 *
 * Pure function — no side effects.
 *
 * Validates: Requirements 4.2, 4.3, 13.8
 */
export function calculateHeatBudget(dailyPlan: DailyHeatPlan): HeatBudget {
  const totalBudget = 100;
  const { transitions, aggregateMetrics } = dailyPlan;
  const { totalOutdoorMinutes, highestRiskSegmentIndex, estimatedReductionPercentage } =
    aggregateMetrics;

  // Calculate consumed budget from segment consumptions
  let consumedBudget = 0;

  if (totalOutdoorMinutes > 0) {
    for (const transition of transitions) {
      const exposureScore = transition.routeResult?.exposureScore ?? 0;
      const walkingTimeMinutes = transition.segmentRisk.walkingTimeMinutes;

      const segmentConsumption =
        (exposureScore / 100) * (walkingTimeMinutes / totalOutdoorMinutes) * 100;

      consumedBudget += segmentConsumption;
    }
  }

  // Enforce invariant: consumedBudget + remainingBudget === totalBudget
  const remainingBudget = totalBudget - consumedBudget;

  // Determine highest-risk time block from the highest-risk segment
  let highestRiskTimeBlock = "N/A";
  if (
    transitions.length > 0 &&
    highestRiskSegmentIndex >= 0 &&
    highestRiskSegmentIndex < transitions.length
  ) {
    const highestRiskTransition = transitions[highestRiskSegmentIndex];
    const originTime = formatTime(highestRiskTransition.origin.startTime);
    const destTime = formatTime(highestRiskTransition.destination.startTime);
    highestRiskTimeBlock = `${originTime} – ${destTime}`;
  }

  // Generate recommended cooling break based on highest-risk segment
  let recommendedCoolingBreak: string | null = null;
  if (
    transitions.length > 0 &&
    highestRiskSegmentIndex >= 0 &&
    highestRiskSegmentIndex < transitions.length
  ) {
    const highestRiskTransition = transitions[highestRiskSegmentIndex];
    const cooling = highestRiskTransition.coolingRecommendation;

    if (cooling) {
      const originTime = formatTime(highestRiskTransition.origin.startTime);
      recommendedCoolingBreak = `Take a ${cooling.suggestedBreakMinutes}-min break at ${cooling.coolingPointName} around ${originTime}`;
    }
  }

  return {
    totalBudget,
    consumedBudget,
    remainingBudget,
    highestRiskTimeBlock,
    recommendedCoolingBreak,
    estimatedReductionPercentage,
  };
}
