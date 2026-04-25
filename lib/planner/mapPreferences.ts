import type { RouteParams } from "../routing/types";
import type { TimeSlotHour } from "../timeSlots";
import type { PersonalHeatMode } from "./types";
import {
  DEFAULT_COMFORT_WEIGHTS,
  type ComfortWeights,
} from "../routing/comfortAwareRoute";

function comfortWeightsFromPersonalHeatMode(p: PersonalHeatMode): ComfortWeights {
  if (p.preferShadedPaths && p.preferCoolingStops) {
    return { distance: 0.2, comfort: 0.5, indoor: 0.3 };
  }
  if (p.preferShadedPaths) {
    return { distance: 0.2, comfort: 0.6, indoor: 0.2 };
  }
  if (p.preferCoolingStops) {
    return { distance: 0.25, comfort: 0.45, indoor: 0.3 };
  }
  if (p.lowExertion) {
    return { distance: 0.35, comfort: 0.55, indoor: 0.1 };
  }
  return DEFAULT_COMFORT_WEIGHTS;
}

/**
 * Maps PersonalHeatMode preferences to RouteParams for the existing Route_Engine.
 *
 * Pure function — no side effects.
 */
export function mapPreferences(
  preferences: PersonalHeatMode,
  origin: string,
  destination: string,
  timeSlot: TimeSlotHour
): RouteParams {
  return {
    origin,
    destination,
    timeSlot,
    accessibilityMode: preferences.wheelchairAccessible,
    comfortWeights: comfortWeightsFromPersonalHeatMode(preferences),
  };
}
