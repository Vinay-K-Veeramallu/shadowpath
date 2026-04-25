"use client";

import type { ScheduleTransition, PersonalHeatMode } from "../../lib/planner/types";
import { generateRecommendedActions } from "../../lib/planner/findHighestRiskSegment";

interface HighestRiskExplanationProps {
  transition: ScheduleTransition;
  preferences: PersonalHeatMode;
}

const riskStyles: Record<string, string> = {
  "lower-risk": "bg-green-100 text-green-800 border-green-300",
  "higher-risk": "bg-amber-100 text-amber-800 border-amber-300",
  "not recommended": "bg-red-100 text-red-800 border-red-300",
};

/**
 * Builds a human-readable reason string explaining why this segment is high-risk.
 */
function buildRiskReason(transition: ScheduleTransition): string {
  const risk = transition.segmentRisk;
  const reasons: string[] = [];

  if (risk.shadePercentage < 30) {
    reasons.push("very low shade coverage");
  } else if (risk.shadePercentage < 50) {
    reasons.push("limited shade coverage");
  }

  if (risk.sunExposureMinutes > 15) {
    reasons.push("extended sun exposure");
  }

  if (risk.walkingTimeMinutes > 10) {
    reasons.push("long walking duration");
  }

  if (risk.coolingAvailability === 0) {
    reasons.push("no cooling points along the route");
  }

  if (reasons.length === 0) {
    reasons.push("elevated overall heat exposure score");
  }

  return reasons.join(", ");
}

/**
 * Reorders recommended actions so shuttle recommendation appears first
 * when shuttle preference is enabled and segment is higher-risk or not recommended.
 */
function orderActions(
  actions: string[],
  preferences: PersonalHeatMode,
  riskLevel: string,
): string[] {
  const isHighRisk = riskLevel === "higher-risk" || riskLevel === "not recommended";
  if (!preferences.preferShuttleAlternatives || !isHighRisk) {
    return actions;
  }

  const shuttleIndex = actions.findIndex(
    (a) => a.toLowerCase().includes("shuttle"),
  );
  if (shuttleIndex <= 0) {
    return actions;
  }

  const reordered = [...actions];
  const [shuttleAction] = reordered.splice(shuttleIndex, 1);
  reordered.unshift(shuttleAction);
  return reordered;
}

export function HighestRiskExplanation({
  transition,
  preferences,
}: HighestRiskExplanationProps) {
  const { origin, destination, segmentRisk } = transition;
  const { riskLevel } = segmentRisk;

  const originLabel = origin.label || origin.location;
  const destLabel = destination.label || destination.location;
  const timeWindow = `${origin.startTime} – ${destination.startTime}`;
  const reason = buildRiskReason(transition);

  const rawActions = generateRecommendedActions(transition);
  const actions = orderActions(rawActions, preferences, riskLevel);

  return (
    <section
      className="rounded-lg border-2 border-red-300 bg-white p-5 flex flex-col gap-4"
      aria-label={`Highest-risk segment explanation: ${originLabel} to ${destLabel}, risk level ${riskLevel}`}
      tabIndex={0}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          Highest-Risk Segment
        </h2>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${riskStyles[riskLevel]}`}
          role="status"
          aria-label={`Risk level: ${riskLevel}`}
        >
          {riskLevel}
        </span>
      </div>

      {/* Segment details */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Time Window</dt>
          <dd className="font-medium text-gray-900">{timeWindow}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Route</dt>
          <dd className="font-medium text-gray-900">
            {originLabel} → {destLabel}
          </dd>
        </div>
        <div className="sm:col-span-2 flex flex-col gap-0.5">
          <dt className="text-gray-500">Reason for High Risk</dt>
          <dd className="font-medium text-red-800 capitalize">{reason}</dd>
        </div>
      </dl>

      {/* Recommended actions */}
      <div className="flex flex-col gap-2 border-t pt-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Recommended Actions
        </h3>
        <ul
          className="list-disc list-inside flex flex-col gap-1.5 text-sm text-gray-800"
          aria-label="Recommended actions for highest-risk segment"
        >
          {actions.map((action, i) => (
            <li key={i}>{action}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
