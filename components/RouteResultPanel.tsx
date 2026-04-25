"use client";
import { forwardRef } from "react";
import type { RouteResult } from "../lib/routing/types";
import { HeatSafetyBadge } from "./HeatSafetyBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface RouteResultPanelProps {
  results: RouteResult[];
  loading: boolean;
}

const ROUTE_TYPE_LABELS: Record<string, string> = {
  shortest: "Shortest",
  "shade-aware": "Shade-Aware",
  "cooling-stop": "Cooling Stop",
  "comfort-aware": "Comfort-Aware (UTCI)",
};

function utciAccentClass(utci: number): string {
  if (utci < 26) return "border-l-emerald-500";
  if (utci < 32) return "border-l-lime-500";
  if (utci < 38) return "border-l-amber-500";
  if (utci < 46) return "border-l-orange-600";
  return "border-l-rose-600";
}

function ShadeRing({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, pct));
  return (
    <div
      className="h-11 w-11 shrink-0 rounded-full p-[3px] shadow-sm hc:border hc:border-black"
      style={{
        background: `conic-gradient(rgb(34 197 94) ${p * 3.6}deg, rgb(226 232 240) 0deg)`,
      }}
      aria-hidden
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[10px] font-bold tabular-nums text-slate-800 hc:bg-white hc:text-black">
        {Math.round(p)}%
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50/90 px-3 py-2.5 hc:bg-white hc:ring hc:ring-black">
      <span className="text-lg" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 hc:text-black">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900 hc:text-black">{children}</p>
      </div>
    </div>
  );
}

export const RouteResultPanel = forwardRef<HTMLHeadingElement, RouteResultPanelProps>(
  function RouteResultPanel({ results, loading }, ref) {
    const allUnsafe =
      results.length > 0 && results.every((r) => r.safetyVerdict === "not-recommended");

    return (
      <div aria-live="polite" aria-atomic="true" className="mt-12">
        <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2
              ref={ref}
              tabIndex={-1}
              className="text-2xl font-extrabold tracking-tight text-slate-900 hc:text-black focus:outline-none"
            >
              Your route picks
            </h2>
            <p className="mt-1 text-sm text-slate-500 hc:text-black">
              Each card is a different strategy — compare shade, time outside, and comfort.
            </p>
          </div>
          {loading && (
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hc:border hc:border-black hc:bg-white hc:text-black">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 hc:border-black hc:border-t-black" />
              Crunching numbers…
            </span>
          )}
        </div>

        {loading && results.length === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-48 animate-pulse rounded-3xl bg-gradient-to-br from-slate-200/80 to-slate-100/60 hc:from-gray-200 hc:to-gray-100" />
            <div className="h-48 animate-pulse rounded-3xl bg-gradient-to-br from-slate-200/80 to-slate-100/60 hc:from-gray-200 hc:to-gray-100" />
          </div>
        )}

        {!loading && allUnsafe && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-orange-200/90 bg-gradient-to-r from-orange-50 to-amber-50 p-4 text-sm font-medium text-orange-950 shadow-sm hc:border-black hc:from-white hc:to-white hc:text-black"
          >
            <span className="mr-2 text-lg" aria-hidden>
              💡
            </span>
            All options look toasty. Consider waiting, a shuttle leg, or a path through a cooling
            zone.
          </div>
        )}

        {!loading && results.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center text-sm text-slate-500 hc:border-black hc:bg-white hc:text-black">
            Submit the planner form — your routes will land here with playful metrics.
          </p>
        )}

        {!loading &&
          results.map((route, i) => {
            const typeLabel = route.type.map((t) => ROUTE_TYPE_LABELS[t] ?? t).join(" · ");
            const accent = utciAccentClass(route.averageUtciC);
            return (
              <article
                key={i}
                style={{ animationDelay: `${i * 70}ms` }}
                className={`sp-animate-in mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card ring-1 ring-slate-900/[0.03] hc:border-black hc:bg-white hc:shadow-none ${accent} border-l-[6px]`}
                aria-label={`${typeLabel} route`}
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <ShadeRing pct={route.shadePercentage} />
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 hc:text-black">{typeLabel}</h3>
                      <p className="mt-1 text-xs text-slate-500 hc:text-black">
                        {route.distanceMeters >= 1000
                          ? `${(route.distanceMeters / 1000).toFixed(2)} km`
                          : `${Math.round(route.distanceMeters)} m`}{" "}
                        · ~{route.durationMinutes.toFixed(0)} min walk
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <ConfidenceBadge confidence={route.confidenceLabel} />
                    <HeatSafetyBadge verdict={route.safetyVerdict} />
                  </div>
                </div>

                <div className="grid gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-4 sm:grid-cols-2 sm:px-6 hc:border-black hc:bg-white">
                  <Stat icon="🌳" label="Shade">
                    {route.shadePercentage.toFixed(0)}% along path
                  </Stat>
                  <Stat icon="☀️" label="Sun exposure">
                    {route.sunExposureMinutes} min
                  </Stat>
                  <Stat icon="📊" label="Exposure (legacy)">
                    {route.exposureScore.toFixed(0)} / 100
                  </Stat>
                  <Stat icon="🌡️" label="Avg UTCI">
                    <span
                      className={
                        route.averageUtciC < 26
                          ? "text-emerald-700"
                          : route.averageUtciC < 32
                            ? "text-lime-700"
                            : route.averageUtciC < 38
                              ? "text-amber-700"
                              : route.averageUtciC < 46
                                ? "text-orange-700"
                                : "text-rose-800"
                      }
                    >
                      {route.averageUtciC.toFixed(1)} °C
                    </span>
                    {route.utciStressLabel ? ` — ${route.utciStressLabel}` : ""}
                  </Stat>
                  {(route.coolingZoneCount > 0 || route.waterStationCount > 0) && (
                    <Stat icon="💧" label="Amenities">
                      {route.coolingZoneCount} cooling · {route.waterStationCount} water
                    </Stat>
                  )}
                  {route.indoorMeters > 0 && (
                    <Stat icon="🏢" label="Indoor">
                      {route.indoorMeters.toFixed(0)} m climate-controlled
                    </Stat>
                  )}
                </div>

                {route.confidenceLabel === "Low" && (
                  <p className="mx-4 mb-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-2 text-xs font-medium text-amber-900 sm:mx-6 hc:border-black hc:bg-white hc:text-black">
                    Live weather unavailable — using backup conditions (~108°F demo band).
                  </p>
                )}

                <details className="group border-t border-slate-100 bg-white px-4 py-2 sm:px-6 hc:border-black hc:bg-white">
                  <summary className="cursor-pointer list-none py-3 text-sm font-semibold text-indigo-600 marker:content-none hc:text-black [&::-webkit-details-marker]:hidden">
                    <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden>
                      ▸
                    </span>
                    Sources and assumptions
                  </summary>
                  <div className="space-y-3 pb-4 text-xs leading-relaxed text-slate-600 hc:text-black">
                    {route.dataSources.length > 0 && (
                      <p>
                        <span className="font-bold text-slate-800 hc:text-black">Data:</span>{" "}
                        {route.dataSources.join(" · ")}
                      </p>
                    )}
                    {route.assumptions.length > 0 && (
                      <ul className="list-inside list-disc space-y-1">
                        {route.assumptions.map((a, j) => (
                          <li key={j}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
      </div>
    );
  }
);
