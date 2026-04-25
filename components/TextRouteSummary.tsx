"use client";
import type { RouteResult } from "../lib/routing/types";

interface TextRouteSummaryProps {
  results: RouteResult[];
}

const ROUTE_TYPE_LABELS: Record<string, string> = {
  shortest: "Shortest",
  "shade-aware": "Shade-Aware",
  "cooling-stop": "Cooling Stop",
  "comfort-aware": "Comfort-Aware (UTCI)",
};

export function TextRouteSummary({ results }: TextRouteSummaryProps) {
  if (results.length === 0) return null;

  return (
    <section aria-label="Route results summary" className="mt-10">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500 hc:text-black">
        Screen-reader summary
      </h2>
      <ul className="flex flex-col gap-3">
        {results.map((route, i) => {
          const typeLabel = route.type.map((t) => ROUTE_TYPE_LABELS[t] ?? t).join(", ");
          const safety =
            route.safetyVerdict === "not-recommended"
              ? "Not recommended for this walk."
              : route.safetyVerdict === "higher-risk"
                ? "Higher risk from sun and heat."
                : "Lower risk for this walk.";
          return (
            <li
              key={i}
              className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm hc:border-black hc:bg-white hc:text-black"
            >
              <strong className="font-semibold text-slate-900 hc:text-black">{typeLabel}.</strong>{" "}
              Shade {route.shadePercentage.toFixed(0)} percent, sun about {route.sunExposureMinutes}{" "}
              minutes, exposure score {route.exposureScore.toFixed(0)} of 100, average UTCI{" "}
              {route.averageUtciC.toFixed(1)} degrees Celsius ({route.utciStressLabel}). {safety}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
