"use client";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useWeather } from "./useWeather";
import { campusGraph } from "../lib/data/loadDataset";
import campusData from "../data/campus.geojson";
import { createScheduleTransitions } from "../lib/planner/createScheduleTransitions";
import { calculateDailyHeatExposure } from "../lib/planner/calculateDailyHeatExposure";
import { calculateHeatBudget } from "../lib/planner/calculateHeatBudget";
import { evaluateDailyHeatSafety } from "../lib/planner/evaluateDailyHeatSafety";
import { findHighestRiskSegment } from "../lib/planner/findHighestRiskSegment";
import { representativeTimeSlotForCommitments } from "../lib/planner/commitmentTimeSlot";
import type { TimeSlotHour } from "../lib/timeSlots";
import type {
  CampusCommitment,
  PersonalHeatMode,
  ScheduleTransition,
  DailyHeatPlan,
  HeatBudget,
  DailySafetyEvaluation,
  ShuttleStop,
} from "../lib/planner/types";

/** Load shuttle stops from the GeoJSON dataset */
function loadShuttleStops(): ShuttleStop[] {
  const fc = campusData as GeoJSON.FeatureCollection;
  const stops: ShuttleStop[] = [];

  for (const feature of fc.features) {
    if (
      feature.type !== "Feature" ||
      !feature.properties ||
      feature.properties.type !== "shuttle_stop" ||
      !feature.geometry ||
      feature.geometry.type !== "Point"
    ) {
      continue;
    }

    const props = feature.properties;
    const coords = (feature.geometry as GeoJSON.Point).coordinates;

    stops.push({
      id: props.id as string,
      name: props.name as string,
      nearbyBuildings: (props.nearbyBuildings as string[]) ?? [],
      coordinates: [coords[0], coords[1]],
      estimatedWaitMinutes: props.estimatedWaitMinutes as number,
      accessible: props.accessible as boolean,
    });
  }

  return stops;
}

const DEFAULT_PREFERENCES: PersonalHeatMode = {
  standardWalking: true,
  lowExertion: false,
  wheelchairAccessible: false,
  asthmaSensitive: false,
  preferShadedPaths: false,
  preferWaterRefillStops: false,
  preferCoolingStops: false,
  preferShuttleAlternatives: false,
};

export function useDayPlanner() {
  const [plannedCommitments, setPlannedCommitments] = useState<CampusCommitment[]>([]);
  const [personalHeatMode, setPersonalHeatMode] = useState<PersonalHeatMode>(DEFAULT_PREFERENCES);
  const [transitions, setTransitions] = useState<ScheduleTransition[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyHeatPlan | null>(null);
  const [heatBudget, setHeatBudget] = useState<HeatBudget | null>(null);
  const [safetyEvaluation, setSafetyEvaluation] = useState<DailySafetyEvaluation | null>(null);
  const [highestRiskSegment, setHighestRiskSegment] = useState<ScheduleTransition | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);

  const shuttleStops = useMemo(() => loadShuttleStops(), []);

  const forecastSlot: TimeSlotHour = useMemo(() => {
    if (plannedCommitments.length < 2) return 12;
    return representativeTimeSlotForCommitments(plannedCommitments);
  }, [plannedCommitments]);

  const { weather, loading: weatherLoading, error: weatherError } = useWeather(forecastSlot);

  const submitSchedule = useCallback((newCommitments: CampusCommitment[], preferences: PersonalHeatMode) => {
    setPlannedCommitments(newCommitments);
    setPersonalHeatMode(preferences);
    setComputeError(null);
  }, []);

  useEffect(() => {
    if (plannedCommitments.length < 2) {
      setTransitions([]);
      setDailyPlan(null);
      setHeatBudget(null);
      setSafetyEvaluation(null);
      setHighestRiskSegment(null);
      setComputeError(null);
      return;
    }

    if (weatherLoading) return;

    try {
      setComputeError(null);
      const newTransitions = createScheduleTransitions(
        plannedCommitments,
        campusGraph,
        weather,
        personalHeatMode,
        shuttleStops
      );
      setTransitions(newTransitions);

      const aggregateMetrics = calculateDailyHeatExposure(newTransitions);
      const plan: DailyHeatPlan = {
        transitions: newTransitions,
        aggregateMetrics,
      };
      setDailyPlan(plan);

      const budget = calculateHeatBudget(plan);
      setHeatBudget(budget);

      const safety = evaluateDailyHeatSafety(plan, personalHeatMode);
      setSafetyEvaluation(safety);

      if (newTransitions.length > 0) {
        setHighestRiskSegment(findHighestRiskSegment(newTransitions));
      } else {
        setHighestRiskSegment(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setComputeError(message);
      setTransitions([]);
      setDailyPlan(null);
      setHeatBudget(null);
      setSafetyEvaluation(null);
      setHighestRiskSegment(null);
    }
  }, [plannedCommitments, personalHeatMode, weather, weatherLoading, shuttleStops]);

  const loading = plannedCommitments.length >= 2 && weatherLoading;
  const error = computeError ?? weatherError;

  return {
    commitments: plannedCommitments,
    personalHeatMode,
    transitions,
    dailyPlan,
    heatBudget,
    safetyEvaluation,
    highestRiskSegment,

    weather,
    weatherLoading,
    weatherError,
    forecastSlot,

    loading,
    error,

    submitSchedule,
    setPersonalHeatMode,
  };
}
