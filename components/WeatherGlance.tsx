"use client";

import type { WeatherData } from "../lib/weather/types";
import type { TimeSlotHour } from "../lib/timeSlots";
import { TIME_SLOT_LABELS } from "../lib/timeSlots";

interface WeatherGlanceProps {
  weather: WeatherData;
  timeSlot: TimeSlotHour;
  loading?: boolean;
}

function heatEmoji(tempF: number): string {
  if (tempF >= 105) return "🌡️";
  if (tempF >= 95) return "☀️";
  if (tempF >= 85) return "🌤️";
  return "😊";
}

export function WeatherGlance({ weather, timeSlot, loading }: WeatherGlanceProps) {
  const slotLabel = TIME_SLOT_LABELS[timeSlot];

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
      {weather.confidence === "Low" && (
        <p className="mt-2 text-[11px] leading-snug text-amber-800/90 hc:text-black">
          Using backup weather — live forecast unavailable.
        </p>
      )}
    </div>
  );
}
