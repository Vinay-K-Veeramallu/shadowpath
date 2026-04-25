import type { GraphEdge, SurfaceType } from "../graph/types";
import { edgeShadeFraction01 } from "../graph/types";
import type { TimeSlotHour } from "../timeSlots";
import {
  computeUtci,
  fahrenheitToCelsius,
  utciStressCategory,
  utciStressLabel,
  utciStressPenalty,
  type UtciStress,
} from "./utci";

const SUN_MRT_UPLIFT_C = 30;
const FULL_SHADE_MRT_UPLIFT_C = 2;

const INDOOR_AIR_TEMP_C = 22;
const INDOOR_WIND_MPS = 0.5;
const INDOOR_RH = 45;

const ALBEDO: Record<SurfaceType, number> = {
  asphalt: 0.1,
  grass: 0.25,
  concrete: 0.3,
  paving_stones: 0.2,
  covered_walkway: 0.4,
  indoor: 0,
  unknown: 0.15,
};

export interface EdgeWeatherSnapshot {
  airTempF: number;
  windSpeedMps: number;
  relativeHumidity: number;
}

export interface EdgeComfort {
  utciC: number;
  stress: UtciStress;
  stressLabel: string;
  stressPenalty: number;
  isIndoor: boolean;
}

function surfaceRadiationFactor(surface: SurfaceType, shadeFrac: number): number {
  const alb = ALBEDO[surface];
  const direct = (1 - shadeFrac) * (1 - alb);
  let coveredScale = 1;
  if (surface === "covered_walkway") coveredScale *= 0.45;
  return Math.max(0, Math.min(1, direct * coveredScale));
}

/**
 * UTCI for one edge at a time slot. Uses dynamic `shadeFraction` when set
 * (after `attachShadeForDatetime`), else legacy interpolated shade.
 */
export function computeEdgeComfort(
  edge: GraphEdge,
  timeSlot: TimeSlotHour,
  weather: EdgeWeatherSnapshot
): EdgeComfort {
  if (edge.isIndoor === true || edge.surfaceType === "indoor") {
    const utciC = computeUtci({
      airTempC: INDOOR_AIR_TEMP_C,
      mrtC: INDOOR_AIR_TEMP_C,
      windSpeedMps: INDOOR_WIND_MPS,
      relativeHumidity: INDOOR_RH,
    });
    const stress = utciStressCategory(utciC);
    return {
      utciC,
      stress,
      stressLabel: utciStressLabel(stress),
      stressPenalty: utciStressPenalty(utciC),
      isIndoor: true,
    };
  }

  const airTempC = fahrenheitToCelsius(weather.airTempF);
  const shadeFrac = edgeShadeFraction01(edge, timeSlot);
  const radFactor = surfaceRadiationFactor(edge.surfaceType, shadeFrac);
  const mrtUplift =
    FULL_SHADE_MRT_UPLIFT_C + (SUN_MRT_UPLIFT_C - FULL_SHADE_MRT_UPLIFT_C) * radFactor;
  const mrtC = airTempC + mrtUplift;

  const windEff = Math.max(0.1, weather.windSpeedMps * edge.windCanyonFactor);

  const utciC = computeUtci({
    airTempC,
    mrtC,
    windSpeedMps: windEff,
    relativeHumidity: weather.relativeHumidity,
  });
  const stress = utciStressCategory(utciC);

  return {
    utciC,
    stress,
    stressLabel: utciStressLabel(stress),
    stressPenalty: utciStressPenalty(utciC),
    isIndoor: false,
  };
}

export function averageUtci(
  edges: GraphEdge[],
  timeSlot: TimeSlotHour,
  weather: EdgeWeatherSnapshot
): number {
  const totalDistance = edges.reduce((sum, e) => sum + e.distanceMeters, 0);
  if (totalDistance === 0) return 0;
  let weightedSum = 0;
  for (const edge of edges) {
    const comfort = computeEdgeComfort(edge, timeSlot, weather);
    weightedSum += comfort.utciC * edge.distanceMeters;
  }
  return weightedSum / totalDistance;
}
