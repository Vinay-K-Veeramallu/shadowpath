"use client";

import type { DailyHeatPlan, DailySafetyEvaluation } from "../../lib/planner/types";
import { DailySafetyBadge } from "./DailySafetyBadge";

interface DailyPlanSummaryProps {
  dailyPlan: DailyHeatPlan;
  safetyEvaluation: DailySafetyEvaluation;
}

export function DailyPlanSummary({ dailyPlan, safetyEvaluation }: DailyPlanSummaryProps) {
  const {
    totalOutdoorMinutes,
    totalSunExposureMinutes,
    averageShadePercentage,
    totalCoolingStopsAvailable,
    estimatedReductionPercentage,
  } = dailyPlan.aggregateMetrics;

  return (
    <section
      className="rounded-lg border bg-white p-5 flex flex-col gap-4"
      aria-label="Daily plan summary"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Daily Plan Summary</h2>
        <DailySafetyBadge riskLevel={safetyEvaluation.riskLevel} />
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Total Outdoor Minutes</dt>
          <dd
            className="font-semibold text-gray-900"
            aria-label={`Total outdoor minutes: ${Math.round(totalOutdoorMinutes)}`}
          >
            {Math.round(totalOutdoorMinutes)} min
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Total Sun Exposure</dt>
          <dd
            className="font-semibold text-gray-900"
            aria-label={`Total sun exposure: ${Math.round(totalSunExposureMinutes)} minutes`}
          >
            {Math.round(totalSunExposureMinutes)} min
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Average Shade</dt>
          <dd
            className="font-semibold text-gray-900"
            aria-label={`Average shade percentage: ${Math.round(averageShadePercentage)}%`}
          >
            {Math.round(averageShadePercentage)}%
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Cooling Stops Available</dt>
          <dd
            className="font-semibold text-gray-900"
            aria-label={`Total cooling stops available: ${totalCoolingStopsAvailable}`}
          >
            {totalCoolingStopsAvailable}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Estimated Reduction</dt>
          <dd
            className="font-semibold text-gray-900"
            aria-label={`Estimated heat exposure reduction: ${estimatedReductionPercentage}% compared to shortest-route-only`}
          >
            {estimatedReductionPercentage}% vs shortest-route
          </dd>
        </div>
      </dl>

      {/* Prototype disclaimer */}
      <div
        className="mt-2 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
        role="note"
        aria-label="Prototype disclaimer"
      >
        <p className="font-semibold mb-1">⚠️ Prototype Disclaimer</p>
        <p>
          This planner uses demo data and estimated calculations for educational and planning
          purposes only.
        </p>
      </div>

      {/* Demo data note */}
      <div
        className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600"
        role="note"
        aria-label="Demo data note"
      >
        All campus data is manually seeded for the hackathon and does not reflect real-time
        conditions.
      </div>
    </section>
  );
}
