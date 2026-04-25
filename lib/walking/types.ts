export type WalkingProvider = "google" | "osrm";

export interface WalkingRouteLeg {
  id: string;
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationMinutes: number;
}

export interface WalkingDirectionsOk {
  ok: true;
  provider: WalkingProvider;
  routes: WalkingRouteLeg[];
  attribution: string;
}

export interface WalkingDirectionsErr {
  ok: false;
  error: string;
  routes: [];
}

export type WalkingDirectionsPayload = WalkingDirectionsOk | WalkingDirectionsErr;

export interface WalkingRouteRanked extends WalkingRouteLeg {
  shadeEstimatePct: number;
  shadeConfidence: "High" | "Medium" | "Low";
  rankingScore: number;
  winnerReason: string;
}
