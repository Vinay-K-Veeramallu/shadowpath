"use client";
import { useMemo, useState } from "react";
import { ShadeSlider } from "./ShadeSlider";
import type { RouteParams } from "../lib/routing/types";
import type { TimeSlotHour } from "../lib/timeSlots";
import type { AccessLevel } from "../lib/graph/types";
import type { ComfortWeights } from "../lib/routing/comfortAwareRoute";
import campusData from "../data/campus.geojson";

type ComfortPriority = "fastest" | "balanced" | "coolest";

const COMFORT_WEIGHT_PRESETS: Record<ComfortPriority, ComfortWeights> = {
  fastest: { distance: 0.8, comfort: 0.15, indoor: 0.05 },
  balanced: { distance: 0.4, comfort: 0.5, indoor: 0.1 },
  coolest: { distance: 0.2, comfort: 0.6, indoor: 0.2 },
};

const COMFORT_ICONS: Record<ComfortPriority, string> = {
  fastest: "⚡",
  balanced: "⚖️",
  coolest: "🧊",
};

interface RouteFormProps {
  onSubmit: (params: RouteParams) => void;
  disabled?: boolean;
  isSearching?: boolean;
  /** When set with `onTimeSlotChange`, the time slider is controlled (e.g. shared with weather). */
  timeSlot?: TimeSlotHour;
  onTimeSlotChange?: (t: TimeSlotHour) => void;
}

export function RouteForm({
  onSubmit,
  disabled = false,
  isSearching = false,
  timeSlot: controlledTimeSlot,
  onTimeSlotChange,
}: RouteFormProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [internalTimeSlot, setInternalTimeSlot] = useState<TimeSlotHour>(10);
  const controlled = controlledTimeSlot !== undefined && onTimeSlotChange !== undefined;
  const timeSlot = controlled ? controlledTimeSlot : internalTimeSlot;
  function setTimeSlot(next: TimeSlotHour) {
    if (controlled) onTimeSlotChange(next);
    else setInternalTimeSlot(next);
  }
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("student");
  const [accessibilityMode, setAccessibilityMode] = useState(false);
  const [comfortPriority, setComfortPriority] = useState<ComfortPriority>("balanced");
  const [errors, setErrors] = useState<{ origin?: string; destination?: string }>({});
  const buildingNames = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const fc = campusData as GeoJSON.FeatureCollection;
    for (const f of fc.features) {
      const props = f?.properties as Record<string, unknown> | null;
      const isBuilding = props?.type === "building";
      const name = typeof props?.name === "string" ? props.name.trim() : "";
      if (!isBuilding || !name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(name);
    }
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, []);
  const normalizedOrigin = origin.trim().toLowerCase();
  const normalizedDestination = destination.trim().toLowerCase();
  const originOptions = buildingNames.filter((n) => n.toLowerCase() !== normalizedDestination);
  const destinationOptions = buildingNames.filter((n) => n.toLowerCase() !== normalizedOrigin);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: { origin?: string; destination?: string } = {};
    if (!origin.trim()) newErrors.origin = "Origin is required.";
    if (!destination.trim()) newErrors.destination = "Destination is required.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    onSubmit({
      origin: origin.trim(),
      destination: destination.trim(),
      timeSlot,
      accessibilityMode,
      accessLevel,
      comfortWeights: COMFORT_WEIGHT_PRESETS[comfortPriority],
    });
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 hc:border-black hc:bg-white hc:text-black";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-card backdrop-blur-sm hc:border-black hc:bg-white sm:p-8"
    >
      <fieldset disabled={disabled || isSearching} className="contents">
        <div className="mb-6 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg text-white shadow-md hc:bg-black hc:from-black hc:to-black">
            🧭
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 hc:text-black">Plan a walk</h2>
            <p className="text-sm text-slate-500 hc:text-black">
              Shade and comfort update when you move the time slider.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="origin" className="text-xs font-semibold uppercase tracking-wide text-slate-500 hc:text-black">
              From
            </label>
            <input
              id="origin"
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              aria-describedby={errors.origin ? "origin-error" : undefined}
              aria-invalid={!!errors.origin}
              className={inputClass}
              placeholder="e.g. Memorial Union"
              list="origin-building-options"
              autoComplete="off"
            />
            <datalist id="origin-building-options">
              {originOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {errors.origin && (
              <span id="origin-error" role="alert" className="text-xs font-medium text-rose-600">
                {errors.origin}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="destination"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 hc:text-black"
            >
              To
            </label>
            <input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              aria-describedby={errors.destination ? "destination-error" : undefined}
              aria-invalid={!!errors.destination}
              className={inputClass}
              placeholder="e.g. Hayden Library"
              list="destination-building-options"
              autoComplete="off"
            />
            <datalist id="destination-building-options">
              {destinationOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {errors.destination && (
              <span id="destination-error" role="alert" className="text-xs font-medium text-rose-600">
                {errors.destination}
              </span>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-8 hc:border-black">
          <ShadeSlider value={timeSlot} onChange={setTimeSlot} />
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 hc:text-black">
              Campus access
            </legend>
            <label htmlFor="access-level" className="sr-only">
              Access level
            </label>
            <select
              id="access-level"
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
              className={`${inputClass} cursor-pointer pr-10`}
            >
              <option value="public">Public paths only</option>
              <option value="student">Student access (default)</option>
              <option value="staff">Staff access</option>
            </select>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hc:text-black">
              Comfort vibe
            </legend>
            <div role="radiogroup" className="grid grid-cols-3 gap-1 sm:gap-2" aria-label="Comfort priority">
              {(["fastest", "balanced", "coolest"] as const).map((opt) => {
                const on = comfortPriority === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setComfortPriority(opt)}
                    className={`flex items-center justify-center gap-1 sm:gap-2 rounded-2xl border px-1 sm:px-2 py-2.5 text-[11px] sm:text-sm font-semibold transition-all sp-ring-focus ${
                      on
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm hc:border-black hc:bg-white hc:text-black"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hc:border-black hc:bg-white hc:text-black"
                    }`}
                  >
                    <span aria-hidden>{COMFORT_ICONS[opt]}</span>
                    <span className="capitalize">{opt}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500 hc:text-black">
              This mainly tunes the <span className="font-semibold text-orange-600 hc:text-black">orange Comfort-Aware route</span>.
              Green stays shade-first baseline, and blue stays shortest-distance baseline.
            </p>
          </fieldset>
        </div>

        <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 transition hover:bg-slate-100/90 hc:border-black hc:bg-white">
          <input
            id="accessibility-mode"
            type="checkbox"
            checked={accessibilityMode}
            onChange={(e) => setAccessibilityMode(e.target.checked)}
            className="h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 hc:border-black"
          />
          <span className="text-sm font-medium text-slate-700 hc:text-black">
            Wheelchair-accessible paths only
          </span>
        </label>

        <button
          type="submit"
          disabled={isSearching}
          className="group mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 hc:bg-black hc:from-black hc:to-black hc:shadow-none"
        >
          {isSearching ? (
            <>
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Mapping cool paths…
            </>
          ) : (
            <>
              <span aria-hidden>✨</span>
              Find routes
            </>
          )}
        </button>
      </fieldset>
    </form>
  );
}
