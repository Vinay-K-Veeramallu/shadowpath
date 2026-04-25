import type { SafetyVerdict } from "./types";

/** Legacy exposure gate (HeatShield internals / exposure score only). */
export const UNSAFE_EXPOSURE_THRESHOLD = 75;

export function evaluateSafetyFromExposure(exposureScore: number): "legacy-safe" | "legacy-unsafe" {
  return exposureScore > UNSAFE_EXPOSURE_THRESHOLD ? "legacy-unsafe" : "legacy-safe";
}

/** Primary gate: distance-weighted average UTCI (°C). */
export function evaluateSafetyFromUtci(averageUtciC: number): SafetyVerdict {
  if (averageUtciC >= 38) return "not-recommended";
  if (averageUtciC >= 32) return "higher-risk";
  return "lower-risk";
}
