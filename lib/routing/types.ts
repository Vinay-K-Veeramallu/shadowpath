import type { GraphEdge } from "../graph/types";
import type { ComfortWeights } from "./comfortAwareRoute";
import type { UtciStress } from "../comfort/utci";
import type { TimeSlotHour } from "../timeSlots";
import type { AccessLevel } from "../graph/types";

export type RouteType = "shortest" | "shade-aware" | "cooling-stop" | "comfort-aware";
export type ConfidenceLabel = "High" | "Medium" | "Low";
/** UTCI-driven safety: not-recommended (≥38°C), higher-risk (32–38°C), lower-risk (<32°C). */
export type SafetyVerdict = "lower-risk" | "higher-risk" | "not-recommended";

export interface RouteParams {
  origin: string;
  destination: string;
  /** Eight two-hour slot anchors (local hour). */
  timeSlot?: TimeSlotHour;
  /** Legacy three-slot API — mapped to the same hour values (10, 14, 18). */
  timeOfDay?: 10 | 14 | 18;
  accessibilityMode: boolean;
  comfortWeights?: ComfortWeights;
  accessLevel?: AccessLevel;
}

export interface RouteResult {
  type: RouteType[];
  path: string[];
  edges: GraphEdge[];
  distanceMeters: number;
  durationMinutes: number;
  shadePercentage: number;
  sunExposureMinutes: number;
  coolingStopCount: number;
  waterStationCount: number;
  coolingZoneCount: number;
  exposureScore: number;
  confidenceLabel: ConfidenceLabel;
  safetyVerdict: SafetyVerdict;
  averageUtciC: number;
  utciStress: UtciStress;
  utciStressLabel: string;
  indoorMeters: number;
  dataSources: string[];
  assumptions: string[];
  geometry: GeoJSON.FeatureCollection;
}
