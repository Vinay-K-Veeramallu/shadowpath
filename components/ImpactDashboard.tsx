"use client";

interface HeatLoadImpact {
  selectedHeatLoad: number;
  baselineHeatLoad: number;
  avoidedHeatLoad: number;
  reductionPct: number;
  selectedDurationMin: number;
  baselineDurationMin: number;
  selectedShadePct: number;
  baselineShadePct: number;
}

interface ImpactDashboardProps {
  heatLoadImpact: HeatLoadImpact | null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function ImpactDashboard({ heatLoadImpact }: ImpactDashboardProps) {
  if (!heatLoadImpact) {
    return (
      <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-card hc:border-black hc:bg-white">
        <h2 className="text-lg font-bold text-slate-900 hc:text-black">Heat & Climate Impact Dashboard</h2>
        <p className="mt-2 text-sm text-slate-600 hc:text-black">
          Find and select a route to see how shade choices change body heat load, potential cooling demand,
          and emissions pressure.
        </p>
      </section>
    );
  }

  const heatLoadReduction = clampPercent(heatLoadImpact.reductionPct);
  const coolingDemandReduction = clampPercent(Math.round(heatLoadReduction * 0.55));
  const emissionsPressureReduction = clampPercent(Math.round(coolingDemandReduction * 0.9));
  const selectedVsBaselineDistance =
    heatLoadImpact.baselineDurationMin > 0
      ? Math.round((heatLoadImpact.selectedDurationMin / heatLoadImpact.baselineDurationMin) * 100)
      : 100;

  return (
    <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-card hc:border-black hc:bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900 hc:text-black">Heat & Climate Impact Dashboard</h2>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 hc:bg-white hc:text-black hc:ring hc:ring-black">
          Model-based comparison
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Body heat load</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">-{heatLoadReduction}%</p>
          <p className="mt-1 text-xs text-emerald-900">
            {heatLoadImpact.avoidedHeatLoad} fewer load points vs least-shaded route
          </p>
        </div>
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Cooling demand proxy</p>
          <p className="mt-1 text-2xl font-bold text-blue-900">-{coolingDemandReduction}%</p>
          <p className="mt-1 text-xs text-blue-900">Potential lower post-arrival cooling requirement</p>
        </div>
        <div className="rounded-xl border border-violet-200/80 bg-violet-50/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Emissions pressure</p>
          <p className="mt-1 text-2xl font-bold text-violet-900">-{emissionsPressureReduction}%</p>
          <p className="mt-1 text-xs text-violet-900">Reduced cooling energy pressure can reduce CO2e intensity</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
        <p className="text-sm font-semibold text-slate-900 hc:text-black">Interdependency chain</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-2 text-xs">
            <p className="font-semibold text-slate-800">Shade choice</p>
            <p className="mt-1 text-slate-600">Selected: {heatLoadImpact.selectedShadePct}% shade</p>
            <p className="text-slate-600">Baseline: {heatLoadImpact.baselineShadePct}% shade</p>
          </div>
          <div className="rounded-lg bg-white p-2 text-xs">
            <p className="font-semibold text-slate-800">Body heat absorbed</p>
            <p className="mt-1 text-slate-600">{heatLoadImpact.selectedHeatLoad} vs {heatLoadImpact.baselineHeatLoad} load pts</p>
          </div>
          <div className="rounded-lg bg-white p-2 text-xs">
            <p className="font-semibold text-slate-800">Cooling effort</p>
            <p className="mt-1 text-slate-600">Lower body heat can reduce active cooling need later</p>
          </div>
          <div className="rounded-lg bg-white p-2 text-xs">
            <p className="font-semibold text-slate-800">Climate effect</p>
            <p className="mt-1 text-slate-600">Less cooling demand can reduce energy-related CO2e pressure</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-700">
            <span>Route duration comparison</span>
            <span>{selectedVsBaselineDistance}% of baseline time</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${clampPercent(selectedVsBaselineDistance)}%` }} />
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Method: relative heat-load proxy = duration × max(heat index - 70, 0) × (1 - shade fraction). Cooling
          and emissions metrics are directional estimates for behavior comparison, not direct utility or medical
          measurements.
        </p>
      </div>
    </section>
  );
}
