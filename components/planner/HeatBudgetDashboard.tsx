"use client";

import type { HeatBudget, ScheduleTransition } from "../../lib/planner/types";

interface HeatBudgetDashboardProps {
  budget: HeatBudget;
  transitions: ScheduleTransition[];
}

const riskColors: Record<string, string> = {
  "lower-risk": "bg-green-500",
  "higher-risk": "bg-amber-500",
  "not recommended": "bg-red-500",
};

export function HeatBudgetDashboard({ budget, transitions }: HeatBudgetDashboardProps) {
  const {
    totalBudget,
    consumedBudget,
    remainingBudget,
    highestRiskTimeBlock,
    recommendedCoolingBreak,
    estimatedReductionPercentage,
  } = budget;

  // Compute each transition's share of the consumed budget for the segmented bar
  const totalWalkingMinutes = transitions.reduce(
    (sum, t) => sum + t.segmentRisk.walkingTimeMinutes,
    0,
  );

  const segments = transitions.map((t) => {
    const exposureScore = t.routeResult?.exposureScore ?? 0;
    const walkingTime = t.segmentRisk.walkingTimeMinutes;
    const share =
      totalWalkingMinutes > 0
        ? (exposureScore / 100) * (walkingTime / totalWalkingMinutes) * consumedBudget
        : 0;
    return {
      riskLevel: t.segmentRisk.riskLevel,
      widthPercent: totalBudget > 0 ? (share / totalBudget) * 100 : 0,
      label: `${t.origin.label || t.origin.location} → ${t.destination.label || t.destination.location}`,
    };
  });

  const consumedPercent = Math.round(consumedBudget);
  const remainingPercent = Math.round(remainingBudget);

  return (
    <section
      className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-card hc:border-black hc:bg-white"
      aria-label="Heat budget dashboard"
    >
      <h2 className="text-lg font-semibold text-slate-900 hc:text-black">Heat Budget</h2>

      {/* Segmented progress bar */}
      <div className="flex flex-col gap-1">
        <div
          className="flex h-6 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={consumedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Heat budget: ${consumedPercent}% consumed, ${remainingPercent}% remaining`}
        >
          {segments.map((seg, i) =>
            seg.widthPercent > 0 ? (
              <div
                key={i}
                className={`${riskColors[seg.riskLevel]} h-full transition-all duration-300`}
                style={{ width: `${seg.widthPercent}%` }}
                aria-label={`${seg.label}: ${seg.riskLevel}`}
                title={`${seg.label}: ${seg.riskLevel}`}
              />
            ) : null,
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-500 hc:text-black">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Metrics */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-slate-500 hc:text-black">Consumed Budget</dt>
          <dd
            className="font-semibold text-slate-900 hc:text-black"
            aria-label={`Consumed budget: ${consumedPercent}%`}
          >
            {consumedPercent}%
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-slate-500 hc:text-black">Remaining Budget</dt>
          <dd
            className="font-semibold text-slate-900 hc:text-black"
            aria-label={`Remaining budget: ${remainingPercent}%`}
          >
            {remainingPercent}%
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-slate-500 hc:text-black">Highest-Risk Time Block</dt>
          <dd
            className="font-semibold text-slate-900 hc:text-black"
            aria-label={`Highest-risk time block: ${highestRiskTimeBlock}`}
          >
            {highestRiskTimeBlock}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-slate-500 hc:text-black">Estimated Reduction</dt>
          <dd
            className="font-semibold text-slate-900 hc:text-black"
            aria-label={`Estimated reduction: ${estimatedReductionPercentage}% compared to shortest-route-only`}
          >
            {estimatedReductionPercentage}% vs shortest-route
          </dd>
        </div>
        {recommendedCoolingBreak && (
          <div className="sm:col-span-2 flex flex-col gap-0.5">
            <dt className="text-slate-500 hc:text-black">Recommended Cooling Break</dt>
            <dd
              className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 font-semibold text-cyan-800 hc:border-black hc:bg-white hc:text-black"
              aria-label={`Recommended cooling break: ${recommendedCoolingBreak}`}
            >
              ❄️ {recommendedCoolingBreak}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
