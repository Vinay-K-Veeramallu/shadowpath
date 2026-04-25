export interface ExposureWeights {
  W_duration: number;
  W_shade: number;
  W_heat: number;
  W_cooling: number;
  W_a11y: number;
}

export const DEFAULT_EXPOSURE_WEIGHTS: ExposureWeights = {
  W_duration: 0.30,
  W_shade: 0.35,
  W_heat: 0.25,
  W_cooling: 0.10,
  W_a11y: 0.05,
};

export interface ExposureScoreInput {
  durationMinutes: number;
  shadePercentage: number;  // 0-100
  heatIndex: number;        // °F
  coolingStopCount: number;
  accessibilityMode: boolean;
  /** 0-100; clouds reduce direct-sun penalty (diffuse light). */
  cloudCoverPct?: number;
  weights?: ExposureWeights;
}

export interface ExposureScoreResult {
  exposureScore: number;      // 0-100
  sunExposureMinutes: number; // whole number, cloud-cover adjusted
}

const MAX_DURATION = 30;
/** When fully overcast, treat ~70% of "sunny" segments as effectively shaded (diffuse light). */
const CLOUD_DIFFUSION_FACTOR = 0.7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Effective shade fraction [0,1] given geometric shade and cloud cover. */
export function effectiveShadeFraction(
  shadePct: number,
  cloudCoverPct: number = 0
): number {
  const geom = clamp(shadePct, 0, 100) / 100;
  const cloud = clamp(cloudCoverPct, 0, 100) / 100;
  // Sunny portion (1 - geom) is partially neutralized by clouds.
  const effective = geom + (1 - geom) * cloud * CLOUD_DIFFUSION_FACTOR;
  return clamp(effective, 0, 1);
}

export function computeExposureScore(input: ExposureScoreInput): ExposureScoreResult {
  const {
    durationMinutes,
    shadePercentage,
    heatIndex,
    coolingStopCount,
    accessibilityMode,
    cloudCoverPct = 0,
    weights = DEFAULT_EXPOSURE_WEIGHTS,
  } = input;

  const effectiveShade = effectiveShadeFraction(shadePercentage, cloudCoverPct);

  const normDuration = durationMinutes / MAX_DURATION;
  const normHeatIndex = clamp((heatIndex - 80) / 40, 0, 1);
  const coolingBonus = Math.min(coolingStopCount / 3, 1);
  const accessibilityPenalty = accessibilityMode ? 0.05 : 0;

  const innerSum =
    weights.W_duration * normDuration
    + weights.W_shade * (1 - effectiveShade)
    + weights.W_heat * normHeatIndex
    - weights.W_cooling * coolingBonus
    + weights.W_a11y * accessibilityPenalty;

  const exposureScore = clamp(innerSum, 0, 1) * 100;

  const sunExposureMinutes = Math.round(durationMinutes * (1 - effectiveShade));

  return { exposureScore, sunExposureMinutes };
}
