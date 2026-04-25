"use client";

import type { WalkingRouteRanked } from "../lib/walking/types";

interface WalkingPathsStripProps {
  routes: WalkingRouteRanked[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  provider: "google" | "osrm" | null;
  attribution: string | null;
  error: string | null;
}

function confidenceClasses(level: WalkingRouteRanked["shadeConfidence"], selected: boolean): string {
  if (selected) return "bg-white/20 text-white";
  if (level === "High") return "bg-emerald-100 text-emerald-800 hc:bg-white hc:text-black";
  if (level === "Medium") return "bg-amber-100 text-amber-800 hc:bg-white hc:text-black";
  return "bg-rose-100 text-rose-800 hc:bg-white hc:text-black";
}

export function WalkingPathsStrip({
  routes,
  selectedId,
  onSelect,
  provider,
  attribution,
  error,
}: WalkingPathsStripProps) {
  if (error) {
    return (
      <p className="rounded-xl border border-rose-200/80 bg-rose-50/90 px-3 py-2 text-xs font-medium text-rose-800 hc:border-black hc:bg-white hc:text-black">
        {error}
      </p>
    );
  }

  if (routes.length === 0) return null;
  const winner = routes[0];

  const providerLabel =
    provider === "google"
      ? "Google Directions (walking)"
      : provider === "osrm"
        ? "OpenStreetMap paths via OSRM"
        : "Sidewalk routing";

  return (
    <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-emerald-50/80 px-3 py-3 sm:px-4 hc:border-black hc:from-white hc:to-white">
      <p className="text-xs font-bold uppercase tracking-wide text-teal-900 hc:text-black">
        Sidewalk-aligned options
      </p>
      <p className="mt-1 text-xs leading-relaxed text-teal-900/85 hc:text-black">
        {providerLabel}. Ranked by shade with a detour guard (large distance/time detours are
        penalized), using campus-model shade matching near each segment.
      </p>
      <div className="mt-2 rounded-xl border border-teal-200/90 bg-white/80 px-3 py-2 text-xs text-teal-900 hc:border-black hc:bg-white hc:text-black">
        <p>
          <span className="font-semibold">Why this route wins:</span> {winner.winnerReason}
        </p>
        <p className="mt-1">
          <span className="font-semibold">Shade confidence:</span> {winner.shadeConfidence}
        </p>
        <p className="mt-1 text-[11px] text-teal-800/90 hc:text-black" title="Confidence is based on how much of the route had nearby campus-edge shade data match points.">
          Confidence uses route-sample match coverage to campus shade data.
        </p>
      </div>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Walking path alternatives"
      >
        {routes.map((r, i) => {
          const on = r.id === selectedId;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(r.id)}
              className={`min-w-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition sp-ring-focus sm:text-sm ${
                on
                  ? "border-teal-600 bg-teal-600 text-white shadow-md hc:border-black hc:bg-black hc:text-white"
                  : "border-teal-200/80 bg-white/90 text-teal-900 hover:border-teal-400 hc:border-black hc:bg-white hc:text-black"
              }`}
            >
              <span
                className={`block text-[10px] font-bold uppercase tracking-wide ${
                  on ? "text-white/90" : "text-teal-700/80 hc:text-black"
                }`}
              >
                {i === 0 ? "Most shade (est.)" : `Option ${i + 1}`}
              </span>
              <span className="mt-0.5 block tabular-nums">
                {(r.distanceMeters / 1000).toFixed(2)} km · ~{r.durationMinutes} min · ~{r.shadeEstimatePct}% shade
              </span>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${confidenceClasses(
                r.shadeConfidence,
                on
              )}`}>
                confidence {r.shadeConfidence}
              </span>
            </button>
          );
        })}
      </div>
      {attribution ? (
        <p className="mt-2 text-[10px] leading-snug text-teal-900/70 hc:text-black">{attribution}</p>
      ) : null}
    </div>
  );
}
