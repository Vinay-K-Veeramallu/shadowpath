import type {
  DailyHeatPlan,
  DailySafetyEvaluation,
  PersonalHeatMode,
  RiskLevel,
  ScheduleTransition,
} from "./types";

/**
 * Evaluates the daily heat plan and produces a safety evaluation.
 *
 * 1. Collects all transitions with exposureScore > 75 → blocked segments.
 * 2. Determines riskLevel:
 *    - All scores ≤ 50 → "lower-risk"
 *    - Any score 51–75, none > 75 → "higher-risk"
 *    - Any score > 75 → "not recommended"
 * 3. allowed = blockedSegments.length === 0
 * 4. Generates explanation string describing the assessment.
 * 5. Generates recommendations array:
 *    - For each blocked segment: at least one alternative.
 *    - If preferences.preferShuttleAlternatives and segment is blocked: shuttle recommendation first.
 *
 * CRITICAL: Never uses the word "safe" in any output string.
 *
 * Pure function — no side effects.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 13.9
 */
export function evaluateDailyHeatSafety(
  dailyPlan: DailyHeatPlan,
  preferences: PersonalHeatMode
): DailySafetyEvaluation {
  const { transitions } = dailyPlan;

  // 1. Collect blocked segments (exposureScore > 75)
  const blockedSegments: ScheduleTransition[] = transitions.filter(
    (t) => (t.routeResult?.exposureScore ?? 0) > 75
  );

  // 2. Determine risk level based on exposure score thresholds
  const riskLevel = classifyRiskLevel(transitions);

  // 3. allowed = no blocked segments
  const allowed = blockedSegments.length === 0;

  // 4. Generate explanation
  const explanation = generateExplanation(riskLevel, transitions, blockedSegments);

  // 5. Generate recommendations (at least one per blocked segment)
  const recommendations = generateRecommendations(
    blockedSegments,
    preferences
  );

  return {
    allowed,
    riskLevel,
    blockedSegments,
    explanation,
    recommendations,
  };
}

/**
 * Classifies the overall daily risk level from transition exposure scores.
 */
function classifyRiskLevel(transitions: ScheduleTransition[]): RiskLevel {
  let hasHigherRisk = false;

  for (const t of transitions) {
    const score = t.routeResult?.exposureScore ?? 0;
    if (score > 75) {
      return "not recommended";
    }
    if (score > 50) {
      hasHigherRisk = true;
    }
  }

  return hasHigherRisk ? "higher-risk" : "lower-risk";
}

/**
 * Generates a human-readable explanation of the daily assessment.
 * Never uses the word "safe".
 */
function generateExplanation(
  riskLevel: RiskLevel,
  transitions: ScheduleTransition[],
  blockedSegments: ScheduleTransition[]
): string {
  const totalTransitions = transitions.length;

  if (totalTransitions === 0) {
    return "No walking segments to evaluate.";
  }

  switch (riskLevel) {
    case "lower-risk":
      return `All ${totalTransitions} walking segment${totalTransitions === 1 ? "" : "s"} have lower heat exposure levels. Your day plan has a lower-risk assessment.`;

    case "higher-risk":
      return `Some walking segments have elevated heat exposure. Your day plan has a higher-risk assessment. Consider shaded routes or cooling breaks.`;

    case "not recommended": {
      const blockedCount = blockedSegments.length;
      return `${blockedCount} walking segment${blockedCount === 1 ? " has" : "s have"} heat exposure above recommended levels. Your day plan is not recommended without adjustments.`;
    }
  }
}

/**
 * Generates recommendations for blocked segments.
 * At least one recommendation per blocked segment.
 * When preferShuttleAlternatives is enabled, shuttle recommendation comes first.
 */
function generateRecommendations(
  blockedSegments: ScheduleTransition[],
  preferences: PersonalHeatMode
): string[] {
  const recommendations: string[] = [];

  for (const segment of blockedSegments) {
    const origin = segment.origin.label || segment.origin.location;
    const destination = segment.destination.label || segment.destination.location;
    const segmentDesc = `${origin} → ${destination}`;

    if (preferences.preferShuttleAlternatives) {
      // Shuttle recommendation first when preference is enabled
      if (segment.shuttleAlternative) {
        recommendations.push(
          `Consider taking the shuttle from ${segment.shuttleAlternative.shuttleStopName} for the ${segmentDesc} segment.`
        );
      } else {
        recommendations.push(
          `Consider using a shuttle alternative for the ${segmentDesc} segment.`
        );
      }
    }

    // Always add a cooling break or schedule adjustment recommendation
    if (segment.coolingRecommendation) {
      recommendations.push(
        `Take a ${segment.coolingRecommendation.suggestedBreakMinutes}-minute cooling break at ${segment.coolingRecommendation.coolingPointName} during the ${segmentDesc} segment.`
      );
    } else {
      recommendations.push(
        `Consider adjusting your schedule to avoid peak heat for the ${segmentDesc} segment.`
      );
    }

    // Add shuttle recommendation after if not already added via preference
    if (!preferences.preferShuttleAlternatives) {
      if (segment.shuttleAlternative) {
        recommendations.push(
          `Consider taking the shuttle from ${segment.shuttleAlternative.shuttleStopName} for the ${segmentDesc} segment.`
        );
      }
    }
  }

  return recommendations;
}
