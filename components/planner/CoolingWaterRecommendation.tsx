"use client";

import type {
  CoolingRecommendation,
  WaterRecommendation,
} from "../../lib/planner/types";

interface CoolingWaterRecommendationProps {
  cooling: CoolingRecommendation | null;
  water: WaterRecommendation | null;
}

export function CoolingWaterRecommendation({
  cooling,
  water,
}: CoolingWaterRecommendationProps) {
  if (!cooling && !water) return null;

  return (
    <div className="flex flex-col gap-3">
      {cooling && (
        <div
          className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 flex flex-col gap-2"
          role="region"
          aria-label={`Cooling recommendation: ${cooling.coolingPointName}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">❄️</span>
            <h3 className="text-sm font-semibold text-cyan-800">
              Cooling Break
            </h3>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-cyan-600">Point</dt>
              <dd className="font-medium text-cyan-900">
                {cooling.coolingPointName}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-cyan-600">Distance</dt>
              <dd className="font-medium text-cyan-900">
                {cooling.distanceFromRouteMeters} m
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-cyan-600">Suggested Break</dt>
              <dd className="font-medium text-cyan-900">
                {cooling.suggestedBreakMinutes} min
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-cyan-600">Reason</dt>
              <dd className="font-medium text-cyan-900">{cooling.reason}</dd>
            </div>
          </dl>
        </div>
      )}

      {water && (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50 p-4 flex flex-col gap-2"
          role="region"
          aria-label={`Water recommendation: ${water.waterPointName}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">💧</span>
            <h3 className="text-sm font-semibold text-sky-800">
              Water Refill
            </h3>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-sky-600">Point</dt>
              <dd className="font-medium text-sky-900">
                {water.waterPointName}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-sky-600">Distance</dt>
              <dd className="font-medium text-sky-900">
                {water.distanceFromRouteMeters} m
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
