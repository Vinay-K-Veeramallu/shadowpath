"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RouteForm } from "../../components/RouteForm";
import { MapView } from "../../components/MapView";
import { RouteResultPanel } from "../../components/RouteResultPanel";
import { TextRouteSummary } from "../../components/TextRouteSummary";
import { WalkingPathsStrip } from "../../components/WalkingPathsStrip";
import { WeatherGlance } from "../../components/WeatherGlance";
import { ImpactDashboard } from "../../components/ImpactDashboard";
import { useRoutes } from "../../hooks/useRoutes";
import { useWeather } from "../../hooks/useWeather";
import type { RouteParams } from "../../lib/routing/types";
import { DatasetError } from "../../lib/graph/types";

let datasetError: string | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../../lib/data/loadDataset");
} catch (err) {
  datasetError =
    err instanceof DatasetError ? err.message : "Campus data unavailable.";
}

function RoutePlanner() {
  const {
    routeResults,
    selectedTime,
    setSelectedTime,
    resultHeadingRef,
    triggerCompute,
    recomputeRoutesForCurrentWeather,
    rankedWalkingRoutes,
    walkingAttribution,
    walkingProvider,
    walkingFetchError,
    selectedWalkingId,
    setSelectedWalkingId,
    tripEntrances,
  } = useRoutes();
  const { weather, loading: weatherLoading } = useWeather(selectedTime);
  const selectedWalkingRoute = useMemo(
    () => rankedWalkingRoutes.find((r) => r.id === selectedWalkingId) ?? rankedWalkingRoutes[0] ?? null,
    [rankedWalkingRoutes, selectedWalkingId]
  );
  const sunExposureImpact = useMemo(() => {
    if (!selectedWalkingRoute) return null;
    const leastShaded = rankedWalkingRoutes.reduce((min, route) =>
      route.shadeEstimatePct < min.shadeEstimatePct ? route : min
    );
    return {
      reducedSunExposurePct: Math.max(
        0,
        Math.round(selectedWalkingRoute.shadeEstimatePct - leastShaded.shadeEstimatePct)
      ),
      selectedShadePct: Math.round(selectedWalkingRoute.shadeEstimatePct),
      baselineShadePct: Math.round(leastShaded.shadeEstimatePct),
    };
  }, [rankedWalkingRoutes, selectedWalkingRoute]);
  const heatLoadImpact = useMemo(() => {
    if (!selectedWalkingRoute) return null;
    const baselineRoute = rankedWalkingRoutes.reduce((min, route) =>
      route.shadeEstimatePct < min.shadeEstimatePct ? route : min
    );

    const selectedShadeFraction = Math.min(1, Math.max(0, selectedWalkingRoute.shadeEstimatePct / 100));
    const baselineShadeFraction = Math.min(1, Math.max(0, baselineRoute.shadeEstimatePct / 100));
    const heatIntensity = Math.max(0, weather.heatIndex - 70);

    // Relative body-heat-load proxy: hotter air + longer duration + less shade => higher load.
    const selectedHeatLoad =
      selectedWalkingRoute.durationMinutes * heatIntensity * (1 - selectedShadeFraction);
    const baselineHeatLoad = baselineRoute.durationMinutes * heatIntensity * (1 - baselineShadeFraction);
    const avoidedHeatLoad = Math.max(0, baselineHeatLoad - selectedHeatLoad);
    const reductionPct = baselineHeatLoad > 0 ? Math.round((avoidedHeatLoad / baselineHeatLoad) * 100) : 0;

    return {
      selectedHeatLoad: Math.round(selectedHeatLoad),
      baselineHeatLoad: Math.round(baselineHeatLoad),
      avoidedHeatLoad: Math.round(avoidedHeatLoad),
      reductionPct,
      selectedDurationMin: Math.round(selectedWalkingRoute.durationMinutes),
      baselineDurationMin: Math.round(baselineRoute.durationMinutes),
      selectedShadePct: Math.round(selectedWalkingRoute.shadeEstimatePct),
      baselineShadePct: Math.round(baselineRoute.shadeEstimatePct),
    };
  }, [rankedWalkingRoutes, selectedWalkingRoute, weather.heatIndex]);

  useEffect(() => {
    if (weatherLoading) return;
    recomputeRoutesForCurrentWeather(weather);
  }, [weather, weatherLoading, selectedTime, recomputeRoutesForCurrentWeather]);
  const [accessibilityMode, setAccessibilityMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasSubmitted = useRef(false);

  function handleFormSubmit(params: RouteParams) {
    hasSubmitted.current = true;
    setAccessibilityMode(params.accessibilityMode);
    startTransition(() => {
      triggerCompute(params, weather);
    });
  }

  const showNoRoute = hasSubmitted.current && routeResults.length === 0 && !isPending;

  return (
    <div className="sp-page-bg min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 text-center sm:mb-10 sm:text-left">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600 shadow-sm ring-1 ring-indigo-100 hc:ring-black">
            <span aria-hidden>🌤️</span> ShadowPath
          </p>
          <h1 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl hc:text-black">
            Routes that respect{" "}
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent hc:bg-none hc:text-inherit">
              heat and shade
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 sm:mx-0 hc:text-black">
            Pick when you&apos;re walking, peek at the weather card, then compare sidewalk-aligned
            paths (OpenStreetMap / optional Google) with the campus shade model on the map.
          </p>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label="Route planner" className="min-w-0">
            <RouteForm
              onSubmit={handleFormSubmit}
              isSearching={isPending}
              timeSlot={selectedTime}
              onTimeSlotChange={setSelectedTime}
            />
          </section>

          <aside className="lg:sticky lg:top-6">
            <WeatherGlance
              weather={weather}
              timeSlot={selectedTime}
              loading={weatherLoading}
              sunExposureImpact={sunExposureImpact}
              heatLoadImpact={heatLoadImpact}
            />
            <p className="mt-4 text-center text-xs leading-relaxed text-slate-500 lg:text-left hc:text-black">
              Weather refreshes when you change the time slider — try sliding through the day.
            </p>
          </aside>
        </div>

        {showNoRoute && (
          <p
            role="status"
            className="mt-8 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-center text-sm font-medium text-amber-900 hc:border-black hc:bg-white hc:text-black"
          >
            No route found between those spots. Try different building names or IDs.
          </p>
        )}

        <section
          aria-label="Campus map"
          className="mt-10 overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-900/5 p-2 shadow-card hc:border-black hc:bg-white hc:p-0"
        >
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/90 px-4 py-3 sm:px-5 hc:bg-white">
            <h2 className="text-sm font-bold text-slate-800 hc:text-black">
              <span className="mr-2" aria-hidden>
                🗺️
              </span>
              Campus map
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hc:bg-white hc:text-black hc:ring hc:ring-black">
              {accessibilityMode ? "Accessible paths" : "All paths"}
            </span>
          </div>
          <div className="space-y-3 p-3 sm:p-4 hc:p-0">
            <WalkingPathsStrip
              routes={rankedWalkingRoutes}
              selectedId={selectedWalkingId}
              onSelect={setSelectedWalkingId}
              provider={walkingProvider}
              attribution={walkingAttribution}
              error={walkingFetchError}
            />
            {tripEntrances.length > 0 ? (
              <div className="rounded-xl border border-orange-200/80 bg-orange-50/80 px-3 py-2 text-xs text-orange-950 hc:border-black hc:bg-white hc:text-black">
                <p className="font-bold">Building doors (approximate)</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {tripEntrances.map((e) => (
                    <li key={e.id}>
                      {e.label}
                      {!e.studentAccess ? " — staff card required" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-[11px] leading-relaxed text-slate-500 hc:text-black">
              Teal lines follow real pedestrian geometry from the router. Faded colored lines are the
              demo campus graph (shade / UTCI). Orange dots mark sample entrances for this trip.
            </p>
            <MapView
              routes={routeResults}
              selectedTime={selectedTime}
              accessibilityMode={accessibilityMode}
              rankedWalkingRoutes={rankedWalkingRoutes}
              selectedWalkingId={selectedWalkingId}
              tripEntrances={tripEntrances}
            />
          </div>
        </section>

        <RouteResultPanel results={routeResults} loading={isPending} ref={resultHeadingRef} />

        <ImpactDashboard heatLoadImpact={heatLoadImpact} />

        <TextRouteSummary results={routeResults} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-0">
      {datasetError ? (
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 hc:border-black hc:bg-white hc:text-black"
          >
            Campus data unavailable. Route planning is currently disabled.
          </div>
          <div className="mt-6">
            <RouteForm onSubmit={() => {}} disabled />
          </div>
        </div>
      ) : (
        <RoutePlanner />
      )}
    </div>
  );
}
