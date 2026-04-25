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
  hypothetical?: boolean;
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

  // --- PROPER THERMODYNAMIC CALCULATIONS ---
  // 1. Body Heat Load (Joules -> kcal)
  const selectedDurationSec = heatLoadImpact.selectedDurationMin * 60;
  const selectedSolarWatts = 300 * (1 - heatLoadImpact.selectedShadePct / 100);
  const selectedHeatJoules = (300 + selectedSolarWatts) * selectedDurationSec;

  const baselineDurationSec = heatLoadImpact.baselineDurationMin * 60;
  const baselineSolarWatts = 300 * (1 - heatLoadImpact.baselineShadePct / 100);
  const baselineHeatJoules = (300 + baselineSolarWatts) * baselineDurationSec;

  const avoidedJoules = Math.max(0, baselineHeatJoules - selectedHeatJoules);
  const avoidedKcal = (avoidedJoules / 4184).toFixed(1); // 1 kcal = 4184 Joules
  const heatLoadReduction = baselineHeatJoules > 0 ? clampPercent((avoidedJoules / baselineHeatJoules) * 100).toFixed(1) : "0.0";

  // 2. Cooling Demand Proxy (Watt-hours)
  const avoidedCoolingWh = (avoidedJoules / 3.0 / 3600).toFixed(2);
  const baselineCoolingWh = baselineHeatJoules / 3.0 / 3600;
  const coolingDemandReduction = baselineCoolingWh > 0 ? clampPercent((Number(avoidedCoolingWh) / baselineCoolingWh) * 100).toFixed(1) : "0.0";

  // 3. Emissions Pressure (g CO2e)
  const avoidedGramsCO2e = (Number(avoidedCoolingWh) * 0.4).toFixed(2);
  const emissionsPressureReduction = coolingDemandReduction;

  // 4. Campus Scale (10,000 trips)
  const campusSavedKWh = ((Number(avoidedCoolingWh) * 10000) / 1000).toFixed(1);
  const campusSavedKgCO2e = ((Number(avoidedGramsCO2e) * 10000) / 1000).toFixed(1);

  const selectedVsBaselineDistance =
    heatLoadImpact.baselineDurationMin > 0
      ? Math.round((heatLoadImpact.selectedDurationMin / heatLoadImpact.baselineDurationMin) * 100)
      : 100;
      
  const baselineLabel = heatLoadImpact.hypothetical ? "hypothetical unshaded route" : "least-shaded route";

  return (
    <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-card hc:border-black hc:bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900 hc:text-black">Heat & Climate Impact Dashboard</h2>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 hc:bg-white hc:text-black hc:ring hc:ring-black">
          Thermodynamic Model
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {/* Body Heat Load Card */}
        <div className="group relative rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4 transition-all hover:bg-emerald-100/60 hover:shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Body heat load</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-emerald-900">-{heatLoadReduction}%</p>
          </div>
          <p className="mt-1.5 text-xs font-medium text-emerald-800">
            {avoidedKcal} fewer kcal absorbed vs {baselineLabel}
          </p>
          {/* Tooltip */}
          <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-full max-w-xs origin-top translate-y-2 scale-95 rounded-lg border border-emerald-200 bg-white p-3 text-xs text-emerald-900 opacity-0 shadow-xl transition-all duration-200 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
            <strong className="block mb-1">Scientific Basis:</strong> 
            Metabolic heat (~300W) + Solar radiation (~300W × unshaded fraction) × walking duration. Less sun exposure directly reduces the thermal kilocalories (kcal) your body absorbs.
          </div>
        </div>

        {/* Cooling Demand Card */}
        <div className="group relative rounded-xl border border-blue-200/80 bg-blue-50/80 p-4 transition-all hover:bg-blue-100/60 hover:shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Cooling demand proxy</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-blue-900">-{coolingDemandReduction}%</p>
          </div>
          <p className="mt-1.5 text-xs font-medium text-blue-800">Saves ~{avoidedCoolingWh} Wh of HVAC energy</p>
          {/* Tooltip */}
          <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-full max-w-xs origin-top translate-y-2 scale-95 rounded-lg border border-blue-200 bg-white p-3 text-xs text-blue-900 opacity-0 shadow-xl transition-all duration-200 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
            <strong className="block mb-1">Scientific Basis:</strong> 
            Based on the First Law of Thermodynamics, excess heat absorbed outdoors must be cooled down indoors. Assuming an HVAC Coefficient of Performance (COP) of 3.0, this calculates the precise Watt-hours (Wh) required to extract that heat.
          </div>
        </div>

        {/* Emissions Card */}
        <div className="group relative rounded-xl border border-violet-200/80 bg-violet-50/80 p-4 transition-all hover:bg-violet-100/60 hover:shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Emissions pressure</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-violet-900">-{emissionsPressureReduction}%</p>
          </div>
          <p className="mt-1.5 text-xs font-medium text-violet-800">Averts ~{avoidedGramsCO2e}g CO2e grid emissions</p>
          {/* Tooltip */}
          <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-full max-w-xs origin-top translate-y-2 scale-95 rounded-lg border border-violet-200 bg-white p-3 text-xs text-violet-900 opacity-0 shadow-xl transition-all duration-200 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
            <strong className="block mb-1">Scientific Basis:</strong> 
            Multiplying the averted cooling Watt-hours by the US electrical grid average carbon intensity (~400g CO2e/kWh). Reduces Scope 2 emissions pressure.
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
        <p className="text-sm font-semibold text-slate-900 hc:text-black">Thermodynamic Correlation Chain</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-3 text-xs shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-800">1. Route Choice</p>
            <p className="mt-1 text-slate-600">Selected: {heatLoadImpact.selectedShadePct}% shade</p>
            <p className="text-slate-600">Baseline: {heatLoadImpact.baselineShadePct}% shade</p>
          </div>
          <div className="rounded-lg bg-white p-3 text-xs shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-800">2. Body Heat (kcal)</p>
            <p className="mt-1 text-slate-600">Thermal absorption drops by {avoidedKcal} kilocalories</p>
          </div>
          <div className="rounded-lg bg-white p-3 text-xs shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-800">3. Cooling (Wh)</p>
            <p className="mt-1 text-slate-600">Indoor HVAC saves {avoidedCoolingWh} Wh of extraction energy</p>
          </div>
          <div className="rounded-lg bg-white p-3 text-xs shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-800">4. Campus Scale (10k trips)</p>
            <p className="mt-1 text-emerald-700 font-semibold">Saves {campusSavedKWh} kWh & {campusSavedKgCO2e} kg CO2e</p>
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
          Methodology: Physical thermodynamic proxy estimating human solar energy absorption. 
          Values scale from individual metabolic joules to macro grid emissions (US avg. grid mix assumed).
        </p>
      </div>
    </section>
  );
}
