"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { campusGraph } from "../lib/data/loadDataset";
import { computeRoutes } from "../lib/routing/computeRoutes";
import type { RouteParams, RouteResult } from "../lib/routing/types";
import type { WeatherData } from "../lib/weather/types";
import type { TimeSlotHour } from "../lib/timeSlots";
import { resolveRouteTimeSlot } from "../lib/timeSlots";
import type { BuildingEntrance } from "../lib/graph/types";
import type { WalkingDirectionsOk, WalkingDirectionsPayload, WalkingRouteRanked } from "../lib/walking/types";
import { estimateShadeStatsAlongPolyline } from "../lib/walking/estimateShadeAlongPolyline";

const MAX_WALKING_ALTERNATIVES = 3;
const MAX_DISTANCE_DETOUR_FACTOR = 1.35;
const MAX_DURATION_DETOUR_FACTOR = 1.35;
function confidenceFromMatchedRatio(r: number): "High" | "Medium" | "Low" {
  if (r >= 0.7) return "High";
  if (r >= 0.45) return "Medium";
  return "Low";
}

function resolveNodeId(input: string): string {
  const lower = input.toLowerCase().trim();
  if (campusGraph.nodes.has(lower)) return lower;
  for (const node of campusGraph.nodes.values()) {
    if (node.name.toLowerCase() === lower) return node.id;
  }
  for (const node of campusGraph.nodes.values()) {
    if (node.name.toLowerCase().includes(lower) || lower.includes(node.name.toLowerCase())) {
      return node.id;
    }
  }
  return input;
}

export function useRoutes() {
  const [routeResults, setRouteResults] = useState<RouteResult[]>([]);
  const [selectedTime, setSelectedTime] = useState<TimeSlotHour>(10);
  const [lastParams, setLastParams] = useState<RouteParams | null>(null);
  const [walkingPayload, setWalkingPayload] = useState<WalkingDirectionsOk | null>(null);
  const [walkingFetchError, setWalkingFetchError] = useState<string | null>(null);
  const [selectedWalkingId, setSelectedWalkingId] = useState<string | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const triggerCompute = useCallback((params: RouteParams, weather: WeatherData) => {
    const resolved: RouteParams = {
      ...params,
      origin: resolveNodeId(params.origin),
      destination: resolveNodeId(params.destination),
    };
    const results = computeRoutes(campusGraph, resolved, weather);
    setRouteResults(results);
    setLastParams(resolved);
    setSelectedTime(resolveRouteTimeSlot(resolved));
  }, []);

  /** Re-run graph routing with the current time slot and latest weather (call after forecast fetch settles). */
  const recomputeRoutesForCurrentWeather = useCallback(
    (weather: WeatherData) => {
      if (!lastParams) return;
      setRouteResults(
        computeRoutes(campusGraph, { ...lastParams, timeSlot: selectedTime }, weather)
      );
    },
    [lastParams, selectedTime]
  );

  useEffect(() => {
    if (!lastParams) {
      setWalkingPayload(null);
      setWalkingFetchError(null);
      setSelectedWalkingId(null);
      return;
    }
    const o = campusGraph.nodes.get(lastParams.origin);
    const d = campusGraph.nodes.get(lastParams.destination);
    if (!o || !d) {
      setWalkingPayload(null);
      setWalkingFetchError(null);
      return;
    }

    const ac = new AbortController();
    setWalkingFetchError(null);
    const [flng, flat] = o.coordinates;
    const [tlng, tlat] = d.coordinates;
    const q = new URLSearchParams({
      fromLng: String(flng),
      fromLat: String(flat),
      toLng: String(tlng),
      toLat: String(tlat),
    });

    void fetch(`/api/walking-directions?${q.toString()}`, { signal: ac.signal })
      .then(async (res) => {
        const data = (await res.json()) as WalkingDirectionsPayload;
        if (!res.ok) {
          setWalkingPayload(null);
          const msg =
            "error" in data && typeof data.error === "string" ? data.error : "Walking paths unavailable.";
          setWalkingFetchError(msg);
          return;
        }
        if (data.ok) {
          setWalkingPayload(data);
        } else {
          setWalkingPayload(null);
          setWalkingFetchError(data.error);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setWalkingPayload(null);
        setWalkingFetchError("Walking paths unavailable.");
      });

    return () => ac.abort();
  }, [lastParams?.origin, lastParams?.destination]);

  const rankedWalkingRoutes: WalkingRouteRanked[] = useMemo(() => {
    if (!walkingPayload?.routes.length) return [];
    const enriched: WalkingRouteRanked[] = walkingPayload.routes.map((r): WalkingRouteRanked => {
      try {
        const stats = estimateShadeStatsAlongPolyline(r.geometry, campusGraph, selectedTime);
        return {
          ...r,
          shadeEstimatePct: stats.shadePercent,
          shadeConfidence: confidenceFromMatchedRatio(stats.matchedSampleRatio),
          rankingScore: 0,
          winnerReason: "",
        };
      } catch {
        return {
          ...r,
          shadeEstimatePct: 45,
          shadeConfidence: "Low",
          rankingScore: 0,
          winnerReason: "",
        };
      }
    });
    const baseDistance = Math.min(...enriched.map((r) => r.distanceMeters));
    const baseDuration = Math.min(...enriched.map((r) => r.durationMinutes));

    const scored = enriched.map((r) => {
      const distanceRatio = r.distanceMeters / Math.max(1, baseDistance);
      const durationRatio = r.durationMinutes / Math.max(1, baseDuration);
      const hardPenalty =
        distanceRatio > MAX_DISTANCE_DETOUR_FACTOR || durationRatio > MAX_DURATION_DETOUR_FACTOR
          ? 30
          : 0;

      // Multi-objective score: keep shade primary, but avoid unrealistic detours.
      const score =
        r.shadeEstimatePct -
        (distanceRatio - 1) * 40 -
        (durationRatio - 1) * 35 -
        hardPenalty;

      const winnerReason =
        hardPenalty > 0
          ? `Good shade (~${r.shadeEstimatePct}%) but penalized for a large detour.`
          : `Balances shade (~${r.shadeEstimatePct}%) with ${(distanceRatio * 100).toFixed(0)}% distance and ${(durationRatio * 100).toFixed(0)}% time of the shortest option.`;

      return {
        route: {
          ...r,
          rankingScore: Math.round(score * 10) / 10,
          winnerReason,
        },
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.route).slice(0, MAX_WALKING_ALTERNATIVES);
  }, [walkingPayload, selectedTime]);

  useEffect(() => {
    if (rankedWalkingRoutes.length === 0) {
      setSelectedWalkingId(null);
      return;
    }
    if (
      selectedWalkingId === null ||
      !rankedWalkingRoutes.some((r) => r.id === selectedWalkingId)
    ) {
      setSelectedWalkingId(rankedWalkingRoutes[0].id);
    }
  }, [rankedWalkingRoutes, selectedWalkingId]);

  const tripEntrances: BuildingEntrance[] = useMemo(() => {
    if (!lastParams) return [];
    const ids = new Set([lastParams.origin, lastParams.destination]);
    return (campusGraph.entrances ?? []).filter((e) => ids.has(e.buildingId));
  }, [lastParams]);

  return {
    routeResults,
    selectedTime,
    setSelectedTime,
    resultHeadingRef,
    triggerCompute,
    recomputeRoutesForCurrentWeather,
    rankedWalkingRoutes,
    walkingAttribution: walkingPayload?.attribution ?? null,
    walkingProvider: walkingPayload?.provider ?? null,
    walkingFetchError,
    selectedWalkingId,
    setSelectedWalkingId,
    tripEntrances,
  };
}
