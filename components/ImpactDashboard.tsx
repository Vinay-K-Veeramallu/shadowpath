"use client";

import { useEffect, useMemo, useState } from "react";
import type { WeatherData } from "../lib/weather/types";

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

interface SunExposureImpact {
  reducedSunExposurePct: number;
  selectedShadePct: number;
  baselineShadePct: number;
}

interface ImpactTile {
  id: string;
  label: string;
  headline: string;
  description: string;
  category: "personal" | "infrastructure" | "environment" | "longterm";
  icon: string;
  badge?: string;
}

interface ImpactResponse {
  source: "gemini" | "gemini-error" | "gemini-unavailable" | "fallback";
  headline: string;
  summary: string;
  tiles: ImpactTile[];
}

interface ImpactDashboardProps {
  heatLoadImpact: HeatLoadImpact | null;
  sunExposureImpact?: SunExposureImpact | null;
  weather?: WeatherData | null;
  /** Optional override for trips/week framing. */
  tripsPerWeek?: number;
}

const CATEGORY_STYLES: Record<
  ImpactTile["category"],
  { ring: string; bg: string; chip: string; label: string }
> = {
  personal: {
    ring: "border-rose-200/80",
    bg: "bg-gradient-to-br from-rose-50 to-white",
    chip: "bg-rose-100 text-rose-900",
    label: "You",
  },
  infrastructure: {
    ring: "border-blue-200/80",
    bg: "bg-gradient-to-br from-blue-50 to-white",
    chip: "bg-blue-100 text-blue-900",
    label: "Buildings",
  },
  environment: {
    ring: "border-emerald-200/80",
    bg: "bg-gradient-to-br from-emerald-50 to-white",
    chip: "bg-emerald-100 text-emerald-900",
    label: "Climate",
  },
  longterm: {
    ring: "border-violet-200/80",
    bg: "bg-gradient-to-br from-violet-50 to-white",
    chip: "bg-violet-100 text-violet-900",
    label: "Long term",
  },
};

const SOURCE_LABELS: Record<ImpactResponse["source"], string> = {
  gemini: "AI-personalized",
  "gemini-error": "Estimated (AI fallback)",
  "gemini-unavailable": "Estimated (no AI key)",
  fallback: "Estimated",
};

export function ImpactDashboard({
  heatLoadImpact,
  sunExposureImpact,
  weather,
  tripsPerWeek = 5,
}: ImpactDashboardProps) {
  const [response, setResponse] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const requestKey = useMemo(() => {
    if (!heatLoadImpact || !weather) return null;
    return [
      Math.round(weather.temperature),
      Math.round(weather.heatIndex),
      Math.round(weather.relativeHumidity),
      Math.round(weather.cloudCoverPct),
      weather.shortForecast,
      heatLoadImpact.selectedShadePct,
      heatLoadImpact.baselineShadePct,
      heatLoadImpact.selectedDurationMin,
      heatLoadImpact.reductionPct,
      sunExposureImpact?.reducedSunExposurePct ?? 0,
      tripsPerWeek,
    ].join("|");
  }, [heatLoadImpact, weather, sunExposureImpact, tripsPerWeek]);

  useEffect(() => {
    if (!requestKey || !heatLoadImpact || !weather) {
      setResponse(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);

    const sunExposureMinAvoided = Math.max(
      0,
      Math.round(
        ((heatLoadImpact.baselineShadePct - heatLoadImpact.selectedShadePct) / 100) *
          -1 *
          heatLoadImpact.selectedDurationMin
      )
    );
    // Approximate "minutes of direct sun avoided" from shade gap & duration.
    const minutesAvoided = Math.max(
      0,
      Math.round(
        heatLoadImpact.selectedDurationMin *
          ((heatLoadImpact.selectedShadePct - heatLoadImpact.baselineShadePct) / 100)
      )
    );

    void fetch("/api/route-impact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({
        weather: {
          temperature: weather.temperature,
          heatIndex: weather.heatIndex,
          relativeHumidity: weather.relativeHumidity,
          cloudCoverPct: weather.cloudCoverPct,
          shortForecast: weather.shortForecast,
        },
        route: {
          durationMin: heatLoadImpact.selectedDurationMin,
          selectedShadePct: heatLoadImpact.selectedShadePct,
          baselineShadePct: heatLoadImpact.baselineShadePct,
          sunExposureMinAvoided: Math.max(minutesAvoided, sunExposureMinAvoided),
          heatLoadAvoided: heatLoadImpact.avoidedHeatLoad,
          reductionPct: heatLoadImpact.reductionPct,
        },
        tripsPerWeek,
      }),
    })
      .then((res) => res.json())
      .then((data: ImpactResponse) => {
        setResponse(data);
      })
      .catch(() => {
        setResponse(null);
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [requestKey, heatLoadImpact, weather, tripsPerWeek]);

  if (!heatLoadImpact || !weather) {
    return (
      <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-card hc:border-black hc:bg-white">
        <h2 className="text-lg font-bold text-slate-900 hc:text-black">Heat & Climate Impact Dashboard</h2>
        <p className="mt-2 text-sm text-slate-600 hc:text-black">
          Find and select a route to see a personalized breakdown of how shade choices ripple out — body heat,
          hydration, AC load on arrival, and longer-term skin and climate effects.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-card hc:border-black hc:bg-white sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 hc:text-black">
            Heat &amp; Climate Impact Dashboard
          </h2>
          <p className="mt-1 text-xs text-slate-500 hc:text-black">
            Cascading effects of choosing this shaded route — modeled & generated for your trip.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            response?.source === "gemini"
              ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
              : "bg-slate-100 text-slate-700 ring-slate-200"
          } hc:bg-white hc:text-black hc:ring-black`}
        >
          {response ? SOURCE_LABELS[response.source] : loading ? "Personalizing…" : "Estimated"}
        </span>
      </div>

      {response?.headline && (
        <p className="mt-4 rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-4 py-3 text-sm font-semibold leading-relaxed text-indigo-950 hc:border-black hc:bg-white hc:text-black">
          {response.headline}
        </p>
      )}

      {loading && !response && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/70"
            />
          ))}
        </div>
      )}

      {response && response.tiles.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {response.tiles.map((tile) => {
            const styles = CATEGORY_STYLES[tile.category];
            return (
              <li
                key={tile.id}
                className={`relative overflow-hidden rounded-2xl border ${styles.ring} ${styles.bg} p-4 shadow-sm hc:border-black hc:bg-white`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl" aria-hidden>
                    {tile.icon}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.chip} hc:bg-white hc:text-black hc:ring hc:ring-black`}
                  >
                    {styles.label}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hc:text-black">
                  {tile.label}
                </p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 hc:text-black">
                  {tile.headline}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-700 hc:text-black">
                  {tile.description}
                </p>
                {tile.badge && (
                  <p className="mt-2 inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200 hc:bg-white hc:text-black hc:ring-black">
                    {tile.badge}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {response?.summary && (
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600 hc:bg-white hc:text-black hc:ring hc:ring-black">
          {response.summary}
        </p>
      )}
    </section>
  );
}
