"use client";

import { useEffect, useState } from "react";
import type { WeatherData } from "../lib/weather/types";
import type { TimeSlotHour } from "../lib/timeSlots";
import { TIME_SLOT_LABELS } from "../lib/timeSlots";

interface SunExposureImpact {
  reducedSunExposurePct: number;
  selectedShadePct: number;
  baselineShadePct: number;
}

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

interface WeatherGlanceProps {
  weather: WeatherData;
  timeSlot: TimeSlotHour;
  loading?: boolean;
  sunExposureImpact?: SunExposureImpact | null;
  heatLoadImpact?: HeatLoadImpact | null;
}

function buildHealthImpactInsights(weather: WeatherData, impact: SunExposureImpact): string[] {
  const insights: string[] = [];
  const feelsLike = Math.round(weather.heatIndex);
  const humidity = Math.round(weather.relativeHumidity);
  const sunReduction = impact.reducedSunExposurePct;

  if (feelsLike >= 100) {
    insights.push(
      `Very high heat conditions (feels ~${feelsLike}°F): extra shade can meaningfully lower heat strain during walking.`
    );
  } else if (feelsLike >= 90) {
    insights.push(
      `High heat conditions (feels ~${feelsLike}°F): choosing more shade can help reduce heat stress risk.`
    );
  } else {
    insights.push(
      `Moderate heat conditions (feels ~${feelsLike}°F): shade can still improve walking comfort and reduce direct sun load.`
    );
  }

  if (humidity >= 55) {
    insights.push(
      `Humidity is elevated (${humidity}%), which can make cooling harder; shaded paths may help limit dehydration stress.`
    );
  } else if (humidity <= 20) {
    insights.push(
      `Air is dry (${humidity}% humidity), so sun exposure can feel sharper; shaded routing can reduce sunburn risk.`
    );
  }

  if (sunReduction >= 20) {
    insights.push(
      "Large direct-sun reduction may substantially lower short-term UV burden for this trip."
    );
  } else if (sunReduction > 0) {
    insights.push(
      "Some direct-sun reduction may still help lower UV exposure and cumulative skin damage over time."
    );
  } else {
    insights.push(
      "This option does not reduce direct sun versus alternatives; sunscreen, hat, and hydration are especially important."
    );
  }

  return insights.slice(0, 3);
}

function heatEmoji(tempF: number): string {
  if (tempF >= 105) return "🌡️";
  if (tempF >= 95) return "☀️";
  if (tempF >= 85) return "🌤️";
  return "😊";
}

export function WeatherGlance({
  weather,
  timeSlot,
  loading,
  sunExposureImpact,
  heatLoadImpact,
}: WeatherGlanceProps) {
  const slotLabel = TIME_SLOT_LABELS[timeSlot];
  const [llmInsights, setLlmInsights] = useState<string[] | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const forecastLabel = weather.forecastFor
    ? new Date(weather.forecastFor).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Demo weather";

  useEffect(() => {
    if (!sunExposureImpact) {
      setLlmInsights(null);
      setLlmLoading(false);
      return;
    }

    const ac = new AbortController();
    setLlmLoading(true);

    void fetch("/api/impact-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weather: {
          temperature: weather.temperature,
          heatIndex: weather.heatIndex,
          relativeHumidity: weather.relativeHumidity,
        },
        impact: sunExposureImpact,
      }),
      signal: ac.signal,
    })
      .then((res) => res.json())
      .then((data: { insights?: string[] }) => {
        const insights = Array.isArray(data.insights) ? data.insights.filter(Boolean).slice(0, 3) : [];
        setLlmInsights(insights.length > 0 ? insights : null);
      })
      .catch(() => {
        setLlmInsights(null);
      })
      .finally(() => {
        setLlmLoading(false);
      });

    return () => ac.abort();
  }, [
    sunExposureImpact,
    weather.heatIndex,
    weather.relativeHumidity,
    weather.temperature,
  ]);

  const healthInsights = sunExposureImpact
    ? llmInsights ?? buildHealthImpactInsights(weather, sunExposureImpact)
    : [];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-sky-50 via-white to-amber-50/90 p-4 shadow-card hc:border-black hc:bg-white hc:from-white hc:to-white"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-200/40 blur-2xl hc:hidden" />
      <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-sky-200/35 blur-xl hc:hidden" />

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 hc:text-black">
        Plan for {slotLabel}
      </p>
      <p className="mt-1 text-xs text-slate-500 hc:text-black">Forecast for {forecastLabel}</p>
      {loading ? (
        <div className="mt-2 h-10 w-32 animate-pulse rounded-lg bg-slate-200/80 hc:bg-gray-200" />
      ) : (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl" aria-hidden>
            {heatEmoji(weather.temperature)}
          </span>
          <span className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 hc:text-black">
            {Math.round(weather.temperature)}°F
          </span>
          <span className="text-sm text-slate-500 hc:text-black">feels ~{Math.round(weather.heatIndex)}°</span>
        </div>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 hc:text-black">
        <div className="rounded-lg bg-white/60 px-2 py-1.5 hc:bg-white">
          <dt className="font-medium text-slate-400 hc:text-black">Wind</dt>
          <dd>{weather.windSpeedMps.toFixed(1)} m/s</dd>
        </div>
        <div className="rounded-lg bg-white/60 px-2 py-1.5 hc:bg-white">
          <dt className="font-medium text-slate-400 hc:text-black">Humidity</dt>
          <dd>{Math.round(weather.relativeHumidity)}%</dd>
        </div>
      </dl>
      <div className="mt-3 rounded-xl border border-emerald-200/90 bg-emerald-50/85 px-3 py-2.5 text-xs text-emerald-950 hc:border-black hc:bg-white hc:text-black">
        <p className="font-semibold tracking-wide">Sun Exposure Impact</p>
        {sunExposureImpact ? (
          <>
            <p className="mt-1 inline-flex items-center rounded-full bg-emerald-100/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 hc:bg-white hc:text-black hc:ring hc:ring-black">
              {sunExposureImpact.reducedSunExposurePct > 0
                ? `${sunExposureImpact.reducedSunExposurePct}% less direct sun`
                : "No direct-sun reduction"}
            </p>
            <p className="mt-1.5 leading-relaxed text-emerald-900 hc:text-black">
              Selected route shade: {sunExposureImpact.selectedShadePct}% (least-shaded alternative:{" "}
              {sunExposureImpact.baselineShadePct}%).
            </p>
            <p className="mt-2 font-medium text-emerald-900 hc:text-black">Why this matters</p>
            {llmLoading && (
              <p className="mt-1 text-[11px] text-emerald-800/90 hc:text-black">
                Personalizing guidance...
              </p>
            )}
            <ul className="mt-1 space-y-1 leading-relaxed text-emerald-900 hc:text-black">
              {healthInsights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
            <p className="mt-2 rounded-md bg-emerald-100/70 px-2 py-1 text-[11px] leading-relaxed text-emerald-900 hc:bg-white hc:text-black hc:ring hc:ring-black">
              Guidance only: this is a route-planning estimate, not medical advice.
            </p>
          </>
        ) : (
          <p className="mt-1.5 leading-relaxed text-emerald-900 hc:text-black">
            Click <span className="font-semibold">Find routes</span> and select a path to see estimated
            direct-sun reduction and health impact guidance.
          </p>
        )}
      </div>
      <div className="mt-3 rounded-xl border border-indigo-200/90 bg-indigo-50/80 px-3 py-2.5 text-xs text-indigo-950 hc:border-black hc:bg-white hc:text-black">
        <p className="font-semibold tracking-wide">Body Heat & Climate Impact</p>
        {heatLoadImpact ? (
          <>
            <p className="mt-1 inline-flex items-center rounded-full bg-indigo-100/90 px-2 py-0.5 text-[11px] font-semibold text-indigo-900 hc:bg-white hc:text-black hc:ring hc:ring-black">
              {heatLoadImpact.reductionPct > 0
                ? `${heatLoadImpact.reductionPct}% lower estimated body heat load`
                : "No heat-load reduction vs baseline"}
            </p>
            <div className="mt-2 space-y-1.5">
              {(() => {
                const maxLoad = Math.max(1, heatLoadImpact.selectedHeatLoad, heatLoadImpact.baselineHeatLoad);
                const selectedWidth = Math.max(6, Math.round((heatLoadImpact.selectedHeatLoad / maxLoad) * 100));
                const baselineWidth = Math.max(6, Math.round((heatLoadImpact.baselineHeatLoad / maxLoad) * 100));
                return (
                  <>
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-[11px] font-medium">
                        <span>Selected path</span>
                        <span>{heatLoadImpact.selectedHeatLoad} load pts</span>
                      </div>
                      <div className="h-2 rounded-full bg-indigo-100">
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${selectedWidth}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-[11px] font-medium">
                        <span>Baseline (least-shaded)</span>
                        <span>{heatLoadImpact.baselineHeatLoad} load pts</span>
                      </div>
                      <div className="h-2 rounded-full bg-indigo-100">
                        <div className="h-2 rounded-full bg-indigo-300" style={{ width: `${baselineWidth}%` }} />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <p className="mt-2 leading-relaxed text-indigo-900 hc:text-black">
              This route estimates {heatLoadImpact.avoidedHeatLoad} fewer heat-load points ({heatLoadImpact.selectedDurationMin} min,{" "}
              {heatLoadImpact.selectedShadePct}% shade) vs baseline ({heatLoadImpact.baselineDurationMin} min,{" "}
              {heatLoadImpact.baselineShadePct}% shade).
            </p>
            <p className="mt-1 leading-relaxed text-indigo-900 hc:text-black">
              Lower personal heat load can reduce downstream cooling demand and emissions pressure after arrival.
            </p>
            <p className="mt-2 rounded-md bg-indigo-100/70 px-2 py-1 text-[11px] leading-relaxed text-indigo-900 hc:bg-white hc:text-black hc:ring hc:ring-black">
              Estimates are relative model outputs (for comparison), not direct medical or carbon accounting values.
            </p>
          </>
        ) : (
          <p className="mt-1.5 leading-relaxed text-indigo-900 hc:text-black">
            Select routes to compare estimated body heat load and potential downstream cooling impact.
          </p>
        )}
      </div>
      {weather.confidence === "Low" && (
        <p className="mt-2 text-[11px] leading-snug text-amber-800/90 hc:text-black">
          Using backup weather — live forecast unavailable.
        </p>
      )}
    </div>
  );
}
