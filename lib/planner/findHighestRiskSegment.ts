import type { ScheduleTransition } from "./types";

/**
 * Returns the ScheduleTransition with the highest routeResult.exposureScore.
 * Ties are broken by first occurrence (lowest index wins).
 * Transitions with null routeResult are treated as exposureScore 0.
 *
 * Validates: Requirements 5.1, 13.4
 */
export function findHighestRiskSegment(
  transitions: ScheduleTransition[]
): ScheduleTransition {
  if (transitions.length === 0) {
    throw new Error("Cannot find highest risk segment of an empty array");
  }

  let highestIndex = 0;
  let highestScore = transitions[0].routeResult?.exposureScore ?? 0;

  for (let i = 1; i < transitions.length; i++) {
    const score = transitions[i].routeResult?.exposureScore ?? 0;
    if (score > highestScore) {
      highestScore = score;
      highestIndex = i;
    }
  }

  return transitions[highestIndex];
}

/**
 * Generates at least 3 recommended actions for the highest-risk segment.
 * Actions are selected from a pool of practical heat-mitigation strategies.
 *
 * Validates: Requirements 5.3
 */
export function generateRecommendedActions(
  transition: ScheduleTransition
): string[] {
  const actions: string[] = [];
  const risk = transition.segmentRisk;
  const origin = transition.origin.label || transition.origin.location;
  const destination = transition.destination.label || transition.destination.location;

  // Always recommend leaving earlier when sun exposure is significant
  actions.push(
    `Leave earlier for your trip from ${origin} to ${destination} to avoid peak heat`
  );

  // Shade-related recommendation
  if (risk.shadePercentage < 50) {
    actions.push("Choose a shaded route to reduce direct sun exposure");
  } else {
    actions.push("Continue using shaded routes to maintain lower exposure");
  }

  // Cooling point recommendation
  if (transition.coolingRecommendation) {
    actions.push(
      `Stop at ${transition.coolingRecommendation.coolingPointName} for a cooling break (${transition.coolingRecommendation.suggestedBreakMinutes} min)`
    );
  } else {
    actions.push("Stop at a nearby cooling point to lower your core temperature");
  }

  // Water refill recommendation
  if (transition.waterRecommendation) {
    actions.push(
      `Refill water at ${transition.waterRecommendation.waterPointName}`
    );
  } else {
    actions.push("Refill your water bottle before heading out");
  }

  // Shuttle recommendation when available
  if (transition.shuttleAlternative) {
    actions.push(
      `Use the ${transition.shuttleAlternative.shuttleStopName} shuttle (approx. ${transition.shuttleAlternative.estimatedWaitMinutes} min wait)`
    );
  } else {
    actions.push("Consider using a campus shuttle instead of walking");
  }

  // Wait for cooler period if risk is very high
  if (risk.riskLevel === "not recommended") {
    actions.push(
      "Wait for a cooler period before making this trip if your schedule allows"
    );
  }

  // Guarantee at least 3 actions (already ensured by the logic above, but defensive)
  return actions;
}
