"use client";

import type { PersonalHeatMode } from "../../lib/planner/types";

interface PersonalHeatModePanelProps {
  value: PersonalHeatMode;
  onChange: (mode: PersonalHeatMode) => void;
}

const PREFERENCE_LABELS: { key: keyof PersonalHeatMode; label: string }[] = [
  { key: "standardWalking", label: "Standard walking" },
  { key: "lowExertion", label: "Low exertion" },
  { key: "wheelchairAccessible", label: "Wheelchair-accessible" },
  { key: "asthmaSensitive", label: "Asthma-sensitive" },
  { key: "preferShadedPaths", label: "Prefer shaded paths" },
  { key: "preferWaterRefillStops", label: "Prefer water refill stops" },
  { key: "preferCoolingStops", label: "Prefer cooling stops" },
  { key: "preferShuttleAlternatives", label: "Prefer shuttle alternatives" },
];

export function PersonalHeatModePanel({ value, onChange }: PersonalHeatModePanelProps) {
  function handleToggle(key: keyof PersonalHeatMode) {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <fieldset className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-card hc:border-black hc:bg-white">
      <legend className="mb-2 text-lg font-semibold text-slate-900 hc:text-black">Personal Heat Mode</legend>
      <p className="mb-4 text-xs text-slate-500 hc:text-black">
        These settings tune route comfort, accessibility filters, and planner recommendations.
      </p>
      <div className="flex flex-col gap-2">
      {PREFERENCE_LABELS.map(({ key, label }) => (
        <label
          key={key}
          htmlFor={`heat-mode-${key}`}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-indigo-500 hc:focus-within:ring-black ${
            value[key]
              ? "border-indigo-300 bg-indigo-50/80 text-indigo-900 hc:border-black hc:bg-white hc:text-black"
              : "border-slate-200 bg-white hover:bg-slate-50 hc:border-black hc:bg-white hc:text-black"
          }`}
        >
          <input
            id={`heat-mode-${key}`}
            type="checkbox"
            role="checkbox"
            aria-checked={value[key]}
            checked={value[key]}
            onChange={() => handleToggle(key)}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 hc:border-black"
          />
          <span className="text-sm font-medium">{label}</span>
        </label>
      ))}
      </div>
    </fieldset>
  );
}
