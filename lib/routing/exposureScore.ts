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
  weights?: ExposureWeights;
}

export interface ExposureScoreResult {
  exposureScore: number;      // 0-100
  sunExposureMinutes: number; // whole number
}

const MAX_DURATION = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeExposureScore(input: ExposureScoreInput): ExposureScoreResult {
  const {
    durationMinutes,
    shadePercentage,
    heatIndex,
    coolingStopCount,
    accessibilityMode,
    weights = DEFAULT_EXPOSURE_WEIGHTS,
  } = input;

  const normDuration = durationMinutes / MAX_DURATION;
  const normHeatIndex = clamp((heatIndex - 80) / 40, 0, 1);
  const coolingBonus = Math.min(coolingStopCount / 3, 1);
  const accessibilityPenalty = accessibilityMode ? 0.05 : 0;

  const innerSum =
    weights.W_duration * normDuration
    + weights.W_shade * (1 - shadePercentage / 100)
    + weights.W_heat * normHeatIndex
    - weights.W_cooling * coolingBonus
    + weights.W_a11y * accessibilityPenalty;

  const exposureScore = clamp(innerSum, 0, 1) * 100;

  const sunExposureMinutes = Math.round(durationMinutes * (1 - shadePercentage / 100));

  return { exposureScore, sunExposureMinutes };
}
