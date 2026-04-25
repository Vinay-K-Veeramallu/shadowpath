"use client";

import { useId, useMemo, useState, useEffect } from "react";
import type { TimeSlotHour } from "../lib/timeSlots";
import { TIME_SLOT_HOURS, TIME_SLOT_LABELS } from "../lib/timeSlots";

interface ShadeSliderProps {
  value: TimeSlotHour;
  onChange: (value: TimeSlotHour) => void;
}

/** Minutes from 6 AM (start) to 8 PM (end) */
const START_HOUR = 6;
const END_HOUR = 20;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60; // 840
const STEP = 5;

/** Convert minutes-from-6AM to a display string like "6:00 AM", "2:35 PM" */
function minutesToLabel(mins: number): string {
  const totalHour = START_HOUR + Math.floor(mins / 60);
  const minute = mins % 60;
  const h12 = totalHour % 12 === 0 ? 12 : totalHour % 12;
  const ampm = totalHour < 12 ? "AM" : "PM";
  return `${h12}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

/** Snap minutes-from-6AM to the nearest TimeSlotHour */
function snapToSlot(mins: number): TimeSlotHour {
  const decimalHour = START_HOUR + mins / 60;
  let best: TimeSlotHour = TIME_SLOT_HOURS[0];
  let bestD = Infinity;
  for (const s of TIME_SLOT_HOURS) {
    const d = Math.abs(decimalHour - s);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Convert a TimeSlotHour to minutes-from-6AM */
function slotToMinutes(slot: TimeSlotHour): number {
  return (slot - START_HOUR) * 60;
}

/** Get emoji for time of day based on hour */
function timeEmoji(mins: number): string {
  const hour = START_HOUR + mins / 60;
  if (hour < 10) return "🌅";
  if (hour < 16) return "☀️";
  return "🌆";
}

export function ShadeSlider({ value, onChange }: ShadeSliderProps) {
  const id = useId();
  const [minutes, setMinutes] = useState(() => slotToMinutes(value));

  // Sync internal minutes when the external value changes
  useEffect(() => {
    const slotMins = slotToMinutes(value);
    // Only reset if the current minutes don't already snap to this slot
    if (snapToSlot(minutes) !== value) {
      setMinutes(slotMins);
    }
  }, [value]);

  const displayLabel = minutesToLabel(minutes);
  const snappedSlot = snapToSlot(minutes);

  const gradientStyle = useMemo(
    () => ({
      background:
        "linear-gradient(90deg, #1e3a5f 0%, #38bdf8 25%, #fbbf24 55%, #fb923c 78%, #4c1d95 100%)",
    }),
    []
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newMins = Number.parseInt(e.target.value, 10);
    setMinutes(newMins);
    const slot = snapToSlot(newMins);
    if (slot !== value) {
      onChange(slot);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(TOTAL_MINUTES, minutes + STEP);
      setMinutes(next);
      const slot = snapToSlot(next);
      if (slot !== value) onChange(slot);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = Math.max(0, minutes - STEP);
      setMinutes(prev);
      const slot = snapToSlot(prev);
      if (slot !== value) onChange(slot);
    } else if (e.key === "Home") {
      e.preventDefault();
      setMinutes(0);
      onChange(TIME_SLOT_HOURS[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setMinutes(TOTAL_MINUTES);
      onChange(TIME_SLOT_HOURS[TIME_SLOT_HOURS.length - 1]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm hc:border-black hc:bg-white">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span id={`${id}-label`} className="text-sm font-medium text-slate-700 hc:text-black">
            Walk time
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white shadow-sm hc:bg-black"
            aria-live="polite"
          >
            <span className="text-base leading-none" aria-hidden>
              {timeEmoji(minutes)}
            </span>
            {displayLabel}
          </span>
        </div>

        <label htmlFor={`${id}-range`} className="sr-only">
          Select time of day in five-minute steps from 6 AM to 8 PM
        </label>

        <div className="relative pt-2 pb-1">
          <div
            className="pointer-events-none absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 rounded-full opacity-90 hc:opacity-100"
            style={gradientStyle}
            aria-hidden
          />
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-slate-900/10 hc:bg-gray-300" aria-hidden />

          <input
            id={`${id}-range`}
            type="range"
            min={0}
            max={TOTAL_MINUTES}
            step={STEP}
            value={minutes}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            aria-label={`Time of day, ${displayLabel}`}
            aria-valuemin={START_HOUR}
            aria-valuemax={END_HOUR}
            aria-valuenow={START_HOUR + minutes / 60}
            aria-valuetext={displayLabel}
            aria-describedby={`${id}-label`}
            className="relative z-10 h-10 w-full cursor-pointer appearance-none bg-transparent sp-ring-focus rounded-lg
              [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent
              [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-amber-200 [&::-webkit-slider-thumb]:to-orange-400 [&::-webkit-slider-thumb]:shadow-lg
              [&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent
              [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-amber-200 [&::-moz-range-thumb]:to-orange-400 [&::-moz-range-thumb]:shadow-lg"
          />
        </div>

        <p className="mt-2 text-center text-[11px] text-slate-500 hc:text-black">
          Drag the sun along the day, or tap a time below
        </p>
      </div>

      <div
        role="group"
        aria-label="Quick time presets"
        className="flex flex-wrap justify-center gap-1.5 sm:gap-2"
      >
        {TIME_SLOT_HOURS.map((stop) => {
          const active = stop === snappedSlot;
          return (
            <button
              key={stop}
              type="button"
              onClick={() => {
                setMinutes(slotToMinutes(stop));
                onChange(stop);
              }}
              aria-pressed={active}
              className={`min-w-[3.25rem] rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-150 sp-ring-focus sm:text-sm ${
                active
                  ? "scale-[1.02] bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300/60 hc:bg-black hc:ring-black"
                  : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80 hover:bg-slate-50 hover:ring-slate-300 hc:bg-white hc:text-black hc:ring-black"
              }`}
            >
              {TIME_SLOT_LABELS[stop]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
