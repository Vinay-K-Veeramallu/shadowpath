"use client";

import type { ScheduleTransition } from "../../lib/planner/types";
import { ConfidenceBadge } from "../ConfidenceBadge";

interface TransitionCardProps {
  transition: ScheduleTransition;
  isHighestRisk: boolean;
}

const riskStyles: Record<string, string> = {
  "lower-risk": "bg-green-100 text-green-800 border-green-300",
  "higher-risk": "bg-amber-100 text-amber-800 border-amber-300",
  "not recommended": "bg-red-100 text-red-800 border-red-300",
};

const riskBorderStyles: Record<string, string> = {
  "lower-risk": "border-green-300",
  "higher-risk": "border-amber-300",
  "not recommended": "border-red-300",
};

export function TransitionCard({ transition, isHighestRisk }: TransitionCardProps) {
  const { origin, destination, segmentRisk, coolingRecommendation, waterRecommendation, shuttleAlternative } = transition;
  const { riskLevel } = segmentRisk;

  const originLabel = origin.label || origin.location;
  const destLabel = destination.label || destination.location;

  return (
    <article
      className={`rounded-lg border-2 p-4 flex flex-col gap-3 ${
        isHighestRisk ? "ring-2 ring-red-500 " + riskBorderStyles[riskLevel] : riskBorderStyles[riskLevel]
      } bg-white`}
      aria-label={`Transition from ${originLabel} to ${destLabel}, risk level: ${riskLevel}`}
    >
      {/* Header: origin → destination + risk badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-semibold text-gray-900">
          {originLabel} → {destLabel}
        </h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${riskStyles[riskLevel]}`}
          role="status"
          aria-label={`Risk level: ${riskLevel}`}
        >
          {riskLevel}
        </span>
      </div>

      {isHighestRisk && (
        <p className="text-xs font-semibold text-red-700 bg-red-50 rounded px-2 py-1">
          ⚠ Highest-risk segment
        </p>
      )}

      {/* Time window */}
      <p className="text-sm text-gray-600">
        {origin.startTime} – {destination.startTime}
      </p>

      {/* Metrics grid */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-gray-500">Walking time</dt>
          <dd className="font-medium">{segmentRisk.walkingTimeMinutes} min</dd>
        </div>
        <div>
          <dt className="text-gray-500">Sun exposure</dt>
          <dd className="font-medium">{segmentRisk.sunExposureMinutes} min</dd>
        </div>
        <div>
          <dt className="text-gray-500">Shade</dt>
          <dd className="font-medium">{segmentRisk.shadePercentage}%</dd>
        </div>
        <div>
          <dt className="text-gray-500">Cooling points</dt>
          <dd className="font-medium">{segmentRisk.coolingAvailability}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Water refills</dt>
          <dd className="font-medium">{segmentRisk.waterAvailability}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Confidence</dt>
          <dd><ConfidenceBadge confidence={segmentRisk.confidenceLabel} /></dd>
        </div>
      </dl>

      {/* Recommendations */}
      {(coolingRecommendation || waterRecommendation || shuttleAlternative) && (
        <div className="flex flex-col gap-2 border-t pt-3 mt-1">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Recommendations</p>

          {shuttleAlternative && (
            <div className="text-sm bg-blue-50 border border-blue-200 rounded p-2">
              <p className="font-medium text-blue-800">🚌 Shuttle: {shuttleAlternative.shuttleStopName}</p>
              <p className="text-blue-700">
                ~{shuttleAlternative.estimatedWaitMinutes} min wait · {shuttleAlternative.walkingDistanceMeters}m walk
                {shuttleAlternative.accessible && " · ♿ Accessible"}
              </p>
            </div>
          )}

          {coolingRecommendation && (
            <div className="text-sm bg-cyan-50 border border-cyan-200 rounded p-2">
              <p className="font-medium text-cyan-800">❄️ Cooling: {coolingRecommendation.coolingPointName}</p>
              <p className="text-cyan-700">
                {coolingRecommendation.distanceFromRouteMeters}m from route · {coolingRecommendation.suggestedBreakMinutes} min break
              </p>
              <p className="text-cyan-600 text-xs">{coolingRecommendation.reason}</p>
            </div>
          )}

          {waterRecommendation && (
            <div className="text-sm bg-sky-50 border border-sky-200 rounded p-2">
              <p className="font-medium text-sky-800">💧 Water: {waterRecommendation.waterPointName}</p>
              <p className="text-sky-700">{waterRecommendation.distanceFromRouteMeters}m from route</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
