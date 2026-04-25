import type { RouteResult } from "../routing/types";

/** Risk level labels — never uses the word "safe" */
export type RiskLevel = "lower-risk" | "higher-risk" | "not recommended";

/** A single campus commitment in the user's daily schedule */
export interface CampusCommitment {
  location: string;
  startTime: string;
  endTime?: string;
  flexibility: "flexible" | "fixed";
  label: string;
}

/** Per-segment risk assessment */
export interface RouteSegmentRisk {
  walkingTimeMinutes: number;
  sunExposureMinutes: number;
  shadePercentage: number;
  coolingAvailability: number;
  waterAvailability: number;
  accessibilityCompliant: boolean;
  confidenceLabel: "High" | "Medium" | "Low";
  riskLevel: RiskLevel;
}

/** Cooling break recommendation */
export interface CoolingRecommendation {
  coolingPointName: string;
  distanceFromRouteMeters: number;
  suggestedBreakMinutes: number;
  reason: string;
}

/** Water refill recommendation */
export interface WaterRecommendation {
  waterPointName: string;
  distanceFromRouteMeters: number;
}

/** Shuttle stop data (added to GeoJSON) */
export interface ShuttleStop {
  id: string;
  name: string;
  nearbyBuildings: string[];
  coordinates: [number, number];
  estimatedWaitMinutes: number;
  accessible: boolean;
}

/** Shuttle alternative recommendation */
export interface ShuttleAlternative {
  shuttleStopName: string;
  estimatedWaitMinutes: number;
  walkingDistanceMeters: number;
  accessible: boolean;
}

/** A walking segment between two consecutive commitments */
export interface ScheduleTransition {
  origin: CampusCommitment;
  destination: CampusCommitment;
  routeResult: RouteResult | null;
  segmentRisk: RouteSegmentRisk;
  coolingRecommendation: CoolingRecommendation | null;
  waterRecommendation: WaterRecommendation | null;
  shuttleAlternative: ShuttleAlternative | null;
}

/** Personal heat mode preferences */
export interface PersonalHeatMode {
  standardWalking: boolean;
  lowExertion: boolean;
  wheelchairAccessible: boolean;
  asthmaSensitive: boolean;
  preferShadedPaths: boolean;
  preferWaterRefillStops: boolean;
  preferCoolingStops: boolean;
  preferShuttleAlternatives: boolean;
}

/** Full-day aggregate metrics */
export interface DailyAggregateMetrics {
  totalOutdoorMinutes: number;
  totalSunExposureMinutes: number;
  averageShadePercentage: number;
  totalCoolingStopsAvailable: number;
  highestRiskSegmentIndex: number;
  estimatedReductionPercentage: number;
}

/** Complete daily heat plan */
export interface DailyHeatPlan {
  transitions: ScheduleTransition[];
  aggregateMetrics: DailyAggregateMetrics;
}

/** Heat budget dashboard model */
export interface HeatBudget {
  totalBudget: number;
  consumedBudget: number;
  remainingBudget: number;
  highestRiskTimeBlock: string;
  recommendedCoolingBreak: string | null;
  estimatedReductionPercentage: number;
}

/** Daily safety evaluation output */
export interface DailySafetyEvaluation {
  allowed: boolean;
  riskLevel: RiskLevel;
  blockedSegments: ScheduleTransition[];
  explanation: string;
  recommendations: string[];
}
