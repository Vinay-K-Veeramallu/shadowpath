"use client";

import { useState } from "react";
import { DayPlannerForm } from "../../../components/planner/DayPlannerForm";
import { PersonalHeatModePanel } from "../../../components/planner/PersonalHeatModePanel";
import { DailyPlanSummary } from "../../../components/planner/DailyPlanSummary";
import { HeatBudgetDashboard } from "../../../components/planner/HeatBudgetDashboard";
import { TransitionCard } from "../../../components/planner/TransitionCard";
import { HighestRiskExplanation } from "../../../components/planner/HighestRiskExplanation";
import { ShuttleRecommendation } from "../../../components/planner/ShuttleRecommendation";
import { CoolingWaterRecommendation } from "../../../components/planner/CoolingWaterRecommendation";
import { useDayPlanner } from "../../../hooks/useDayPlanner";
import type { CampusCommitment, PersonalHeatMode } from "../../../lib/planner/types";
import { TIME_SLOT_LABELS } from "../../../lib/timeSlots";

export default function PlannerPage() {
  const {
    personalHeatMode,
    transitions,
    dailyPlan,
    heatBudget,
    safetyEvaluation,
    highestRiskSegment,
    loading,
    error,
    submitSchedule,
    setPersonalHeatMode,
    forecastSlot,
  } = useDayPlanner();

  const [hasSubmitted, setHasSubmitted] = useState(false);

  function handleSubmit(commitments: CampusCommitment[], preferences: PersonalHeatMode) {
    setHasSubmitted(true);
    submitSchedule(commitments, preferences);
  }

  const hasResults = hasSubmitted && dailyPlan && safetyEvaluation && heatBudget && !loading;

  return (
    <div className="sp-page-bg min-h-[calc(100vh-4rem)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="rounded-3xl border border-slate-200/80 bg-white/90 px-6 py-6 shadow-card hc:border-black hc:bg-white sm:px-8">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600 ring-1 ring-indigo-100 hc:bg-white hc:text-black hc:ring-black">
          <span aria-hidden>📅</span> HeatShield
        </p>
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl hc:text-black">
          Day planner for{" "}
          <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent hc:bg-none hc:text-inherit">
            cooler campus moves
          </span>
        </h1>
        <p className="mt-2 text-sm text-slate-600 hc:text-black">
          Plan your school day around heat, not just time.
        </p>
        <p className="mt-2 text-xs text-slate-500 hc:text-black">
          Day-wide forecast uses the time nearest your schedule midpoint (
          {TIME_SLOT_LABELS[forecastSlot]}). Each walk leg still uses the slot closest to its start
          time for shade routing.
        </p>
      </header>

      {/* Prototype disclaimer */}
      <div
        className="rounded-2xl border border-amber-200/80 bg-amber-50/85 px-4 py-3 text-xs text-amber-900 shadow-sm hc:border-black hc:bg-white hc:text-black"
        role="note"
        aria-label="Prototype disclaimer"
      >
        <p className="font-semibold mb-1">⚠️ Prototype Disclaimer</p>
        <p>
          This planner uses demo data and estimated calculations for educational
          and planning purposes only. It is not a substitute for official heat
          safety guidance.
        </p>
      </div>

      {/* Form + Preferences */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DayPlannerForm
            onSubmit={handleSubmit}
            disabled={loading}
            preferences={personalHeatMode}
          />
        </div>
        <div className="lg:sticky lg:top-6">
          <PersonalHeatModePanel
            value={personalHeatMode}
            onChange={setPersonalHeatMode}
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 py-12 shadow-sm hc:border-black hc:bg-white" role="status" aria-label="Computing day plan">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm text-slate-600 hc:text-black">Computing your day plan…</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm hc:border-black hc:bg-white hc:text-black"
        >
          <p className="font-semibold mb-1">Something went wrong</p>
          <p>{error}</p>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="flex flex-col gap-6">
          {/* Daily safety badge + summary */}
          <DailyPlanSummary
            dailyPlan={dailyPlan}
            safetyEvaluation={safetyEvaluation}
          />

          {/* Heat budget dashboard */}
          <HeatBudgetDashboard budget={heatBudget} transitions={transitions} />

          {/* Transition cards ordered by schedule time */}
          <section aria-label="Schedule transitions" className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm hc:border-black hc:bg-white">
            <h2 className="text-lg font-semibold text-slate-900 hc:text-black">
              Per-Transition Details
            </h2>
            {transitions.map((transition, index) => (
              <div key={index} className="flex flex-col gap-3">
                <TransitionCard
                  transition={transition}
                  isHighestRisk={highestRiskSegment === transition}
                />
                {/* Standalone shuttle recommendation for higher-risk / not recommended */}
                {transition.shuttleAlternative &&
                  (transition.segmentRisk.riskLevel === "higher-risk" ||
                    transition.segmentRisk.riskLevel === "not recommended") && (
                    <ShuttleRecommendation shuttle={transition.shuttleAlternative} />
                  )}
                {/* Standalone cooling/water recommendations for higher-risk / not recommended */}
                {(transition.segmentRisk.riskLevel === "higher-risk" ||
                  transition.segmentRisk.riskLevel === "not recommended") && (
                  <CoolingWaterRecommendation
                    cooling={transition.coolingRecommendation}
                    water={transition.waterRecommendation}
                  />
                )}
              </div>
            ))}
          </section>

          {/* Highest risk explanation */}
          {highestRiskSegment && (
            <HighestRiskExplanation
              transition={highestRiskSegment}
              preferences={personalHeatMode}
            />
          )}

          {/* Demo data note */}
          <div
            className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs text-slate-600 hc:border-black hc:bg-white hc:text-black"
            role="note"
            aria-label="Demo data note"
          >
            All campus data is manually seeded for the hackathon and does not
            reflect real-time conditions.
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
