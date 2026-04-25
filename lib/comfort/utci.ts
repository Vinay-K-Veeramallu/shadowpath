/**
 * UTCI (Universal Thermal Climate Index) — simplified approximation for
 * outdoor pedestrian thermal comfort. Based on the operating range and
 * stress categories from Brode et al. (2012).
 *
 * The full ISB regression has 200+ coefficients; this app uses a published
 * 4-term linear approximation that is monotonic and well-behaved across the
 * heat-stress range relevant to Phoenix campus routing.
 *
 * UTCI = Ta + 0.33*(Tmrt - Ta) - 0.7*va + 0.7*pa - 4.0
 *
 * where Ta is air temperature (degC), Tmrt is mean radiant temperature
 * (degC), va is wind speed at 10m (m/s), pa is partial water-vapor
 * pressure (kPa).
 */

export interface UtciInput {
  airTempC: number;        // dry-bulb air temperature, degC
  mrtC: number;            // mean radiant temperature, degC
  windSpeedMps: number;    // wind at 10m height, m/s
  relativeHumidity: number; // 0-100 %
}

export type UtciStress =
  | "no-stress"
  | "moderate"
  | "strong"
  | "very-strong"
  | "extreme";

const WIND_MIN = 0.5;
const WIND_MAX = 17;

export function fahrenheitToCelsius(f: number): number {
  return (f - 32) * (5 / 9);
}

export function celsiusToFahrenheit(c: number): number {
  return c * (9 / 5) + 32;
}

/** Saturation vapor pressure (kPa) via Magnus-Tetens formula. */
export function saturationVaporKpa(tempC: number): number {
  return 0.6105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
}

/** Partial vapor pressure (kPa) from temperature and relative humidity. */
export function vaporPressureKpa(tempC: number, rhPercent: number): number {
  const rh = Math.max(0, Math.min(100, rhPercent)) / 100;
  return rh * saturationVaporKpa(tempC);
}

/** Compute UTCI in degC. */
export function computeUtci(input: UtciInput): number {
  const { airTempC, mrtC, windSpeedMps, relativeHumidity } = input;
  const va = Math.max(WIND_MIN, Math.min(WIND_MAX, windSpeedMps));
  const pa = vaporPressureKpa(airTempC, relativeHumidity);
  return airTempC + 0.33 * (mrtC - airTempC) - 0.7 * va + 0.7 * pa - 4.0;
}

/** Map a UTCI value to a heat-stress category (Brode et al. 2012). */
export function utciStressCategory(utciC: number): UtciStress {
  if (utciC < 26) return "no-stress";
  if (utciC < 32) return "moderate";
  if (utciC < 38) return "strong";
  if (utciC < 46) return "very-strong";
  return "extreme";
}

/** Human-readable label for a stress category. */
export function utciStressLabel(stress: UtciStress): string {
  switch (stress) {
    case "no-stress": return "No thermal stress";
    case "moderate": return "Moderate heat stress";
    case "strong": return "Strong heat stress";
    case "very-strong": return "Very strong heat stress";
    case "extreme": return "Extreme heat stress";
  }
}

/**
 * Normalised heat-stress penalty in [0,1] suitable for use as a routing
 * cost multiplier. 0 = comfortable (UTCI <= 26 degC), 1 = extreme stress
 * (UTCI >= 46 degC). Linear in between.
 */
export function utciStressPenalty(utciC: number): number {
  if (utciC <= 26) return 0;
  if (utciC >= 46) return 1;
  return (utciC - 26) / 20;
}
